# Stockage VPS — messages et photos

Tous les messages et photos sont enregistrés **sur votre serveur** (plus besoin de Firestore ni Google Drive pour la persistance).

## Structure sur le disque

```
/opt/toubatv/appttv/data/vps/
├── messages/          # un fichier JSON par message
│   └── {uuid}.json
├── uploads/           # photos JPEG/PNG
│   └── {uuid}.jpg
└── audit/             # journal des actions admin
```

## Configuration `.env`

```env
VPS_STORAGE_ENABLED=true
VPS_DATA_DIR=/opt/toubatv/appttv/data/vps
PUBLIC_BASE_URL=https://stream.broadcastsn.com/appttv
GOOGLE_DRIVE_ENABLED=false
```

## URLs publiques

| Ressource | URL |
|-----------|-----|
| Santé API | `GET /appttv/health` |
| Envoi message + photo | `POST /appttv/api/messages/submit` |
| Photo seule | `POST /appttv/api/messages/photo` |
| Fichier photo | `GET /appttv/uploads/{fichier}.jpg` |
| Modération admin | `GET /appttv/api/admin/messages?status=queued` |
| vMix FIFO | `GET /appttv/api/vmix/datasource.xml?token=...` |

## Déploiement

1. Copier le nouveau code `appttv` sur le VPS
2. Mettre à jour `.env` (voir ci-dessus)
3. Créer le dossier et droits :
   ```bash
   sudo mkdir -p /opt/toubatv/appttv/data/vps
   sudo chown -R $USER:$USER /opt/toubatv/appttv/data
   ```
4. Rebuild et redémarrer :
   ```bash
   cd /opt/toubatv/appttv
   npm ci && npm run build
   pm2 restart appttv
   ```
5. Vérifier : `curl -s https://stream.broadcastsn.com/appttv/health | jq`

## App mobile

L'app envoie désormais vers `POST /api/messages/submit` avec le token Firebase (auth anonyme).  
Aucune configuration supplémentaire si `APPTTV_BASE_URL` pointe déjà vers votre VPS.

## Sauvegarde

Sauvegardez régulièrement le dossier `data/vps/` (messages + photos).
