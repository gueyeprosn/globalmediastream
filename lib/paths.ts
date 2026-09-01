/** Racine des données streaming sur le VPS (ex. /srv ou /opt/streaming). */
export function getStreamingBasePath(): string {
  return (process.env.STREAMING_BASE_PATH || '/srv').replace(/\/$/, '')
}

export function getSrtStreamsRegistryPath(): string {
  return process.env.SRT_STREAMS_REGISTRY_PATH || `${getStreamingBasePath()}/srt-streams.json`
}
