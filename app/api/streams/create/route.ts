import { NextRequest, NextResponse } from 'next/server'
import { writeFile, chmod, readFile } from 'fs/promises'
import { existsSync, mkdirSync } from 'fs'
import { allocateSrtUdpPorts, collectUsedSrtPorts, isNativeSrsSrtPort } from '@/lib/srt-ports'
import { buildSrtListenerUrl } from '@/lib/srt-url'
import { getSrtStreamsRegistryPath } from '@/lib/paths'
import { requireRole } from '@/lib/rbac'
import {
  assertSafeStreamSlug,
  assertTcpUdpPort,
  systemctlDaemonReload,
  systemctlEnable,
  systemctlListUnitsHasService,
  systemctlStart,
  ufwAllowTcp,
  ufwAllowUdp,
} from '@/lib/safe-shell'
import { streamCreateBodySchema } from '@/lib/schemas/stream-create'
import { zodErrorResponse } from '@/lib/zod-response'
import { pushStreamHistory } from '@/lib/stream-history'

interface SrtStreamRegistryItem {
  id: string
  name: string
  service: string
  inputPort: number
  outputPort?: number
  outputPorts?: number[]
  streamId?: string
  latencyMs?: number
  srtCopy?: boolean
  hlsUrl?: string
  createdAt: string
  updatedAt: string
}

async function getSrtStreamRegistry(): Promise<SrtStreamRegistryItem[]> {
  const SRT_STREAMS_FILE = getSrtStreamsRegistryPath()
  try {
    if (!existsSync(SRT_STREAMS_FILE)) return []
    const content = await readFile(SRT_STREAMS_FILE, 'utf-8')
    const parsed = JSON.parse(content)
    return Array.isArray(parsed) ? parsed : []
  } catch {
    return []
  }
}

async function saveSrtStreamRegistry(streams: SrtStreamRegistryItem[]) {
  await writeFile(getSrtStreamsRegistryPath(), JSON.stringify(streams, null, 2))
}

