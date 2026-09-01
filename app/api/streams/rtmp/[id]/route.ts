import { NextRequest, NextResponse } from 'next/server'
import { readFile, writeFile, unlink, mkdir } from 'fs/promises'
import { existsSync } from 'fs'
import { requireAuth } from '@/lib/require-auth'
import { requireRole } from '@/lib/rbac'
import {
  assertRtmpScriptPath,
  assertSafeStreamRouteId,
  chmodPlusX,
  systemctlDaemonReload,
  systemctlDisable,
  systemctlIsActive,
  systemctlStart,
  systemctlStop,
  toSafeServiceUnit,
  ufwAllowTcpQuiet,
  ufwDeleteAllowTcpQuiet,
} from '@/lib/safe-shell'
import { rtmpUpdateBodySchema } from '@/lib/schemas/rtmp-streams'
import { zodErrorResponse } from '@/lib/zod-response'
import { pushStreamHistory } from '@/lib/stream-history'

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
  outputPort: number
  streamKey?: string
  service: string
  createdAt: string
  updatedAt: string
}

async function getRTMPStreams(): Promise<RTMPStream[]> {
  try {
    const content = await readFile(RTMP_STREAMS_FILE, 'utf-8')
    return JSON.parse(content)
  } catch {
    return []
  }
}

async function saveRTMPStreams(streams: RTMPStream[]) {
  await writeFile(RTMP_STREAMS_FILE, JSON.stringify(streams, null, 2))
}

// GET - Récupérer un stream RTMP spécifique
export async function GET(request: NextRequest,
  { params }: { params: Promise<{ id: string }> }){
  const __auth = await requireAuth(request)
  if (!__auth.ok) return __auth.response

  const { id } = await params
  try {
    assertSafeStreamRouteId(id)
    const streams = await getRTMPStreams()
    const stream = streams.find(s => s.id === id)
    
    if (!stream) {
      return NextResponse.json(
        { error: 'Stream non trouvé' },
        { status: 404 }
      )
    }
    
    // Enrichir avec le statut du service
    try {
      const unit = toSafeServiceUnit(stream.service)
      const status = (await systemctlIsActive(unit)).trim()
      
      return NextResponse.json({
        ...stream,
        status: status === 'active' ? 'active' : 'inactive',
        rtmpInputUrl: rtmpUrl('stream.broadcastsn.com', stream.inputPort, 'live', stream.streamKey || stream.id),
        rtmpOutputUrl: rtmpUrl('stream.broadcastsn.com', stream.outputPort, 'live', `${stream.id}_out`),
      })
    } catch {
      return NextResponse.json({
        ...stream,
        status: 'inactive' as const,
        rtmpInputUrl: rtmpUrl('stream.broadcastsn.com', stream.inputPort, 'live', stream.streamKey || stream.id),
        rtmpOutputUrl: rtmpUrl('stream.broadcastsn.com', stream.outputPort, 'live', `${stream.id}_out`),
      })
    }
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message || 'Erreur lors de la récupération du stream' },
      { status: 500 }
    )
  }
}

