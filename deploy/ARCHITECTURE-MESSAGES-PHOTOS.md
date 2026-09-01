# Architecture — Messages Firebase + Photos Google Drive

## Principe

| Donnée | Stockage | Rôle |
|--------|----------|------|
| **Messages** (texte, statut, paiement, modération) | **Firebase Firestore** | Source de vérité |
| **Photos** des dédicaces | **Google Drive** | Stockage direct (pas Firebase Storage en prod) |

## Flux photo (production)

```
App Flutter
  │
  ├─► POST /appttv/api/messages/photo  (Bearer token Firebase)
  │     multipart « photo » → upload direct Google Drive
  │     réponse : mediaUrl, driveFileId, driveWebViewLink
  │
  └─► Firestore messages/{id}
        (texte, montant, mediaUrl, driveFileId, driveWebViewLink…)
```

L’app **n’utilise plus Firebase Storage** pour les photos en production.  
Seuls les **émulateurs locaux** peuvent encore passer par Storage.

## Rétrocompatibilité

Le watcher `drive-sync` sur le VPS continue de copier vers Drive les anciens messages dont la photo était encore sur Storage (`mediaUrl` Firebase).

## Endpoint API

| Méthode | URL | Auth |
|---------|-----|------|
| `POST` | `{PUBLIC_BASE_URL}/api/messages/photo` | `Authorization: Bearer <idToken>` |

Corps : `multipart/form-data` — champ `photo` (image, max 5 Mo), optionnel `senderName`, `messageId`.

Réponse :

```json
{
  "success": true,
  "fileId": "...",
  "driveWebViewLink": "https://drive.google.com/file/d/.../view",
  "mediaUrl": "https://..."
}
```

## Configuration VPS

```env
GOOGLE_DRIVE_ENABLED=true
GOOGLE_DRIVE_FOLDER_ID=votre_dossier_id
GOOGLE_APPLICATION_CREDENTIALS=/opt/toubatv/service-account.json
PUBLIC_BASE_URL=https://stream.broadcastsn.com/appttv
```

## App Flutter

```dart
// dart-define optionnel
APPTTV_BASE_URL=https://stream.broadcastsn.com/appttv
```

Voir aussi [GOOGLE-DRIVE.md](./GOOGLE-DRIVE.md).
