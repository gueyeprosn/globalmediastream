# SRT depuis l'Afrique — freezes à la réception : diagnostic et réglages

**Contexte** : connexions encodeur (vMix/OBS) → serveur souvent en 4G/mobile ou ADSL
instable. Symptôme : gel d'image côté réception malgré un encodeur qui semble
fonctionner normalement chez l'opérateur.

---

## 1. Ce qui a été renforcé côté serveur (2026-09-01)

| Service | Avant | Après | Effet |
|---------|-------|-------|-------|
| Touba TV (port 6000) | `latency=12000ms`, `rcvbuf=64MB` | inchangé (déjà robuste) | tolère ~12s de jitter/pertes |
| External TV 1/2/3 (ports 6001/6003/6005) | `latency=2000ms`, pas de `peeridletimeo` explicite | `latency=4000ms`, `peeridletimeo=10000ms`, `rcvbuf=16MB` | tolère 2× plus de jitter ; surtout : **ne coupe plus la session au premier trou réseau de <10s** (avant : ~5s par défaut SRT) |

`peeridletimeo` est le réglage qui compte le plus sur mobile : c'est le délai
sans le moindre paquet reçu avant que SRT **abandonne la connexion et force une
reconnexion complète** (= coupure visible). Passer de 5s (défaut) à 10s absorbe
la plupart des micro-coupures 4G sans casser la session.

**Limite constatée** : les logs (`/srv/external-tv/logs/srt-relay.log`) montrent
des tentatives de connexion répétées depuis la même IP source qui échouent au
niveau du handshake initial (avant même l'échange de données) — un problème de
latence/buffer ne peut pas corriger ça. Si ça persiste après ce changement,
le souci est plus probablement une IP source qui change en cours de session
(NAT 4G) ou un firewall/routeur côté encodeur qui bloque le retour UDP. Le
monitoring ci-dessous (§3) permet de vérifier si ça continue.

---

## 2. Réglages à vérifier côté vMix / OBS (encodeur)

| Réglage | Recommandation | Pourquoi |
|---------|----------------|----------|
| Mode SRT | **Caller** (le serveur est en Listener) | conforme à l'archi actuelle |
| Latence SRT | ≥ celle du serveur (4000 ms External TV / 12000 ms Touba TV) | SRT négocie la latence **la plus haute des deux côtés** — une latence encodeur trop basse annule le gain serveur |
| Bitrate vidéo | ≤ 70% de la bande passante upload **mesurée** (pas la bande passante annoncée par l'opérateur) | laisse de la marge pour les retransmissions SRT (ARQ), qui consomment de la bande passante en plus du flux normal |
| Keyframe interval (GOP) | 2 secondes | limite le temps de récupération visuel après une perte — un GOP long = plus de temps avant la prochaine image clé propre |
| Overhead bandwidth (`oheadbw`), si exposé par le logiciel | 25–50% sur liens instables (défaut souvent 25%) | budget supplémentaire réservé aux paquets retransmis |
| Réseau | Un seul flux sur la connexion pendant le direct ; couper les mises à jour/sync cloud en arrière-plan | évite de partager la bande passante déjà limitée |

**vMix affiche les stats SRT en direct** (paquets perdus, RTT) dans les
propriétés de la source — à surveiller pendant les 2-3 premières minutes d'un
direct pour valider que la connexion est stable avant de lancer le programme.

---

## 3. Diagnostiquer un incident en direct

```bash
# Vue d'ensemble rapide
systemctl status toubatv external-tv external-tv-2 external-tv-3

# Touba TV : voir les pertes de paquets SRT en temps réel
tail -f /srv/toubatv/logs/ffmpeg.log | grep --line-buffered "RCV-DROPPED\|error"

# External TV : voir les tentatives de connexion en temps réel
tail -f /srv/external-tv/logs/srt-relay.log

# Métriques agrégées (alimentées chaque minute, visibles sur Prometheus :9090)
cat /srv/monitoring/textfile/srt_quality.prom
```

Deux alertes Prometheus surveillent maintenant ça en continu (avant le freeze complet) :

- **`SrtPertesToubaTvElevees`** : >300 paquets perdus/minute pendant 2 min → dégradation en cours.
- **`SrtReconnexionsExternalTv`** : >5 tentatives de connexion sans succès en 3 min → connexion encodeur instable (probable NAT/4G).

---

## 4. Si le problème persiste malgré les réglages ci-dessus

Par ordre d'effort croissant :

1. **Baisser le bitrate d'encodage** (souvent le fix le plus rapide — un lien
   qui ne tient pas 2500 kbps peut tenir 1200 kbps sans coupure).
2. **Tester sur un autre réseau** (un point d'accès 4G différent, ou filaire si
   possible) pour confirmer que le problème est bien réseau et pas encodeur.
3. **Réserver de la bande passante** : sur un routeur 4G/LTE avec QoS,
   prioriser le trafic UDP vers le port SRT du serveur.
4. **Bonding cellulaire** (si le budget le permet) : boîtiers type LiveU/TVU/
   Teradek Bond qui combinent plusieurs connexions (4G + 4G, ou 4G + WiFi) pour
   lisser les coupures — la solution de référence pour les duplex terrain en
   zone de couverture irrégulière.
5. **Relais local** : un petit VPS ou Raspberry Pi avec IP publique situé plus
   près géographiquement de l'opérateur peut absorber la partie la plus
   instable de la liaison (hop court avec ARQ serré) puis relayer vers ce
   serveur sur un hop généralement plus propre. Plus lourd à mettre en place,
   mais c'est la solution la plus robuste si le lien terrain reste mauvais.
