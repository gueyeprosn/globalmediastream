# Rapport d’audit — Stream Control Center (`tv-radio-app`)

**Date** : 2026-08-09  
**Périmètre** : code réel sous `/srv/tv-radio-app` (lecture seule au moment de l’audit)  
**App** : Next.js 16 · PM2 `oceanfm-app` · port 3000 (loopback derrière Nginx)  
**Contexte** : outil d’exploitation live Broadcast SN — zéro tolérance pour les régressions non testées sur `/login`, `/streams`, `/traffic`

---

## Constat global

L’auth API via `proxy.ts` tient en prod ; `lib/safe-shell.ts` est solide **là où il est utilisé**. Les risques majeurs sont les **contournements shell**, les **actions live sans confirmation**, le **disque recordings**, et la **dépendance exclusive au proxy** (surtout avec des CVE Next.js ouvertes).

**Aucune modification de code n’a été effectuée** pendant cette phase d’audit.

---

## Points déjà solides

- Cookie login : `httpOnly` + `secure` (prod) + `sameSite: 'lax'` + JWT 24h.
- Matcher API : tout `/api/*` sauf `POST` login/logout exige un JWT (Bearer ou cookie).
- `deploy` = `build` + `pm2 restart … --update-env` (évite le piège chunks 500).
- Timeouts corrects sur SRS/Icecast dans `/api/traffic`, `/api/srs-stats`, `/api/streams`.
- Confirmations UI déjà en place pour stop/restart/delete RTMP & SRT.
- `/traffic` External TV : états LIVE / idle / service off lisibles.
- React Query : `refetchIntervalInBackground: false` sur streams/traffic.
- Vocabulaire opérationnel partagé : `LiveIndicator`, `StatusBadge`, `MetricCard`, `Section`, `PageHeader`.
- Shell mobile : drawer `Sheet`, sidebar `lg:`.

---

## Inventaire auth & API

| Pièce | Rôle |
|--------|------|
| `proxy.ts` | Remplace `middleware.ts` (Next 16). Matcher `/api/:path*`. JWT via Bearer ou cookie `admin_token`. |
| Pas de `middleware.ts` | Confirmé. |
| `lib/jwt.ts` / `lib/jwt-secret.ts` | HS256, exp 24h, claim `role: 'admin'` (non vérifié dans le proxy). |
| `lib/admin-auth.ts` | bcrypt `ADMIN_PASSWORD_HASH` ou repli clair `ADMIN_PASSWORD`. |
| `lib/auth.ts` + `lib/api-fetch.ts` | Token aussi en **sessionStorage** + header Bearer. |
| `components/auth/auth-guard.tsx` | Garde UI client ; ignore `/login` et `/watch`. |
| `requireAuth` / `withAuth` | **Absents** des route handlers. |

### Routes API — statut de protection

| Route | Méthodes | Proxy JWT | Auth dans handler |
|--------|----------|-----------|-------------------|
| `/api/auth/login` | POST | bypass | Public intentionnel |
| `/api/auth/logout` | POST | bypass | Public intentionnel |
| `/api/traffic` | GET | oui | non |
| `/api/srs-stats` | GET | oui | non |
| `/api/srs/sessions` | GET | oui | non |
| `/api/srs/reload` | POST | oui | non |
| `/api/srs/clients/[cid]` | DELETE | oui | non |
| `/api/system/health` | GET | oui | non |
| `/api/system/metrics` | GET | oui | non |
| `/api/system/cleanup` | POST | oui | non |
| `/api/system-stats` | GET | oui | non |
| `/api/endpoints` | GET | oui | non |
| `/api/logs` | GET | oui | non |
| `/api/plan-actions` | GET/PATCH/POST/DELETE | oui | non |
| `/api/streams` | GET | oui | non |
| `/api/streams/create` | POST | oui | non |
| `/api/streams/advanced` | GET | oui | non |
| `/api/streams/[id]` | GET/POST | oui | non |
| `/api/streams/[id]/health` | GET | oui | non |
| `/api/streams/[id]/rollback` | POST | oui | non |
| `/api/streams/rtmp` | GET/POST | oui | non |
| `/api/streams/rtmp/[id]` | GET/PUT/DELETE | oui | non |
| `/api/streams/srt/[id]` | DELETE | oui | non |
| `/api/recordings` | GET | oui | non |
| `/api/recordings/sources` | GET | oui | non |
| `/api/recordings/status` | GET | oui | non |
| `/api/recordings/start` | POST | oui | non |
| `/api/recordings/stop` | POST | oui | non |
| `/api/recordings/[id]` | PATCH/DELETE | oui | non |
| `/api/recordings/[id]/download` | GET | oui | non |
| `/api/recordings/[id]/stream` | GET | oui | non |

