import { NextRequest, NextResponse } from 'next/server'
import { readFile, writeFile, mkdir } from 'fs/promises'
import { existsSync } from 'fs'
import { requireAuth } from '@/lib/require-auth'
import { requireRole } from '@/lib/rbac'
import { withAudit } from '@/lib/audit'
import {
  chmodPlusX,
  psAuxFirstLineContaining,
  systemctlDaemonReload,
  systemctlEnable,
  systemctlIsActive,
  systemctlListUnitsHasService,
  systemctlShowValue,
  systemctlStart,
  toSafeServiceUnit,
  ufwAllowTcpQuiet,
} from '@/lib/safe-shell'
import { rtmpCreateBodySchema } from '@/lib/schemas/rtmp-streams'
import { zodErrorResponse } from '@/lib/zod-response'

const RTMP_STREAMS_FILE = '/srv/rtmp-streams.json'
const RTMP_DEFAULT_PORT = 1935

function rtmpUrl(host: string, port: number, app: string, streamKey: string): string {
  const base = port === RTMP_DEFAULT_PORT ? `rtmp://${host}` : `rtmp://${host}:${port}`
  return `${base}/${app}/${streamKey}`
}

interface RTMPStream {
  id: string
  name: string
  inputPort: number
  /** 0 = non utilisé (mode restream uniquement) */
  outputPort: number
  streamKey?: string
  service: string
  createdAt: string
  updatedAt: string
  /** hls (défaut) ou restream (RTMP → RTMP copy) */
  mode?: 'hls' | 'restream'
}

// Initialiser le fichier s'il n'existe pas
async function initStreamsFile() {
  if (!existsSync(RTMP_STREAMS_FILE)) {
    await mkdir('/srv', { recursive: true })
    await writeFile(RTMP_STREAMS_FILE, JSON.stringify([], null, 2))
  }
}

// Lire tous les streams RTMP
async function getRTMPStreams(): Promise<RTMPStream[]> {
  await initStreamsFile()
  try {
    const content = await readFile(RTMP_STREAMS_FILE, 'utf-8')
    return JSON.parse(content)
  } catch {
    return []
  }
}

// Sauvegarder les streams RTMP
async function saveRTMPStreams(streams: RTMPStream[]) {
  await initStreamsFile()
  await writeFile(RTMP_STREAMS_FILE, JSON.stringify(streams, null, 2))
}

// GET - Récupérer tous les streams RTMP
export async function GET(request: NextRequest){
  const __auth = await requireAuth(request)
  if (!__auth.ok) return __auth.response

  try {
    const streams = await getRTMPStreams()
    
    // Enrichir avec le statut des services
    const enrichedStreams = await Promise.all(
      streams.map(async (stream) => {
        try {
          const unit = toSafeServiceUnit(stream.service)
          const status = (await systemctlIsActive(unit)).trim()
          
          let uptime = 'N/A'
          let cpu = 0
          let memory = '0 MB'
          
          if (status === 'active') {
            try {
              const uptimeOut = await systemctlShowValue(unit, 'ActiveEnterTimestamp')
              if (uptimeOut.trim()) {
                const uptimeDate = new Date(uptimeOut.trim())
                const now = new Date()
                const diff = Math.floor((now.getTime() - uptimeDate.getTime()) / 1000)
                const hours = Math.floor(diff / 3600)
                const minutes = Math.floor((diff % 3600) / 60)
                uptime = `${hours}h ${minutes}m`
              }
            } catch {}
            
            try {
              const psLine = await psAuxFirstLineContaining(unit)
              if (psLine.trim()) {
                const parts = psLine.trim().split(/\s+/)
                const cpuStr = parts[2]
                const memStr = parts[3]
                cpu = parseFloat(cpuStr) || 0
                memory = `${parseFloat(memStr) || 0} MB`
              }
            } catch {}
          }
          
          return {
            ...stream,
            mode: stream.mode || 'hls',
            status: status === 'active' ? 'active' : 'inactive',
            uptime,
            cpu,
            memory,
            rtmpInputUrl: rtmpUrl('stream.broadcastsn.com', stream.inputPort, 'live', stream.streamKey || stream.id),
            rtmpOutputUrl:
              stream.outputPort > 0
                ? rtmpUrl('stream.broadcastsn.com', stream.outputPort, 'live', `${stream.id}_out`)
                : undefined,
          }
        } catch {
          return {
            ...stream,
            mode: stream.mode || 'hls',
            status: 'inactive' as const,
            uptime: 'N/A',
            cpu: 0,
            memory: '0 MB',
            rtmpInputUrl: rtmpUrl('stream.broadcastsn.com', stream.inputPort, 'live', stream.streamKey || stream.id),
            rtmpOutputUrl:
              stream.outputPort > 0
                ? rtmpUrl('stream.broadcastsn.com', stream.outputPort, 'live', `${stream.id}_out`)
                : undefined,
          }
        }
      })
    )
    
    return NextResponse.json({ streams: enrichedStreams })
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message || 'Erreur lors de la récupération des streams RTMP' },
      { status: 500 }
    )
  }
}