export async function POST(request: NextRequest){
  const __auth = await requireRole('stream:create')(request)
  if (!__auth.ok) return __auth.response

  try {
    const raw = await request.json().catch(() => null)
    const parsed = streamCreateBodySchema.safeParse(raw)
    if (!parsed.success) {
      return zodErrorResponse(parsed.error)
    }
    const body = parsed.data
    const {
      name,
      type,
      inputPort: inputPortRaw,
      outputPort: outputPortRaw,
      streamKey,
      srtMode,
      autoPort: autoPortRaw,
      passphrase: passphraseRaw,
      streamId: srtStreamIdBody,
      latency: latencyRaw,
      srtCopy: srtCopyRaw,
      outputs: outputsBody,
    } = body

    const autoPort = Boolean(autoPortRaw)
    const passphrase = typeof passphraseRaw === 'string' ? passphraseRaw : ''
    const srtStreamIdOpt = typeof srtStreamIdBody === 'string' ? srtStreamIdBody.trim() : ''
    const latencyMs = Number.isFinite(Number(latencyRaw)) ? Number(latencyRaw) : 2000
    const srtCopy = Boolean(srtCopyRaw)

    if (type === 'rtmp' && (inputPortRaw == null || inputPortRaw === '')) {
      return NextResponse.json({ error: 'Port RTMP requis' }, { status: 400 })
    }

    let inputPort = inputPortRaw != null && inputPortRaw !== '' ? Number(inputPortRaw) : NaN
    
    const streamId = name.toLowerCase().trim().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '')
    try {
      assertSafeStreamSlug(streamId)
    } catch {
      return NextResponse.json({ error: 'Nom de flux invalide' }, { status: 400 })
    }
    const serviceName = `${streamId}.service`

    if (await systemctlListUnitsHasService(serviceName)) {
      return NextResponse.json({ error: 'Un flux avec ce nom existe déjà' }, { status: 409 })
    }
    
    if (type === 'rtmp') {
      // Créer un flux RTMP
      const hlsDir = `/srv/rtmp-hls/${streamId}`
      const logDir = `/srv/${streamId}/logs`
      
      // Créer les dossiers
      if (!existsSync(hlsDir)) mkdirSync(hlsDir, { recursive: true })
      if (!existsSync(logDir)) mkdirSync(logDir, { recursive: true })
      
      // Créer le script
      const rtmpApp = 'live'
      const rtmpStream = streamKey || streamId
      
      const scriptContent = `#!/bin/bash

# Script de streaming ${name}
# RTMP Input → FFmpeg → HLS

HLS_DIR="${hlsDir}"
LOG_DIR="${logDir}"
RTMP_INPUT_PORT="${inputPort}"
RTMP_APP="${rtmpApp}"
RTMP_STREAM="${rtmpStream}"

mkdir -p "$HLS_DIR" "$LOG_DIR"
rm -f "$HLS_DIR"/*.ts "$HLS_DIR"/*.m3u8

ffmpeg -hide_banner -loglevel warning \\
    -fflags +genpts+igndts \\
    -err_detect ignore_err \\
    -listen 1 \\
    -i "rtmp://0.0.0.0:${inputPort}/${rtmpApp}/${rtmpStream}" \\
    -c:v libx264 \\
    -preset veryfast \\
    -tune zerolatency \\
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
    -hls_time 4 \\
    -hls_list_size 20 \\
    -hls_delete_threshold 10 \\
    -hls_flags delete_segments+independent_segments \\
    -hls_segment_filename "$HLS_DIR/segment_%03d.ts" \\
    -master_pl_name "index.m3u8" \\
    -hls_allow_cache 0 \\
    "$HLS_DIR/index.m3u8" \\
    >> "$LOG_DIR/ffmpeg.log" 2>&1
`
      
      const scriptPath = `/usr/local/bin/${streamId}.sh`
      await writeFile(scriptPath, scriptContent)
      await chmod(scriptPath, 0o755)
      
      // Créer le service systemd
      const serviceContent = `[Unit]
Description=${name} Streaming Service (RTMP to HLS)
After=network.target

[Service]
Type=simple
User=root
WorkingDirectory=/srv/${streamId}
ExecStart=${scriptPath}
Restart=always
RestartSec=10
StandardOutput=journal
StandardError=journal
LimitNOFILE=65536

[Install]
WantedBy=multi-user.target
`
      
      const servicePath = `/etc/systemd/system/${serviceName}`
      await writeFile(servicePath, serviceContent)
      
      await ufwAllowTcp(assertTcpUdpPort(inputPort), `RTMP ${name}`)

      await systemctlDaemonReload()
      await systemctlEnable(serviceName)
      await systemctlStart(serviceName)
      
      // Ajouter la configuration Nginx (nécessite modification manuelle ou script)
      
      return NextResponse.json({
        success: true,
        id: streamId,
        service: serviceName,
        ingestUrl: `rtmp://stream.broadcastsn.com:${inputPort}/${rtmpApp}/${rtmpStream}`,
        playbackUrl: `https://stream.broadcastsn.com/rtmp-hls/${streamId}/stream.m3u8`,
        healthUrl: `/api/streams/${streamId}/health`,
        message: 'Flux RTMP créé avec succès',
      })
    } else if (type === 'srt') {
      const mode: 'relay' | 'hls' = srtMode === 'hls' ? 'hls' : 'relay'

      let relayOutputPorts: number[] = []
      if (mode === 'relay') {
        if (Array.isArray(outputsBody) && outputsBody.length > 0) {
          relayOutputPorts = outputsBody
            .map((o: { port?: number }) => Number(o?.port))
            .filter((n: number) => Number.isFinite(n) && n > 0)
        } else if (outputPortRaw != null && outputPortRaw !== '') {
          relayOutputPorts = [Number(outputPortRaw)]
        }
      }

      const isNativeSrsPath =
        mode === 'hls' && isNativeSrsSrtPort(Number(inputPortRaw)) && !autoPort

      if (mode === 'hls' && isNativeSrsSrtPort(Number(inputPortRaw)) && autoPort) {
        return NextResponse.json(
          { error: 'Port SRT natif SRS (7100/7000): ne pas utiliser avec autoPort' },
          { status: 400 }
        )
      }

      const registryEarly = await getSrtStreamRegistry()
      const usedPorts = collectUsedSrtPorts(registryEarly)

      if (autoPort && !isNativeSrsPath) {
        try {
          const outCount = mode === 'relay' ? Math.max(1, relayOutputPorts.length || 1) : 0
          const total = mode === 'hls' ? 1 : 1 + outCount
          const allocated = allocateSrtUdpPorts(usedPorts, total)
          inputPort = allocated[0]
          if (mode === 'relay') {
            relayOutputPorts = allocated.slice(1)
          }
        } catch (e: any) {
          return NextResponse.json({ error: e.message || 'Allocation ports SRT impossible' }, { status: 400 })
        }
      } else {
        if (!Number.isFinite(inputPort) || inputPort <= 0) {
          return NextResponse.json({ error: 'Port SRT entrant invalide' }, { status: 400 })
        }
        if (mode === 'relay' && relayOutputPorts.length === 0) {
          return NextResponse.json(
            { error: 'Mode relay SRT: outputPort ou outputs[{port}] requis' },
            { status: 400 }
          )
        }
      }

      const needsPassphrase = !isNativeSrsPath
      if (needsPassphrase && !passphrase.trim()) {
        return NextResponse.json({ error: 'Passphrase SRT obligatoire' }, { status: 400 })
      }

      if (mode === 'relay') {
        const bad = relayOutputPorts.find((p) => p === inputPort)
        if (bad != null) {
          return NextResponse.json(
            { error: 'Les ports de sortie doivent être distincts du port entrant' },
            { status: 400 }
          )
        }
      }

      const logDir = `/srv/${streamId}/logs`
      if (!existsSync(logDir)) mkdirSync(logDir, { recursive: true })

      const srtInputPort = String(inputPort)
      const hlsDir = `/srv/${streamId}/hls`
      if (mode === 'hls' && !existsSync(hlsDir)) mkdirSync(hlsDir, { recursive: true })

      const hlsUrlForMode =
        mode === 'hls'
          ? isNativeSrsSrtPort(Number(inputPort))
            ? `https://stream.broadcastsn.com/live/${streamId}/index.m3u8`
            : `https://stream.broadcastsn.com/rtmp-hls/${streamId}/stream.m3u8`
          : undefined

      if (mode === 'hls' && isNativeSrsSrtPort(Number(inputPort))) {
        const registry = await getSrtStreamRegistry()
        const now = new Date().toISOString()
        const item: SrtStreamRegistryItem = {
          id: streamId,
          name,
          service: 'srs-native-7000',
          inputPort: Number(inputPort),
          hlsUrl: hlsUrlForMode,
          streamId: srtStreamIdOpt || undefined,
          latencyMs,
          createdAt: now,
          updatedAt: now,
        }
        const index = registry.findIndex((s) => s.id === streamId)
        if (index >= 0) {
          registry[index] = { ...registry[index], ...item, createdAt: registry[index].createdAt || now }
        } else {
          registry.push(item)
        }
        await saveSrtStreamRegistry(registry)

        const ingestQs = new URLSearchParams()
        if (srtStreamIdOpt) ingestQs.set('streamid', srtStreamIdOpt)
        const ingestSuffix = ingestQs.toString() ? `?${ingestQs.toString()}` : ''

        return NextResponse.json({
          success: true,
          id: streamId,
          service: 'srs-native-7000',
          ingestUrl: `srt://stream.broadcastsn.com:${inputPort}${ingestSuffix}`,
          playbackUrl: '',
          hlsUrl: hlsUrlForMode,
          healthUrl: `/api/streams/${streamId}/health`,
          srtMode: mode,
          message: 'Flux SRT créé avec succès',
        })
      }

      const inUrl = buildSrtListenerUrl('0.0.0.0', inputPort, {
        passphrase: passphrase.trim(),
        streamid: srtStreamIdOpt,
        latencyMs,
      })

      let scriptContent: string
      if (mode === 'hls') {
        const copyPart = srtCopy
          ? `    -c copy \\
    -f hls \\
    -hls_time 2 \\
    -hls_list_size 6 \\
    -hls_flags delete_segments+append_list \\
    -hls_segment_filename "$HLS_DIR/seg_%03d.ts" \\
    "$HLS_DIR/stream.m3u8" \\`
          : `    -c:v libx264 \\
    -preset veryfast \\
    -tune zerolatency \\
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
    -hls_segment_filename "$HLS_DIR/seg_%03d.ts" \\
    "$HLS_DIR/stream.m3u8" \\`

        scriptContent = `#!/bin/bash

# Script SRT vers HLS - ${name}
# Port ${srtInputPort}

LOG_DIR="${logDir}"
HLS_DIR="${hlsDir}"

mkdir -p "$LOG_DIR" "$HLS_DIR"
rm -f "$HLS_DIR"/*.ts "$HLS_DIR"/*.m3u8

ffmpeg -hide_banner -loglevel warning \\
    -fflags +genpts+igndts+discardcorrupt \\
    -err_detect ignore_err \\
    -i "${inUrl}" \\
${copyPart}
    >> "$LOG_DIR/ffmpeg.log" 2>&1
`
      } else {
        const outUrls = relayOutputPorts.map((p) =>
          buildSrtListenerUrl('0.0.0.0', p, {
            passphrase: passphrase.trim(),
            latencyMs,
          })
        )
        const maps = outUrls
          .map(
            (u) => `    -map 0 -c copy -f mpegts "${u}" \\`
          )
          .join('\n')

        scriptContent = `#!/bin/bash

# Relay SRT multi-sorties (copy) - ${name}
# Entrée UDP ${srtInputPort} -> sorties ${relayOutputPorts.join(', ')}

LOG_DIR="${logDir}"
mkdir -p "$LOG_DIR"

ffmpeg -hide_banner -loglevel warning \\
    -fflags +genpts+igndts+discardcorrupt \\
    -err_detect ignore_err \\
    -i "${inUrl}" \\
${maps}
    >> "$LOG_DIR/ffmpeg-relay.log" 2>&1
`
      }

      const scriptPath = `/usr/local/bin/${streamId}.sh`
      await writeFile(scriptPath, scriptContent)
      await chmod(scriptPath, 0o755)

      const serviceContent = `[Unit]
Description=${name} Streaming Service (${mode === 'hls' ? 'SRT to HLS' : 'SRT multi-relay'})
After=network.target

[Service]
Type=simple
User=root
WorkingDirectory=/srv/${streamId}
ExecStart=${scriptPath}
Restart=always
RestartSec=10
StandardOutput=journal
StandardError=journal
LimitNOFILE=65536

[Install]
WantedBy=multi-user.target
`

      const servicePath = `/etc/systemd/system/${serviceName}`
      await writeFile(servicePath, serviceContent)

      await ufwAllowUdp(assertTcpUdpPort(inputPort), `SRT ${name} Input`)
      if (mode === 'relay') {
        for (const p of relayOutputPorts) {
          await ufwAllowUdp(assertTcpUdpPort(p), `SRT ${name} Out ${p}`)
        }
      }

      await systemctlDaemonReload()
      await systemctlEnable(serviceName)
      await systemctlStart(serviceName)

      const registry = await getSrtStreamRegistry()
      const now = new Date().toISOString()
      const item: SrtStreamRegistryItem = {
        id: streamId,
        name,
        service: serviceName,
        inputPort: Number(inputPort),
        outputPort: mode === 'relay' ? relayOutputPorts[0] : undefined,
        outputPorts: mode === 'relay' ? relayOutputPorts : undefined,
        streamId: srtStreamIdOpt || undefined,
        latencyMs,
        srtCopy: mode === 'hls' ? srtCopy : undefined,
        hlsUrl: hlsUrlForMode,
        createdAt: now,
        updatedAt: now,
      }
      const index = registry.findIndex((s) => s.id === streamId || s.service === serviceName)
      if (index >= 0) {
        await pushStreamHistory(streamId, 'srt', { ...registry[index] })
        registry[index] = { ...registry[index], ...item, createdAt: registry[index].createdAt || now }
      } else {
        registry.push(item)
      }
      await saveSrtStreamRegistry(registry)

      const ingestUrlPublic = buildSrtListenerUrl('stream.broadcastsn.com', inputPort, {
        passphrase: passphrase.trim(),
        streamid: srtStreamIdOpt,
        latencyMs,
      })

      const playbackPrimary =
        mode === 'relay' && relayOutputPorts[0] != null
          ? buildSrtListenerUrl('stream.broadcastsn.com', relayOutputPorts[0], {
              passphrase: passphrase.trim(),
              latencyMs,
            })
          : ''

      return NextResponse.json({
        success: true,
        id: streamId,
        service: serviceName,
        ingestUrl: ingestUrlPublic,
        playbackUrl: playbackPrimary,
        playbackUrls:
          mode === 'relay'
            ? relayOutputPorts.map((p) =>
                buildSrtListenerUrl('stream.broadcastsn.com', p, {
                  passphrase: passphrase.trim(),
                  latencyMs,
                })
              )
            : [],
        hlsUrl: hlsUrlForMode || null,
        healthUrl: `/api/streams/${streamId}/health`,
        note:
          mode === 'hls'
            ? srtCopy
              ? 'SRT vers HLS sans transcodage (-c copy)'
              : 'Mode SRT vers HLS (transcodage libx264/AAC)'
            : `Relay SRT copy vers ${relayOutputPorts.length} destination(s)`,
        srtMode: mode,
        autoPort,
        message: 'Flux SRT créé avec succès',
      })
    }
    
    return NextResponse.json({ error: 'Type de flux non supporté' }, { status: 400 })
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message || 'Erreur lors de la création du flux' },
      { status: 500 }
    )
  }
}