**Routes non protégées (intentionnelles)** : `POST /api/auth/login`, `POST /api/auth/logout` uniquement.

### Contournements `safe-shell` (inventaire)

| Fichier | API | Shell ? |
|---|---|---|
| `lib/safe-shell.ts` | `spawn` | non |
| `app/api/system/metrics/route.ts` | `exec` | **oui** |
| `app/api/system/health/route.ts` | `exec` | **oui** |
| `lib/stream-monitoring/ffprobe.ts` | `exec` | **oui** |
| `lib/stream-monitoring/publisher-ip.ts` | `exec` | **oui** |
| `lib/monitoring/hls-viewers.ts` | `exec` | **oui** |
| `app/api/system-stats/route.ts` | `execSync` | **oui** |
| `app/api/recordings/start/route.ts` | `spawn` direct | non (hors API safe-shell) |

---

## 🔴 Risque opérationnel direct

### A1 — Injection shell via ffprobe

- **Fichier(s) / route(s)** : `lib/stream-monitoring/ffprobe.ts` ; appelants `app/api/streams/advanced/route.ts`, `lib/stream-health.ts`
- **Gravité** : 🔴
- **Description** : `exec(\`timeout … ffprobe … "${rtmpUrl}"\`)` — URL interpolée dans un shell.
- **Scénario d’impact** : URL RTMP malveillante dans le registre → commande arbitraire sous l’user PM2 pendant un live.
- **Correction proposée** : `spawnCapture('ffprobe', […])` + validation schéma URL (`rtmp://` / `http(s)://` allowlist).
- **Risque de la correction** : faible ; tester `/streams` advanced + un flux live connu. **À tester avant prod (touch shell).**

### A2 — Kick publisher sans confirmation

- **Fichier(s) / route(s)** : `components/traffic/traffic-dashboard.tsx`, `components/dashboard/dashboard-srs-control.tsx` ; API `DELETE /api/srs/clients/[cid]`
- **Gravité** : 🔴
- **Description** : un clic → kick immédiat. `ConfirmAction` existe mais **n’est jamais utilisé**.
- **Scénario d’impact** : kick accidentel d’un encodeur → coupure antenne.
- **Correction proposée** : `AlertDialog` (stream + IP + cid) avant mutate.
- **Risque de la correction** : nul (friction UX seulement).

### A3 — Enregistrements sans garde-fou disque + spawn fragile

- **Fichier(s) / route(s)** : `app/api/recordings/start/route.ts`, `app/(app)/recordings/page.tsx`
- **Gravité** : 🔴
- **Description** : aucun check d’espace libre ; `spawn('ffmpeg')` sans `child.on('error')` ; pas de bannière disque sur `/recordings` (le gauge existe seulement sur `/monitoring`).
- **Scénario d’impact** : disque plein → ENOSPC VPS (logs, HLS, Docker) ; ffmpeg absent → risque d’exception non catchée.
- **Correction proposée** : refuser si `disk_free` < seuil ; handler `error` ; bannière + disable start ≥ 85 %.
- **Risque de la correction** : faible ; calibrer le seuil sur la partition réelle de `/srv/recordings`.