// POST - Créer un nouveau stream RTMP
async function postHandler(request: NextRequest) {
  const __auth = await requireRole('stream:create')(request)
  if (!__auth.ok) return __auth.response

  try {
    const raw = await request.json().catch(() => null)
    const parsed = rtmpCreateBodySchema.safeParse(raw)
    if (!parsed.success) {
      return zodErrorResponse(parsed.error)
    }
    const body = parsed.data
    const { name, inputPort, outputPort, streamKey, mode: modeRaw, restreamOutputUrl: restreamUrlRaw } = body

    const mode = modeRaw === 'restream' ? 'restream' : 'hls'
    const restreamOutputUrl =
      typeof restreamUrlRaw === 'string' ? restreamUrlRaw.trim() : ''

    if (!name || !inputPort) {
      return NextResponse.json(
        { error: 'Paramètres manquants: name et inputPort sont requis' },
        { status: 400 }
      )
    }

    if (mode === 'restream') {
      if (!restreamOutputUrl.startsWith('rtmp://') && !restreamOutputUrl.startsWith('rtmps://')) {
        return NextResponse.json(
          { error: 'restreamOutputUrl doit commencer par rtmp:// ou rtmps://' },
          { status: 400 }
        )
      }
      if (restreamOutputUrl.includes("'") || restreamOutputUrl.includes('\n')) {
        return NextResponse.json({ error: 'URL de sortie invalide (caractères interdits)' }, { status: 400 })
      }
    } else if (!outputPort) {
      return NextResponse.json(
        { error: 'Paramètres manquants: outputPort est requis pour le mode HLS' },
        { status: 400 }
      )
    }

    // Port entrée et sortie doivent être différents en mode HLS
    if (mode === 'hls' && Number(inputPort) === Number(outputPort)) {
      return NextResponse.json(
        { error: "Le port d'entrée et le port de sortie doivent être différents (ex: 1935 et 1936)" },
        { status: 400 }
      )
    }

    const existingStreams = await getRTMPStreams()
    const outNum = Number(outputPort)
    const portTaken = existingStreams.some((s) => {
      if (s.inputPort === Number(inputPort)) return true
      if (mode === 'hls' && outNum > 0 && s.outputPort === outNum) return true
      return false
    })
    if (portTaken) {
      return NextResponse.json({ error: 'Un stream utilise déjà un de ces ports' }, { status: 409 })
    }

    // Vérifier que les ports ne sont pas utilisés par les services SRT
    const srtPorts = [6000, 6001, 6002, 6003, 6004, 6005, 6006]
    if (srtPorts.includes(inputPort) || (outputPort != null && srtPorts.includes(outputPort))) {
      return NextResponse.json(
        { error: 'Ces ports sont réservés pour les services SRT' },
        { status: 409 }
      )
    }
    
    const streamId = name.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '')
    const serviceName = `rtmp-${streamId}.service`

    if (await systemctlListUnitsHasService(serviceName)) {
      return NextResponse.json(
        { error: 'Un stream avec ce nom existe déjà' },
        { status: 409 }
      )
    }

    // Créer le répertoire de travail, logs et HLS (obligatoire pour systemd WorkingDirectory)
    const workDir = `/srv/rtmp-${streamId}`
    const logDir = `${workDir}/logs`
    const hlsDir = `${workDir}/hls`
    await mkdir(logDir, { recursive: true })
    if (mode === 'hls') {
      await mkdir(hlsDir, { recursive: true })
    }
    if (mode === 'restream') {
      await writeFile(`${workDir}/restream.url`, restreamOutputUrl, 'utf8')
    }

    const rtmpApp = 'live'
    const rtmpStream = streamKey || streamId

    const scriptContent =
      mode === 'restream'
        ? `#!/bin/bash

# RTMP → RTMP (copy) - ${name}
LOG_DIR="${logDir}"
WORK_DIR="${workDir}"
RTMP_INPUT_PORT="${inputPort}"
RTMP_APP="${rtmpApp}"
RTMP_STREAM="${rtmpStream}"
STREAM_ID="${streamId}"
URL_FILE="$WORK_DIR/restream.url"

mkdir -p "$LOG_DIR"
RESTREAM_URL=$(tr -d '\\n' < "$URL_FILE")

log() {
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] $1" >> "$LOG_DIR/ffmpeg.log"
}

log "=== Démarrage restream RTMP ${name} ==="
pkill -f "ffmpeg.*\${RTMP_INPUT_PORT}.*\${STREAM_ID}" 2>/dev/null
sleep 2

while true; do
  if lsof -i :\${RTMP_INPUT_PORT} >/dev/null 2>&1; then
    log "Port \${RTMP_INPUT_PORT} occupé, attente 5s..."
    sleep 5
    continue
  fi
  log "En attente encodeur RTMP puis push copy vers destination"
  ffmpeg -hide_banner -loglevel warning \\
    -fflags +genpts+igndts+discardcorrupt \\
    -err_detect ignore_err \\
    -listen 1 \\
    -timeout 5000000 \\
    -i "rtmp://0.0.0.0:\${RTMP_INPUT_PORT}/\${RTMP_APP}/\${RTMP_STREAM}" \\
    -c copy \\
    -f flv \\
    "$RESTREAM_URL" \\
    2>> "$LOG_DIR/ffmpeg.log"
  EXIT_CODE=$?
  log "FFmpeg exit $EXIT_CODE — retry 3s"
  sleep 3
done
`
        : `#!/bin/bash

# Script de streaming RTMP → HLS - ${name}
# Entrée RTMP (encodeur) → FFmpeg → sortie HLS (fichiers)

LOG_DIR="${logDir}"
HLS_DIR="${hlsDir}"
RTMP_INPUT_PORT="${inputPort}"
RTMP_APP="${rtmpApp}"
RTMP_STREAM="${rtmpStream}"
STREAM_ID="${streamId}"

mkdir -p "$LOG_DIR" "$HLS_DIR"

log() {
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] $1" >> "$LOG_DIR/ffmpeg.log"
}

log "=== Démarrage du service RTMP ${name} ==="

# Nettoyage des processus zombies
pkill -f "ffmpeg.*\${RTMP_INPUT_PORT}.*\${STREAM_ID}" 2>/dev/null
sleep 2

# Boucle: en cas de déconnexion encodeur, on réécoute au lieu de quitter
while true; do
  # Vérifier que le port input est libre
  if lsof -i :\${RTMP_INPUT_PORT} >/dev/null 2>&1; then
    log "Port \${RTMP_INPUT_PORT} occupé, attente 5s..."
    sleep 5
    continue
  fi

  log "Port \${RTMP_INPUT_PORT} libre - en attente d'un encodeur (OBS, etc.)"
  log "Démarrage FFmpeg: RTMP (\${RTMP_INPUT_PORT}) → HLS (\${HLS_DIR})"

  ffmpeg -hide_banner -loglevel warning \\
    -fflags +genpts+igndts+discardcorrupt \\
    -err_detect ignore_err \\
    -listen 1 \\
    -timeout 5000000 \\
    -i "rtmp://0.0.0.0:\${RTMP_INPUT_PORT}/\${RTMP_APP}/\${RTMP_STREAM}" \\
    -c:v libx264 \\
    -preset veryfast \\
    -tune zerolatency \\
    -threads 0 \\
    -thread_type slice \\
    -crf 23 \\
    -maxrate 2500k \\
    -bufsize 5000k \\
    -g 50 \\
    -sc_threshold 0 \\
    -keyint_min 50 \\
    -flags +global_header \\
    -c:a aac \\
    -b:a 128k \\
    -ar 44100 \\
    -ac 2 \\
    -f hls \\
    -hls_time 2 \\
    -hls_list_size 6 \\
    -hls_flags delete_segments+append_list \\
    -hls_segment_filename "\${HLS_DIR}/seg_%03d.ts" \\
    "\${HLS_DIR}/stream.m3u8" \\
    2>> "$LOG_DIR/ffmpeg.log"

  EXIT_CODE=$?
  log "FFmpeg s'est arrêté avec le code: $EXIT_CODE"
  if [ $EXIT_CODE -ne 0 ]; then
    log "Erreur ou déconnexion - nouvelle tentative dans 3s"
  fi
  sleep 3
done
`
    
    const scriptPath = `/usr/local/bin/rtmp-${streamId}.sh`
    await writeFile(scriptPath, scriptContent)
    await chmodPlusX(scriptPath)
    
    const serviceContent = `[Unit]
Description=${name} RTMP (${mode === 'restream' ? 'RTMP copy restream' : 'RTMP to HLS'})
After=network.target

[Service]
Type=simple
User=root
WorkingDirectory=/srv/rtmp-${streamId}
ExecStart=${scriptPath}
Restart=always
RestartSec=10
StandardOutput=journal
StandardError=journal

# Limites de ressources
LimitNOFILE=65536
MemoryMax=300M
CPUQuota=50%
TasksMax=30

[Install]
WantedBy=multi-user.target
`
    
    const servicePath = `/etc/systemd/system/${serviceName}`
    await writeFile(servicePath, serviceContent)
    
    await ufwAllowTcpQuiet(inputPort, `RTMP ${name} Input`)
    if (mode === 'hls' && outputPort != null) {
      await ufwAllowTcpQuiet(outputPort, `RTMP ${name} Output`)
    }

    await systemctlDaemonReload()
    await systemctlEnable(serviceName)
    await systemctlStart(serviceName)
    
    // Ajouter le stream à la liste
    const newStream: RTMPStream = {
      id: streamId,
      name,
      inputPort,
      outputPort: mode === 'restream' ? 0 : Number(outputPort),
      streamKey: streamKey || undefined,
      service: serviceName,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      mode,
    }
    
    const streams = await getRTMPStreams()
    streams.push(newStream)
    await saveRTMPStreams(streams)
    
    return NextResponse.json({
      success: true,
      stream: newStream,
      message:
        mode === 'restream'
          ? 'Stream RTMP restream (copy) créé — URL de sortie dans /srv/rtmp-' + streamId + '/restream.url'
          : 'Stream RTMP créé avec succès',
      restreamOutputUrl: mode === 'restream' ? restreamOutputUrl : undefined,
    })
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message || 'Erreur lors de la création du stream RTMP' },
      { status: 500 }
    )
  }
}

export const POST = withAudit('stream:create', postHandler)

