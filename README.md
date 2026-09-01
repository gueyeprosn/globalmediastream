# Global Media Streaming — Broadcast SN

Plateforme de régie live sur VPS (streaming vidéo/radio, Stream Control Center, appttv, scripts d'infra).

## Structure

- [`tv-radio-app/`](tv-radio-app/) — Stream Control Center (dashboard Next.js, PM2 `oceanfm-app`, port 3000)
- [`appttv/`](appttv/) — Application dédicaces Touba TV (PayDunya + vMix, PM2 `touba-appttv`, port 3010)
- [`global-media-streaming/`](global-media-streaming/) — Scripts d'installation et de configuration d'infrastructure (Icecast, Nginx, systemd)

Chaque dossier reste synchronisable indépendamment avec son propre déploiement en production (`/srv/tv-radio-app`, `/opt/toubatv/appttv`, `/srv/global-media-streaming` sur le VPS).

**Secrets** : aucun `.env` réel n'est versionné — voir les `.env.example` de chaque dossier pour les variables requises.