### A4 — Auth 100 % déléguée au proxy + CVE Next.js

- **Fichier(s) / route(s)** : `proxy.ts` ; `package.json` (`next@16.2.9`) ; **aucune** route n’appelle `verifyAdminToken`
- **Gravité** : 🔴
- **Description** : `npm audit` signale entre autres **Middleware/Proxy bypass** (GHSA-6gpp) et d’autres High. Les handlers mutent systemd / SRS / fichiers sans re-vérifier le JWT.
- **Scénario d’impact** : si le proxy est contourné, kick / stop / cleanup / delete deviennent publics → live et VPS exposés.
- **Correction proposée** : (1) monter Next vers patch (`16.3.0` via audit, **staging d’abord**) ; (2) `requireAuth()` sur toutes les routes mutantes.
- **Risque de la correction** : **élevé pour le bump Next** (login/chunks) — tester build + login + `/streams` + `/traffic` avant `npm run deploy`. Auth handler : risque moyen (appels internes cookie/Bearer).

### A5 — Cleanup disque en un clic (Quick Actions)

- **Fichier(s) / route(s)** : `components/ops/QuickActionsPanel.tsx` → `POST /api/system/cleanup`
- **Gravité** : 🔴
- **Description** : pas de confirmation (contrairement à `system-monitor.tsx` qui a un AlertDialog).
- **Scénario d’impact** : purge involontaire sous stress ops.
- **Correction proposée** : même pattern AlertDialog + libellé clair.
- **Risque de la correction** : nul.

---

## 🟠 Sécurité / bug fonctionnel important

### B1 — JWT aussi en `sessionStorage` + corps JSON

- **Fichier(s) / route(s)** : `app/api/auth/login/route.ts`, `lib/auth.ts`, `lib/api-fetch.ts`
- **Gravité** : 🟠
- **Description** : login renvoie `{ token }` ; stocké hors httpOnly.
- **Scénario d’impact** : XSS → vol Bearer → toutes les actions admin.
- **Correction proposée** : cookie seul + `credentials: 'include'`.
- **Risque de la correction** : moyen (casse les sessions ouvertes). **À tester manuellement avant prod.**

### B2 — Mots de passe Icecast dans `GET /api/streams`

- **Fichier(s) / route(s)** : `app/api/streams/route.ts` (`password`, `inputUrl` avec credentials)
- **Gravité** : 🟠
- **Description** : réponse JSON inclut le password et l’URL source avec credentials.
- **Scénario d’impact** : JWT volé / XSS → credentials source Icecast.
- **Correction proposée** : `hasPassword` ; ne jamais renvoyer le secret.
- **Risque de la correction** : faible (vérifier UI Icecast qui affiche éventuellement le mdp).

### B3 — Contournements massifs de `safe-shell`

- **Fichier(s) / route(s)** :
  - `app/api/system/metrics/route.ts`, `app/api/system/health/route.ts` (`exec` shell, **sans timeout**)
  - `app/api/system-stats/route.ts` (`execSync` → bloque l’event-loop)
  - `lib/stream-monitoring/publisher-ip.ts`, `lib/monitoring/hls-viewers.ts` (`exec`)
- **Gravité** : 🟠
- **Description** : dizaines d’`exec` sans timeout ; `vmstat 1 2` bloque ~1 s ; `execSync` synchrone sur `df`.
- **Scénario d’impact** : saturation sous polling monitoring ; hung process ; charge VPS pendant un live.
- **Correction proposée** : migrer vers `spawnCapture` / `/proc` ; timeout 3–8 s ; remplacer `execSync`.
- **Risque de la correction** : moyen (parsers à revalider sur `/monitoring`).

### B4 — Rate-limit login trop permissif

