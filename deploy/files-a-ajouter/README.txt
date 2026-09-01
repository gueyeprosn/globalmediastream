Fichiers à placer MANUELLEMENT sur le VPS (ne jamais commiter dans Git)

1) /opt/toubatv/service-account.json
   Source : Firebase Console → Paramètres projet → Comptes de service → Générer une clé privée
   Permissions : chmod 600

2) /opt/toubatv/appttv/.env
   Source : copier .env.example depuis le projet
   Remplir au minimum :
     FIREBASE_WEB_APP_ID=...
     VMIX_DS_TOKEN=...
     GOOGLE_APPLICATION_CREDENTIALS=/opt/toubatv/service-account.json
   Permissions : chmod 600

Modèle service-account (structure, sans vraies clés) :
  deploy/files-a-ajouter/service-account.exemple.json
