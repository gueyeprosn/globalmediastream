# Déploiement VPS — TOUBA TV appttv

**Serveur :** `82.29.170.136`  
**URL publique :** https://stream.broadcastsn.com/appttv  
**Dossier recommandé sur le VPS :** `/opt/toubatv/appttv`

---

## Contenu du pack

| Élément | Rôle |
|---------|------|
| `src/` + `public/` | Admin web + API vMix |
| `.env.example` | Modèle de configuration |
| `deploy/nginx-includes/appttv.conf` | Bloc Nginx à inclure |
| `deploy/files-a-ajouter/` | Où placer les fichiers secrets |
| `scripts/install.sh` | Installation Node + PM2 |
| `scripts/post-install-vps.sh` | Nginx + vérifs complètes |

---

## Avant l’upload — Firebase Console

Cochez tout avant de lancer l’app :

- [ ] **Authentication → Sign-in method → Google** : activé  
- [ ] **Authentication → Settings → Authorized domains** : ajouter `stream.broadcastsn.com`  
- [ ] **Project settings → Your apps → Web** : créer l’app Web, noter **`appId`**  
- [ ] **Project settings → Service accounts → Generate new private key** → fichier JSON  
- [ ] **Firestore → `admins/{VOTRE_UID_GOOGLE}`** → `{ "active": true }`  
- [ ] Firestore base **`(default)`** Standard (déjà OK si les messages arrivent depuis l’app)

---

## Fichiers secrets à ajouter sur le VPS (ne pas mettre dans Git)

1. **`/opt/toubatv/service-account.json`**  
   Clé compte de service Firebase (téléchargée depuis la console).

2. **`/opt/toubatv/appttv/.env`**  
   Copie de `.env.example` avec au minimum :
   - `FIREBASE_WEB_APP_ID=1:68793261862:web:xxxxxxxx`
   - `VMIX_DS_TOKEN=` un secret long (ex. `openssl rand -hex 32`)
   - `GOOGLE_APPLICATION_CREDENTIALS=/opt/toubatv/service-account.json`

---

## Étape 1 — Upload sur le VPS

### Option A : SCP (depuis votre Mac)

```bash
# Créer l’archive locale (sans node_modules)
cd "/Users/prom1/TTV APP DEDICACE/appttv"
./scripts/package-for-vps.sh

# Envoyer (adapter user si pas root)
scp deploy/out/appttv-vps.zip root@82.29.170.136:/opt/toubatv/
```

### Option B : FileZilla / panneau OVH

1. Uploadez `deploy/out/appttv-vps.zip` vers `/opt/toubatv/`
2. Ou uploadez le dossier `appttv/` entier (sans `node_modules/`)

---

## Étape 2 — Sur le VPS (SSH)

```bash
ssh root@82.29.170.136

# Prérequis (Debian/Ubuntu)
apt update
apt install -y curl nginx
curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
apt install -y nodejs
npm install -g pm2

# Extraire si archive
mkdir -p /opt/toubatv
cd /opt/toubatv
unzip -o appttv-vps.zip   # crée ./appttv/

# Secrets
nano /opt/toubatv/service-account.json   # coller le JSON Firebase
cd /opt/toubatv/appttv
cp .env.example .env
nano .env   # FIREBASE_WEB_APP_ID + VMIX_DS_TOKEN

chmod 600 /opt/toubatv/service-account.json
chmod 600 .env

# Installation
chmod +x scripts/*.sh
./scripts/install.sh
./scripts/post-install-vps.sh
```

---

## Étape 3 — Nginx

```bash
sudo cp /opt/toubatv/appttv/deploy/nginx-includes/appttv.conf /etc/nginx/snippets/appttv.conf
```

Dans `/etc/nginx/sites-available/stream.broadcastsn.com` (bloc `server` HTTPS), ajouter :

```nginx
include /etc/nginx/snippets/appttv.conf;
```

```bash
sudo nginx -t && sudo systemctl reload nginx
```

---

## Étape 4 — Vérifications

```bash
curl -s http://127.0.0.1:3010/appttv/health
curl -sI https://stream.broadcastsn.com/appttv/health
```

Navigateur : https://stream.broadcastsn.com/appttv → **Continuer avec Google**

---

## URLs vMix (machine distante, autre réseau)

Dans vMix → **Settings → Data Sources → Remote (HTTP)** :

| Mode | URL |
|------|-----|
| **Fichier XML** (aperçu) | `https://stream.broadcastsn.com/appttv/vmix/current.xml?token=VOTRE_TOKEN` |
| **FIFO auto** (5 s) | `https://stream.broadcastsn.com/appttv/api/vmix/datasource.xml?token=VOTRE_TOKEN` |

Refresh : **5000 ms**. Champs : `{Nom}`, `{Message}`, `{Photo}`, `{Montant}`, etc.

---

## Dépannage

| Problème | Solution |
|----------|----------|
| 502 Bad Gateway | `pm2 status` → `pm2 logs touba-appttv` |
| Accès refusé admin | Firestore `admins/{uid}` avec `active: true` |
| Google login échoue | Domaine `stream.broadcastsn.com` dans Firebase Auth |
| XML vide | Approuver un message dans l’admin d’abord |
| `npm run build` absent | Vous n’êtes pas dans `/opt/toubatv/appttv` |

---

## Mise à jour (nouvelle version)

```bash
cd /opt/toubatv/appttv
# remplacer les fichiers (scp ou tar)
npm ci && npm run build
pm2 restart touba-appttv
```
