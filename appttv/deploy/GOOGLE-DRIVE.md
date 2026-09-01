# Google Drive — sauvegarde des photos

**Rappel architecture :** les **messages** vivent dans **Firebase Firestore**. Les **photos** sont enregistrées **directement dans Google Drive** via `POST /api/messages/photo` (app mobile).

Le watcher `drive-sync` reste actif pour les anciens messages encore hébergés sur Firebase Storage.

## Configuration (15 min)

### 1. Activer l’API Drive

[Google Cloud Console](https://console.cloud.google.com/apis/library/drive.googleapis.com?project=touba-tv-823d7) → **Google Drive API** → Activer.

### 2. Créer un dossier Drive

1. Google Drive → **Nouveau dossier** → ex. `TOUBA TV Dédicaces`
2. Ouvrir le dossier → copier l’**ID** dans l’URL :  
   `https://drive.google.com/drive/folders/XXXXXXXX` → `XXXXXXXX`

### 3. Partager avec le compte de service

1. Ouvrir `service-account.json` sur le VPS
2. Copier `client_email` (ex. `firebase-adminsdk-xxx@touba-tv-823d7.iam.gserviceaccount.com`)
3. Clic droit sur le dossier Drive → **Partager** → coller cet e-mail → rôle **Éditeur**

### 4. `.env` sur le VPS

```env
GOOGLE_DRIVE_ENABLED=true
GOOGLE_DRIVE_FOLDER_ID=XXXXXXXX
```

Redémarrer : `pm2 restart touba-appttv`

## Comportement (automatique dès qu’une photo arrive)

Dès qu’un message Firestore a un **`mediaUrl`** rempli, le serveur VPS :

1. **Détecte** le message (écoute Firestore en temps réel + vérification toutes les 2 min)
2. **Télécharge** la photo depuis Firebase Storage
3. **Enregistre** dans le dossier [TOUBA TV Dédicaces](https://drive.google.com/drive/folders/18Bi3LLPT0fWOy_Smgs9gkvyC0neL9M9m)
4. **Met à jour** Firestore : `driveFileId`, `driveWebViewLink`

Aucun clic manuel requis si `GOOGLE_DRIVE_ENABLED=true` sur le VPS.

| Moment | Action |
|--------|--------|
| Nouveau message avec photo | Sauvegarde auto (~quelques secondes) |
| Approbation admin | Sauvegarde si pas déjà faite |
| Bouton **Sauver photo → Drive** | Relance manuelle |

Firestore enregistre `driveFileId`, `driveWebViewLink` et remplace `mediaUrl` par le **lien direct Drive** (photo canonique).  
L’ancienne URL Storage est conservée dans `firebaseMediaUrl`.

## Dépannage

| Problème | Solution |
|----------|----------|
| Échec silencieux | `pm2 logs touba-appttv` — vérifier partage dossier |
| 403 Drive | API Drive activée + dossier partagé avec `client_email` |
| Pas de photo | `mediaUrl` vide dans Firestore (Storage app mobile) |

Les fichiers sont nommés : `2026-06-28_NomExpediteur_abc12345.jpg`