- **Fichier(s) / route(s)** : `lib/login-rate-limit.ts` (20 échecs / 15 min, Map mémoire, IP via `X-Forwarded-For`)
- **Gravité** : 🟠
- **Description** : seuil élevé, store in-memory, IP spoofable si trust proxy mal configuré.
- **Scénario d’impact** : brute-force plus large ; spoof XFF.
- **Correction proposée** : seuil ~5 ; IP depuis `X-Real-IP` trusté Nginx.
- **Risque de la correction** : faible (faux positifs NAT).

### B5 — Kick SRS sans timeout côté API

- **Fichier(s) / route(s)** : `app/api/srs/clients/[cid]/route.ts`
- **Gravité** : 🟠
- **Description** : `fetch` DELETE vers SRS sans `AbortSignal`.
- **Scénario d’impact** : SRS half-open → requête pendante, UI kick figée.
- **Correction proposée** : `AbortSignal` 3 s + try/catch.
- **Risque de la correction** : faible.

### B6 — Pas d’audit trail kick / delete

- **Fichier(s) / route(s)** : `app/api/srs/clients/[cid]/route.ts`, `app/api/recordings/[id]/route.ts` ; `lib/logger.ts` sous-utilisé
- **Gravité** : 🟠
- **Description** : DELETE kick = proxy SRS sans log ; delete recording = `unlink` sans journal.
- **Scénario d’impact** : impossible de savoir qui a expulsé un encodeur ou effacé un MKV.
- **Correction proposée** : `logInfo` avec cid/streamId + request-id (sans PII excessive).
- **Risque de la correction** : nul.

### B7 — Pages dashboard protégées seulement côté client

- **Fichier(s) / route(s)** : `components/auth/auth-guard.tsx` ; `proxy.ts` ne matche que `/api/*`
- **Gravité** : 🟠
- **Description** : HTML/JS du panneau servis sans cookie ; redirect après hydratation.
- **Scénario d’impact** : surface XSS / énumération UI (pas d’accès API sans JWT).
- **Correction proposée** : redirect serveur si pas de cookie (exclure `/login`, `/watch`).
- **Risque de la correction** : faible.

### B8 — `safe-shell` : SIGTERM sans SIGKILL

- **Fichier(s) / route(s)** : `lib/safe-shell.ts` (`spawnCapture`)
- **Gravité** : 🟠
- **Description** : sur timeout → uniquement `SIGTERM`, pas de `SIGKILL` ni reject forcé.
- **Scénario d’impact** : binaire coincé → Promise jamais résolue → API gelées.
- **Correction proposée** : escalade SIGKILL après 2–5 s + reject.
- **Risque de la correction** : faible — **à tester avant prod** (systemd start/stop).

### B9 — Statut LIVE trompeur sur `/streams`

- **Fichier(s) / route(s)** : `components/StreamTable.tsx`, `lib/dashboard-stream-rows.ts`
- **Gravité** : 🟠
- **Description** : binaire LIVE/OFFLINE ; pipeline actif = LIVE même si bitrate 0 / HLS frozen.
- **Scénario d’impact** : opérateur croit « en ondes » alors que le signal est mort.
- **Correction proposée** : état `DEGRADED` (pipeline ok + signal mort).
- **Risque de la correction** : moyen (sémantique métier) — **décision produit requise**.

### B10 — Graphiques monitoring trompeurs

- **Fichier(s) / route(s)** : `app/(app)/monitoring/page.tsx`
- **Gravité** : 🟠
- **Description** : « tendances » CPU = valeur constante répétée ; erreurs = 0 ou 100.
- **Scénario d’impact** : fausse lecture d’incident pendant un live.
- **Correction proposée** : utiliser l’historique réel ou retirer les charts.
- **Risque de la correction** : faible.

### B11 — Contrastes light mode / login

- **Fichier(s) / route(s)** : cartes SRT/RTMP (`text-white`), login `logo-broadcast-sn-blanc.png`
- **Gravité** : 🟠
- **Description** : thème light + textes blancs / logo blanc → illisible.
- **Scénario d’impact** : UI illisible en thème clair en régie.
- **Correction proposée** : `text-foreground` + logo adaptatif.
- **Risque de la correction** : faible.

