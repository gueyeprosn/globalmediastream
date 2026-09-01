# TOUBA TV — Admin web + vMix XML

**URL publique :** https://stream.broadcastsn.com/appttv

> **Architecture :** messages → **Firebase Firestore** · photos → **Google Drive**  
> Voir [deploy/ARCHITECTURE-MESSAGES-PHOTOS.md](deploy/ARCHITECTURE-MESSAGES-PHOTOS.md)

> ⚠️ Toutes les commandes `npm` / `pm2` se lancent dans le dossier **`appttv/`**, pas à la racine du repo.

## Installation rapide

```bash
cd "/chemin/vers/TTV APP DEDICACE/appttv"
cp .env.example .env
nano .env          # FIREBASE_WEB_APP_ID + VMIX_DS_TOKEN
chmod +x scripts/install.sh
./scripts/install.sh
```

## Fichier `.env`

Sections dans `.env.example` :

| Section | Variables |
|---------|-----------|
| Serveur | `PORT=3010`, `PUBLIC_BASE_URL`, `BASE_PATH` |
| Live | `LIVE_HLS_URL` |
| Firebase Admin | `GOOGLE_APPLICATION_CREDENTIALS`, `FIREBASE_PROJECT_ID` |
| Firebase Web (Google login) | `FIREBASE_WEB_APP_ID`, `FIREBASE_API_KEY`, … |
| vMix | `VMIX_DS_TOKEN` |

## Nginx (stream.broadcastsn.com)

Sur le VPS :

```bash
sudo cp deploy/nginx-includes/appttv.conf /etc/nginx/snippets/appttv.conf
```

Dans le `server { }` HTTPS existant de `stream.broadcastsn.com`, ajouter **une ligne** :

```nginx
include /etc/nginx/snippets/appttv.conf;
```

Puis :

```bash
sudo nginx -t && sudo systemctl reload nginx
```

Exemple complet : `deploy/stream.broadcastsn.com-snippet.conf`

## PM2

```bash
npm install -g pm2    # si absent
cd appttv
pm2 start ecosystem.config.cjs
pm2 save
```

## Firebase (avant le premier login)

1. Auth → **Google** activé  
2. Domaines autorisés → `stream.broadcastsn.com`  
3. App **Web** créée → `FIREBASE_WEB_APP_ID` dans `.env`  
4. Firestore `admins/{UID}` → `{ "active": true }`  
5. Clé compte de service → `/opt/toubatv/service-account.json`

## URLs vMix

| Usage | URL |
|-------|-----|
| Fichier XML | `https://stream.broadcastsn.com/appttv/vmix/current.xml?token=TOKEN` |
| FIFO auto | `https://stream.broadcastsn.com/appttv/api/vmix/datasource.xml?token=TOKEN` |
