# Exploitation — Stream Control Center (tv-radio-app)

Doc globale : `/srv/DOCUMENTATION_COMPLETE.md`.  
Dernière alignement : 2026-08-09.

## Prérequis hôte

- Linux avec **systemd**, **ufw** (ou équivalent), droits pour unités et écriture sous `/etc/systemd/system`, `/usr/local/bin`, `/srv`.
- Binaires : `ffmpeg`, `systemctl`, `journalctl`, `ufw`, `bash`, `srt-live-transmit` (External TV).
- Chemins : enregistrements (`RECORDINGS_DIR`, défaut `/srv/recordings`), HLS `/srv/rtmp-hls`, registres SRT/RTMP sous `/srv`.

## Variables d’environnement

| Variable | Rôle |
|----------|------|
| `ADMIN_PASSWORD_HASH` | Hash bcrypt admin (recommandé). |
| `ADMIN_PASSWORD` | Repli clair (éviter en prod). |
| `JWT_SECRET` | Signature JWT (obligatoire). |
| `RECORDINGS_DIR` | Enregistrements. |
| `STREAMING_BASE_PATH` | Racine données (défaut `/srv`). |
| `SRT_STREAMS_REGISTRY_PATH` | Registre SRT. |
| `GEOLITE2_COUNTRY_PATH` | GeoIP MaxMind (optionnel, pays viewers). |
| `NGINX_ACCESS_LOG` | Logs HLS viewers (défaut `/var/log/nginx/access.log`). |
| `NODE_ENV` | Cookie `Secure` en production. |

## Auth

- `POST /api/auth/login` — rate-limit IP (`lib/login-rate-limit.ts`).
- JWT : Bearer et/ou cookie httpOnly `admin_token`.
- `POST /api/auth/logout`.

## Corrélation

- Réponses API : `x-request-id` (`lib/logger.ts`).

## Trafic & KPI

- UI : `/traffic`
- API : `GET /api/traffic`
- Sources : SRS clients/streams, systemd pipelines, logs External TV SRT, viewers HLS Nginx.
- Code : `lib/traffic/`, `components/traffic/traffic-dashboard.tsx`.

## Déploiement

```bash
cd /srv/tv-radio-app
npm run deploy
# = npm run build && pm2 restart oceanfm-app --update-env
```

Sans restart après `build` → chunks `/_next/static` en **500**, login cassé.  
Hard refresh navigateur. Nginx HTML : `Cache-Control: no-cache` sur `/`.

```bash
sudo nginx -t && sudo systemctl reload nginx
```

## Tests

```bash
cd /srv/tv-radio-app && npm test
```