### B12 — Uptime systemd incohérent

- **Fichier(s) / route(s)** : bon sur `/traffic` (`lib/traffic/collect.ts`) ; `GET /api/streams` laisse souvent `uptime: 'N/A'`
- **Gravité** : 🟠
- **Description** : `/srt` et cartes SRT affichent souvent « Uptime N/A » alors que `/traffic` a démarrage + uptime systemd.
- **Scénario d’impact** : doute après restart pendant un incident.
- **Correction proposée** : réutiliser le parseur `ActiveEnterTimestamp`.
- **Risque de la correction** : faible (légère charge `systemctl show`).

### B13 — Dépendances vulnérables (`npm audit`)

- **Fichier(s) / route(s)** : `package.json` / `package-lock.json` (`next@16.2.9`, `postcss`, `sharp`)
- **Gravité** : 🟠 (cumulé 🔴 via A4 pour le bypass proxy)
- **Description** : 4 vulnérabilités High ; fix audit pointe `next@16.3.0`.
- **Scénario d’impact** : exploit potentiel middleware/proxy, DoS Server Actions, SSRF, cache confusion, etc.
- **Correction proposée** : bump contrôlé + build + smoke login/streams/traffic.
- **Risque de la correction** : **élevé** (processus Next en prod).

---

## 🟡 Qualité de code / UX mineure

### C1 — Vocabulaire de statut incohérent

- **Fichier(s)** : `/streams` LIVE/OFFLINE ; `/traffic` LIVE/idle ; `/srt` En direct/Arrêté ; `/icecast` ON/OFF
- **Gravité** : 🟡
- **Description** : mêmes réalités, labels différents.
- **Impact** : confusion ops sous stress.
- **Correction** : mapper vers 4 tons (`live` / `degraded` / `down` / `rec`) via `StatusBadge`.

### C2 — Tables `/traffic` peu adaptées tablette

- **Fichier(s)** : `components/traffic/traffic-dashboard.tsx`
- **Gravité** : 🟡
- **Description** : 9–12 colonnes, scroll horizontal uniquement ; pas de variante cartes.
- **Impact** : actions Kick hors viewport sur iPad.
- **Correction** : cards `< lg` ou colonnes prioritaires + détail expandable.

### C3 — Polling / re-renders excessifs

- **Fichier(s)** : `recordings/page.tsx` (5 s) + sidebar (15 s) + tick 1 s/carte ; `/monitoring` multi-pollers
- **Gravité** : 🟡
- **Description** : double fetch recordings ; pile de pollers sur monitoring.
- **Impact** : UI moins fluide tablette / charge API.
- **Correction** : query partagée ; timer durée seulement si `isRecording` ; unifier intervals.

### C4 — `StreamHealthBadge` s’arrête après 60 s

- **Fichier(s)** : `components/streams/StreamHealthBadge.tsx`
- **Gravité** : 🟡
- **Description** : poll 5 s puis stop à `maxDurationMs=60_000`.
- **Impact** : dégradation tardive non vue sur la carte SRT.
- **Correction** : poll tant que `document.visible` + carte montée.

### C5 — Bouton Record visible sur `/streams` mais non branché

- **Fichier(s)** : `app/(app)/streams/page.tsx`, `StreamTable.tsx`
- **Gravité** : 🟡
- **Description** : bouton Radio toujours rendu, souvent disabled.
- **Impact** : affordance morte / frustration ops.
- **Correction** : retirer le bouton si pas de handler, ou brancher vers `/recordings`.

### C6 — `.env.example` incomplet

- **Fichier(s)** : `.env.example` ; usage `RECORDINGS_FFMPEG_INPUT_ORIGIN` dans `lib/recordings-hls-sources.ts`
- **Gravité** : 🟡
- **Description** : variable utilisée non documentée.
- **Impact** : FFmpeg passe par HTTPS public (TLS/DNS fragiles) si oubliée.
- **Correction** : ajouter la ligne commentée dans `.env.example`.

