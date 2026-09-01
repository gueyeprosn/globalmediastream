# Checklist déploiement — cocher au fur et à mesure

## Firebase (console)

- [ ] Google Sign-In activé
- [ ] Domaine `stream.broadcastsn.com` autorisé
- [ ] App Web créée → `FIREBASE_WEB_APP_ID` noté
- [ ] `service-account.json` téléchargé
- [ ] `admins/{mon UID Google}` → `{ "active": true }`

## Pack local

- [ ] `./scripts/package-for-vps.sh` exécuté
- [ ] Archive `deploy/out/appttv-vps.zip` créée

## VPS — fichiers

- [ ] `/opt/toubatv/appttv/` extrait ou uploadé
- [ ] `/opt/toubatv/service-account.json` (chmod 600)
- [ ] `/opt/toubatv/appttv/.env` rempli (chmod 600)
- [ ] `VMIX_DS_TOKEN` généré (`openssl rand -hex 32`)

## VPS — logiciels

- [ ] Node.js 20+
- [ ] PM2 installé (`npm i -g pm2`)
- [ ] Nginx actif

## Installation

- [ ] `./scripts/install.sh` OK
- [ ] `./scripts/post-install-vps.sh` OK
- [ ] `pm2 status` → touba-appttv online

## Nginx

- [ ] `/etc/nginx/snippets/appttv.conf` copié
- [ ] `include` ajouté au vhost stream.broadcastsn.com
- [ ] `nginx -t` OK + reload

## Tests

- [ ] `curl https://stream.broadcastsn.com/appttv/health` → `"ok":true`
- [ ] Login Google sur /appttv
- [ ] Message test visible en modération
- [ ] URL XML vMix copiée dans vMix (refresh 5 s)