// PUT - Modifier un stream RTMP
export async function PUT(request: NextRequest,
  { params }: { params: Promise<{ id: string }> }){
  const __auth = await requireRole('stream:update')(request)
  if (!__auth.ok) return __auth.response

  const { id } = await params
  try {
    assertSafeStreamRouteId(id)
    const raw = await request.json().catch(() => null)
    const parsed = rtmpUpdateBodySchema.safeParse(raw)
    if (!parsed.success) {
      return zodErrorResponse(parsed.error)
    }
    const { name, inputPort, outputPort, streamKey } = parsed.data
    
    const streams = await getRTMPStreams()
    const streamIndex = streams.findIndex(s => s.id === id)
    
    if (streamIndex === -1) {
      return NextResponse.json(
        { error: 'Stream non trouvé' },
        { status: 404 }
      )
    }
    
    const stream = streams[streamIndex]
    const newInputPort = inputPort ?? stream.inputPort
    const newOutputPort = outputPort ?? stream.outputPort

    if (Number(newInputPort) === Number(newOutputPort)) {
      return NextResponse.json(
        { error: 'Le port d\'entrée et le port de sortie doivent être différents (ex: 1935 et 1936)' },
        { status: 400 }
      )
    }

    // Vérifier que les nouveaux ports ne sont pas utilisés par d'autres streams
    if (inputPort && inputPort !== stream.inputPort) {
      if (streams.some(s => s.id !== id && s.inputPort === inputPort)) {
        return NextResponse.json(
          { error: 'Le port input est déjà utilisé' },
          { status: 409 }
        )
      }
    }
    
    if (outputPort && outputPort !== stream.outputPort) {
      if (streams.some(s => s.id !== id && s.outputPort === outputPort)) {
        return NextResponse.json(
          { error: 'Le port output est déjà utilisé' },
          { status: 409 }
        )
      }
    }
    
    await pushStreamHistory(id, 'rtmp', { ...stream })
    await systemctlStop(toSafeServiceUnit(stream.service)).catch(() => {})

    // S'assurer que le répertoire de travail, logs et HLS existent (obligatoire pour systemd)
    const workDir = `/srv/rtmp-${id}`
    await mkdir(`${workDir}/logs`, { recursive: true })
    await mkdir(`${workDir}/hls`, { recursive: true })
    
    // Mettre à jour le stream
    const updatedStream: RTMPStream = {
      ...stream,
      name: name || stream.name,
      inputPort: inputPort || stream.inputPort,
      outputPort: outputPort || stream.outputPort,
      streamKey: streamKey !== undefined ? streamKey : stream.streamKey,
      updatedAt: new Date().toISOString(),
    }
    
    // Recréer le script RTMP → HLS (même logique que création)
    const logDir = `/srv/rtmp-${updatedStream.id}/logs`
    const hlsDir = `/srv/rtmp-${updatedStream.id}/hls`
    const rtmpApp = 'live'
    const rtmpStream = updatedStream.streamKey || updatedStream.id
    
    const scriptContent = `#!/bin/bash

# Script de streaming RTMP → HLS - ${updatedStream.name}
# Entrée RTMP (encodeur) → FFmpeg → sortie HLS (fichiers)

LOG_DIR="${logDir}"
HLS_DIR="${hlsDir}"
RTMP_INPUT_PORT="${updatedStream.inputPort}"
RTMP_APP="${rtmpApp}"
RTMP_STREAM="${rtmpStream}"
STREAM_ID="${updatedStream.id}"

mkdir -p "$LOG_DIR" "$HLS_DIR"

log() {
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] $1" >> "$LOG_DIR/ffmpeg.log"
}

log "=== Démarrage du service RTMP ${updatedStream.name} ==="

# Nettoyage des processus zombies
pkill -f "ffmpeg.*\${RTMP_INPUT_PORT}.*\${STREAM_ID}" 2>/dev/null
sleep 2

# Boucle: en cas de déconnexion encodeur, on réécoute au lieu de quitter
while true; do
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
    
    const scriptPath = assertRtmpScriptPath(updatedStream.id)
    await writeFile(scriptPath, scriptContent)
    await chmodPlusX(scriptPath)
    
    // Mettre à jour le service systemd
    const serviceContent = `[Unit]
Description=${updatedStream.name} RTMP Streaming Service (RTMP to HLS)
After=network.target

[Service]
Type=simple
User=root
WorkingDirectory=/srv/rtmp-${updatedStream.id}
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
    
    const servicePath = `/etc/systemd/system/${stream.service}`
    await writeFile(servicePath, serviceContent)
    
    // Mettre à jour le firewall si les ports ont changé
    if (inputPort && inputPort !== stream.inputPort) {
      await ufwDeleteAllowTcpQuiet(stream.inputPort)
      await ufwAllowTcpQuiet(inputPort, `RTMP ${updatedStream.name} Input`)
    }

    if (outputPort && outputPort !== stream.outputPort) {
      await ufwDeleteAllowTcpQuiet(stream.outputPort)
      await ufwAllowTcpQuiet(outputPort, `RTMP ${updatedStream.name} Output`)
    }

    await systemctlDaemonReload()
    await systemctlStart(toSafeServiceUnit(stream.service))
    
    // Sauvegarder
    streams[streamIndex] = updatedStream
    await saveRTMPStreams(streams)
    
    return NextResponse.json({
      success: true,
      stream: updatedStream,
      message: 'Stream RTMP modifié avec succès',
    })
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message || 'Erreur lors de la modification du stream' },
      { status: 500 }
    )
  }
}

// DELETE - Supprimer un stream RTMP
export async function DELETE(request: NextRequest,
  { params }: { params: Promise<{ id: string }> }){
  const __auth = await requireRole('stream:delete')(request)
  if (!__auth.ok) return __auth.response

  const { id } = await params
  try {
    assertSafeStreamRouteId(id)
    const streams = await getRTMPStreams()
    const streamIndex = streams.findIndex(s => s.id === id)
    
    if (streamIndex === -1) {
      return NextResponse.json(
        { error: 'Stream non trouvé' },
        { status: 404 }
      )
    }
    
    const stream = streams[streamIndex]
    const unit = toSafeServiceUnit(stream.service)

    await systemctlStop(unit).catch(() => {})
    await systemctlDisable(unit).catch(() => {})
    
    // Supprimer les fichiers
    const scriptPath = `/usr/local/bin/rtmp-${stream.id}.sh`
    const servicePath = `/etc/systemd/system/${stream.service}`
    
    try {
      await unlink(scriptPath)
    } catch {}
    
    try {
      await unlink(servicePath)
    } catch {}
    
    await ufwDeleteAllowTcpQuiet(stream.inputPort)
    if (stream.outputPort > 0) {
      await ufwDeleteAllowTcpQuiet(stream.outputPort)
    }

    await systemctlDaemonReload()
    
    // Retirer de la liste
    streams.splice(streamIndex, 1)
    await saveRTMPStreams(streams)
    
    return NextResponse.json({
      success: true,
      message: 'Stream RTMP supprimé avec succès',
    })
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message || 'Erreur lors de la suppression du stream' },
      { status: 500 }
    )
  }
}