### C7 — Ecosystem PM2 incomplet

- **Fichier(s)** : `ecosystem.config.cjs`
- **Gravité** : 🟡
- **Description** : pas de `max_memory_restart` / `kill_timeout` / `exp_backoff_restart_delay`.
- **Impact** : fuite mémoire → OOM killer OS plutôt que restart propre PM2.
- **Correction** : ajouter `max_memory_restart: '800M'` (à calibrer).

### C8 — KPI trafic : double comptage possible

- **Fichier(s)** : `lib/traffic/collect.ts`, `lib/traffic/srt-relay.ts`
- **Gravité** : 🟡
- **Description** : `streamsLive` / `bwInKbps` = SRS + External TV — double si un flux est aussi republished SRS. IP : strip `::ffff:` seulement.
- **Impact** : KPI gonflés → fausses alertes ops.
- **Correction** : exclure IDs External TV du sommaire SRS si déjà dans `externalTv` ; normaliser IPv6. **Décision produit requise.**

### C9 — Logout cookie flags incomplets

- **Fichier(s)** : `app/api/auth/logout/route.ts`
- **Gravité** : 🟡
- **Description** : clear cookie sans aligner `secure` / `sameSite`.
- **Impact** : faible ; logout CSRF peu utile.
- **Correction** : aligner flags sur le login.

### C10 — Claim `role` non vérifié + JWT_SECRET sans contrainte de force

- **Fichier(s)** : `proxy.ts`, `lib/jwt.ts`, `lib/jwt-secret.ts`
- **Gravité** : 🟡
- **Description** : `jwtVerify` sans check `payload.role === 'admin'` ; secret obligatoire en prod mais pas de longueur mini.
- **Impact** : faible aujourd’hui (un seul rôle) ; secret faible → forge de JWT.
- **Correction** : assert role + min 32 bytes entropy.

### C11 — Mot de passe admin en clair (repli migration)

- **Fichier(s)** : `lib/admin-auth.ts`, `.env.example`
- **Gravité** : 🟡 (🟠 si fuite env)
- **Description** : repli `ADMIN_PASSWORD` en clair encore supporté.
- **Impact** : fuite backup/env → accès dashboard complet.
- **Correction** : `ADMIN_PASSWORD_HASH` uniquement ; rotation.

### C12 — Cumul polling monitoring

- **Fichier(s)** : hooks `useSrsStats` (8 s), `useStreams` (12 s), `useSystemStats` (10 s), health, `StreamMonitorAdvanced` (30 s)
- **Gravité** : 🟡
- **Description** : charge cumulée sur une seule page ouverte.
- **Impact** : latence VPS sous multi-onglets.
- **Correction** : une source de vérité ; advanced ≥ 45–60 s ; cache serveur partagé.

---

## Priorisation (risque ops réel)

1. **A2** Kick confirm — impact live immédiat, correction triviale  
2. **A5** Cleanup confirm  
3. **A3** Garde-fou disque recordings + handler ffmpeg  
4. **A1** ffprobe → `safe-shell` (**staging / test manuel précis**)  
5. **B5** Timeout kick SRS  
6. **B6** Audit trail  
7. **B3** Migrer metrics/health/system-stats hors `exec`/`execSync`  
8. **B1** Cookie-only JWT (**test manuel avant prod**)  
9. **B2** Masquer passwords Icecast  
10. **A4/B13** Patch Next + `requireAuth` handlers (**staging obligatoire si possible**)  
11. **B8** SIGKILL dans `safe-shell` (**test manuel**)  
12. **B9** DEGRADED — **besoin décision métier**  
13. **B4, B7, B10–B12, C\*** — ensuite  

---

## Plan de correction (ordre proposé)

