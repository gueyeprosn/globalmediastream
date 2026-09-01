# Prompt à coller dans une IA (Cursor, ChatGPT, terminal agent, etc.)

Copiez **tout le bloc** ci-dessous après vous être connecté en SSH au VPS ou en ayant uploadé `appttv-vps.zip`.

---

```
Tu es un DevOps expert Linux. Déploie ou mets à jour le projet Node.js "touba-tv-appttv" sur mon VPS.

Réponds et exécute en FRANÇAIS. Donne des commandes complètes, copiables.

## Infrastructure
- VPS IP : 82.29.170.136
- Utilisateur SSH : root (ou celui que j'utilise)
- URL publique admin : https://stream.broadcastsn.com/appttv
- Chemin application : /opt/toubatv/appttv
- Port Node interne : 3010
- Process PM2 : touba-appttv
- BASE_PATH=/appttv
- Flux HLS existant (NE PAS CASSER) : https://stream.broadcastsn.com/toubatv/index.m3u8

## Firebase
- Projet : touba-tv-823d7
- Firestore : base (default) Standard
- Auth admin : Google Sign-In
- Domaine autorisé : stream.broadcastsn.com
- Modérateur : collection admins/{UID} avec { active: true }

## Archive uploadée
J'ai uploadé appttv-vps.zip dans /opt/toubatv/ (ou le dossier appttv/ est déjà là).

Commandes d'extraction :
  mkdir -p /opt/toubatv && cd /opt/toubatv
  apt install -y unzip   # si besoin
  unzip -o appttv-vps.zip

## Fichiers secrets (hors Git — à vérifier/créer)
1. /opt/toubatv/service-account.json
   → Clé compte de service Firebase (chmod 600)

2. /opt/toubatv/appttv/.env (copier depuis .env.example, chmod 600)
   Variables obligatoires :
   - NODE_ENV=production
   - HOST=127.0.0.1
   - PORT=3010
   - BASE_PATH=/appttv
   - PUBLIC_BASE_URL=https://stream.broadcastsn.com/appttv
   - LIVE_HLS_URL=https://stream.broadcastsn.com/toubatv/index.m3u8
   - FIREBASE_PROJECT_ID=touba-tv-823d7
   - GOOGLE_APPLICATION_CREDENTIALS=/opt/toubatv/service-account.json
   - FIREBASE_WEB_APP_ID=... (app Web Firebase)
   - FIREBASE_API_KEY=AIzaSyBdezvkE71PxDPONyNmYhTuTEmg8bVgQYQ
   - FIREBASE_AUTH_DOMAIN=touba-tv-823d7.firebaseapp.com
   - FIREBASE_STORAGE_BUCKET=touba-tv-823d7.firebasestorage.app
   - FIREBASE_MESSAGING_SENDER_ID=68793261862
   - VMIX_DS_TOKEN=... (secret long, ex: openssl rand -hex 32)

   Google Drive (sauvegarde photos — optionnel) :
   - GOOGLE_DRIVE_ENABLED=true
   - GOOGLE_DRIVE_FOLDER_ID=... (ID dossier Drive partagé avec client_email du service-account)
   → Voir deploy/GOOGLE-DRIVE.md dans le projet

## Fonctionnalités à faire tourner
1. Admin web : modération dédicaces Firestore (login Google)
2. Cartes messages : Nom, Pays, Tél, Message, Photo (logo TOUBA TV si pas de mediaUrl), Moyen de paiement
3. Export XML vMix (machine distante, autre réseau) :
   - https://stream.broadcastsn.com/appttv/vmix/current.xml?token=TOKEN
   - https://stream.broadcastsn.com/appttv/api/vmix/datasource.xml?token=TOKEN
4. Sauvegarde photos → Google Drive si GOOGLE_DRIVE_ENABLED=true

## Structure projet
- src/server.ts — Express sur /appttv
- public/ — interface admin (js/admin.js, css/style.css)
- scripts/install.sh — npm ci, build, pm2
- scripts/post-install-vps.sh — nginx + health check
- deploy/nginx-includes/appttv.conf — snippet Nginx

## Tâches à exécuter dans l'ordre
1. Vérifier : node -v (20+), nginx, pm2 (sinon installer)
2. cd /opt/toubatv/appttv — confirmer que package.json contient "touba-tv-appttv"
3. Vérifier .env et service-account.json (sinon me dire ce qui manque)
4. chmod +x scripts/*.sh
5. ./scripts/install.sh
6. sudo cp deploy/nginx-includes/appttv.conf /etc/nginx/snippets/appttv.conf
7. Vérifier que /etc/nginx/sites-available/stream.broadcastsn.com contient :
     include /etc/nginx/snippets/appttv.conf;
   (dans le bloc server HTTPS uniquement)
8. sudo nginx -t && sudo systemctl reload nginx
9. ./scripts/post-install-vps.sh
10. Tests :
    curl -s http://127.0.0.1:3010/appttv/health
    curl -sI https://stream.broadcastsn.com/appttv/health
    pm2 status
    pm2 logs touba-appttv --lines 30

## Mise à jour (si déjà installé)
  cd /opt/toubatv/appttv
  unzip -o ../appttv-vps.zip   # ou remplacer fichiers
  npm ci && npm run build
  pm2 restart touba-appttv --update-env

## Contraintes
- NE PAS toucher au location /toubatv/ ou au streaming HLS existant
- NE PAS exposer .env ni service-account.json
- Toutes les commandes npm UNIQUEMENT depuis /opt/toubatv/appttv
- Ne pas utiliser le dossier racine du monorepo parent (pas de npm à la racine TTV APP DEDICACE)

Commence par un diagnostic (node, pm2, nginx, fichiers présents), puis déploie ou mets à jour. Signale chaque erreur avec la commande de correction.
```

---

## Variante courte (mise à jour rapide)

```
Mets à jour appttv sur mon VPS 82.29.170.136 :
- Archive : /opt/toubatv/appttv-vps.zip → extraire dans /opt/toubatv/
- cd /opt/toubatv/appttv && npm ci && npm run build && pm2 restart touba-appttv
- URL : https://stream.broadcastsn.com/appttv
- Nginx include : /etc/nginx/snippets/appttv.conf
- Firebase touba-tv-823d7, .env + service-account.json dans /opt/toubatv/
- Inclut admin modération, cartes messages, XML vMix, Google Drive photos (deploy/GOOGLE-DRIVE.md)
Exécute tout en SSH, réponds en français.
```

---

## Variante Cursor Agent (Remote SSH)

```
Je suis connecté en SSH sur 82.29.170.136. Le zip appttv-vps.zip est dans /opt/toubatv/.
Déploie touba-tv-appttv selon deploy/VPS-DEPLOIEMENT.md et deploy/GOOGLE-DRIVE.md.
Installe PM2 si absent, configure Nginx pour /appttv, teste /appttv/health.
```
