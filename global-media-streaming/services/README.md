# Scripts de service — copies versionnées

Copies de sauvegarde des scripts réellement exécutés en production par systemd,
qui vivent sous `/usr/local/bin/` (hors de tout dépôt git par défaut) :

| Fichier ici | Service systemd | Emplacement réel exécuté |
|---|---|---|
| `toubatv.sh` | `toubatv.service` | `/usr/local/bin/toubatv.sh` |
| `external-tv.sh` | `external-tv.service` | `/usr/local/bin/external-tv.sh` |
| `external-tv-2.sh` | `external-tv-2.service` | `/usr/local/bin/external-tv-2.sh` |
| `external-tv-3.sh` | `external-tv-3.service` | `/usr/local/bin/external-tv-3.sh` |

**Important** : modifier `/usr/local/bin/*.sh` ne met pas ce dossier à jour
automatiquement (et inversement). Après toute modification en prod, copier le
fichier ici et committer :

```bash
cp /usr/local/bin/toubatv.sh /srv/global-media-streaming/services/
cd /srv/global-media-streaming && git add services/ && git commit -m "Sync services/ après modif prod"
```

**2026-09-01** — réglages SRT durcis pour les connexions instables (Afrique,
4G/mobile) : voir `tv-radio-app/docs/SRT_TROUBLESHOOTING.md` dans ce même
dépôt pour le détail et les recommandations côté encodeur (vMix/OBS).