| Lot | Items | Risque régression | Test avant/après | Rollback |
|-----|-------|-------------------|------------------|----------|
| **1** | A2, A5 (UI confirm) | Très faible | Kick test sur client non-prod ; cleanup dialog s’affiche | Revert + `npm run deploy` |
| **2** | A3 (disque + ffmpeg error) | Faible | Start recording avec disque OK ; simuler seuil ; ffmpeg path | Idem |
| **3** | A1, B5, B6 (shell ffprobe + kick timeout + logs) | Moyen | Advanced metrics sur 1 flux ; kick ; logs | Idem ; **signaler : touch shell** |
| **4** | B3 (metrics/health/stats async) | Moyen | `/monitoring` + `/api/system-stats` sous charge | Idem |
| **5** | B1, B2 (auth cookie + Icecast secrets) | Moyen→élevé | Login, hard refresh, logout, Icecast page | **Staging si dispo** ; sinon checklist manuelle |
| **6** | A4/B13 (Next bump + requireAuth) | Élevé | Build local → deploy fenêtre hors live → login/streams/traffic | `pm2` + rebuild version précédente |
| **7** | B8, B9, UX | Variable | Selon item | Idem |

### Procédure de déploiement

```bash
cd /srv/tv-radio-app && npm run deploy
pm2 status oceanfm-app
# puis hard refresh navigateur
```

**Piège connu** : remplacer `.next` sans redémarrer PM2 casse les chunks `/_next/static` en 500.

---

## Questions métier (décision requise)

1. **État `DEGRADED`** sur `/streams` : si systemd actif mais bitrate 0 / HLS frozen → afficher dégradé (pas LIVE) ? Seuils exacts ?
2. **Double comptage KPI** : un External TV aussi visible côté SRS doit-il compter 1 ou 2 dans `streamsLive` / `bwInKbps` ?
3. **JWT cookie-only** : acceptez-vous de casser les sessions ouvertes au prochain deploy ?
4. **Bump Next 16.2.9 → 16.3.x** : fenêtre hors live possible ? Y a-t-il un staging, ou uniquement prod VPS ?
5. **Icecast** : l’UI a-t-elle encore besoin d’afficher le mot de passe source, ou un flag `hasPassword` suffit ?

---

## Synthèse par catégorie d’audit

| Catégorie | Verdict |
|-----------|---------|
| 🔐 Auth & sécurité | Proxy OK ; pas de défense en profondeur ; JWT en sessionStorage ; passwords Icecast exposés ; rate-limit faible ; CVE Next |
| ⚙️ Fiabilité ops | Traffic/srs-stats résilients si SRS down ; contournements shell + execSync + kick sans timeout = risque hang/charge |
| 🧠 Code Next.js | App Router cohérent ; duplication shell metrics/health ; `any` limité mais handlers sans typage auth |
| 📊 Fonctionnalités métier | Kick sans confirm/audit ; recordings sans alerte disque ; uptime systemd incohérent hors `/traffic` |
| 🎨 UX | LIVE clair sur External TV ; manque DEGRADED sur `/streams` ; light mode fragile ; `/traffic` peu tablette |
| 🏗️ Build & config | `npm run deploy` correct ; `.env.example` presque complet ; 4 High npm audit |

---

## Résumé quantitatif

| Gravité | Nombre |
|---------|--------|
| 🔴 Opérationnel direct | **5** (A1–A5) |
| 🟠 Sécurité / fonctionnel | **13** (B1–B13) |
| 🟡 Qualité / UX | **12** (C1–C12) |
| **Total** | **30** |

| Statut | |
|--------|--|
| Corrigés | **0** (audit seul) |
| Décision produit requise | **B9, C8, B1 timing, bump Next, Icecast password UI** |

---

## Prochaine étape recommandée

Lot **1** uniquement (confirmations kick + cleanup) — build local, explication précise, rappel deploy — **sans** toucher auth / `safe-shell` / Next dans ce premier lot.
