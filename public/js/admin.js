import { initializeApp } from "https://www.gstatic.com/firebasejs/11.6.0/firebase-app.js";
import {
  getAuth,
  GoogleAuthProvider,
  onAuthStateChanged,
  signInWithPopup,
  signOut,
} from "https://www.gstatic.com/firebasejs/11.6.0/firebase-auth.js";

const BASE = window.__APP_BASE__ || "/appttv";
const DEFAULT_PHOTO = `${BASE}/assets/touba-default.svg`;
const cfg = window.__FIREBASE_CONFIG__ || {};

const app = initializeApp(cfg);
const auth = getAuth(app);
const provider = new GoogleAuthProvider();

const $ = (id) => document.getElementById(id);
let idToken = null;
let currentStatus = "queued";
let liveAds = [];

function toast(msg, isErr) {
  const el = $("toast");
  el.textContent = msg;
  el.classList.toggle("err", !!isErr);
  el.style.display = "block";
  clearTimeout(toast._t);
  toast._t = setTimeout(() => { el.style.display = "none"; }, 4000);
}

async function api(path, options = {}) {
  const headers = { ...(options.headers || {}), "Content-Type": "application/json" };
  if (idToken) headers.Authorization = `Bearer ${idToken}`;
  const res = await fetch(`${BASE}${path}`, { ...options, headers });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.message || `HTTP ${res.status}`);
  return data;
}

async function refreshToken(user) {
  idToken = await user.getIdToken(true);
}

async function loadMessages() {
  $("statusLine").textContent = "Chargement…";
  $("messageList").innerHTML = "";
  try {
    const rows = await api(`/api/admin/messages?status=${encodeURIComponent(currentStatus)}`);
    $("statusLine").textContent = `${rows.length} message(s)`;
    if (!rows.length) {
      $("messageList").innerHTML = "<p class=\"meta\">Aucun message.</p>";
      return;
    }
    rows.forEach((m) => $("messageList").appendChild(renderCard(m)));
  } catch (e) {
    $("statusLine").textContent = "";
    toast(e.message, true);
  }
}

function formatAge(iso) {
  if (!iso) return "—";
  const ms = Date.now() - new Date(iso).getTime();
  const h = Math.floor(ms / 3600000);
  if (h < 1) return "moins d'1 h";
  if (h < 24) return `${h} h`;
  const d = Math.floor(h / 24);
  return `${d} j`;
}

function photoUrl(m) {
  const url = (m.mediaUrl || "").trim();
  return url || DEFAULT_PHOTO;
}

function renderCard(m) {
  const card = document.createElement("div");
  card.className = "card";
  const st = (m.status || "").toLowerCase();
  const isDefaultPhoto = !(m.mediaUrl || "").trim();
  const payment = m.paymentMethodLabel || m.paymentMethod || "—";

  card.innerHTML = `
    <dl class="card-fields">
      <div class="card-field"><dt>Nom</dt><dd>${esc(m.fullName || "—")}</dd></div>
      <div class="card-field"><dt>Pays</dt><dd>${esc(m.country || "—")}</dd></div>
      <div class="card-field"><dt>Numéro de tel</dt><dd>${esc(m.phone || "—")}</dd></div>
      <div class="card-field"><dt>Message</dt><dd class="msg">${esc(m.text || "—")}</dd></div>
      <div class="card-field"><dt>Photo</dt><dd>
        <img class="card-photo" src="${attrUrl(photoUrl(m))}" alt="Photo dédicace" loading="lazy" />
        ${isDefaultPhoto ? '<span class="meta">Logo TOUBA TV (aucune photo jointe)</span>' : ""}
        ${m.driveWebViewLink ? `<div><a class="drive-link" href="${attrUrl(m.driveWebViewLink)}" target="_blank" rel="noopener">Voir sur Google Drive</a></div>` : ""}
      </dd></div>
      <div class="card-field"><dt>Moyen de paiement</dt><dd>${esc(payment)}</dd></div>
    </dl>
    ${m.rejectReason ? `<div class="meta">Motif rejet : ${esc(m.rejectReason)}</div>` : ""}
    <div class="card-footer">
      <span>Statut : ${esc(st)} · ${formatAge(m.createdAt)}</span>
      <span>${esc(m.type || "")} · ${m.amount || 0} F CFA</span>
    </div>
    <div class="actions"></div>
  `;
  const actions = card.querySelector(".actions");

  if (st === "queued") {
    actions.append(btn("Approuver", "btn-ok", () => moderate(m.id, "approve")));
    actions.append(btn("Rejeter", "btn-danger", () => {
      const reason = prompt("Motif du rejet (min. 3 caractères) :", "Non conforme");
      if (reason && reason.length >= 3) moderate(m.id, "reject", reason);
    }));
    if ((m.mediaUrl || "").trim() && !m.driveWebViewLink) {
      actions.append(btn("Sauver photo → Drive", "btn-ghost", () => driveBackup(m.id)));
    }
  }
  if (st === "approved") {
    actions.append(btn("Diffuser (XML)", "btn-warn", () => broadcast(m.id)));
    actions.append(btn("Copier URL vMix", "btn-ghost", async () => {
      const { urls } = await api("/api/admin/vmix-urls");
      const url = urls.message(m.id);
      await navigator.clipboard.writeText(url);
      toast("URL vMix copiée");
    }));
  }
  return card;
}

async function driveBackup(id) {
  try {
    const r = await api(`/api/admin/messages/${id}/drive-backup`, { method: "POST" });
    toast(r.link ? "Photo sauvegardée sur Drive" : "Sauvegarde Drive OK");
    loadMessages();
  } catch (e) {
    toast(e.message, true);
  }
}

function btn(label, cls, onClick) {
  const b = document.createElement("button");
  b.type = "button";
  b.className = `btn ${cls}`;
  b.textContent = label;
  b.addEventListener("click", onClick);
  return b;
}

function esc(s) {
  return String(s ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/"/g, "&quot;");
}

function attrUrl(url) {
  return String(url ?? "").replace(/"/g, "%22");
}

async function moderate(id, action, reason) {
  try {
    if (action === "approve") {
      await api(`/api/admin/messages/${id}/approve`, { method: "POST" });
    } else {
      await api(`/api/admin/messages/${id}/reject`, { method: "POST", body: JSON.stringify({ reason }) });
    }
    toast(action === "approve" ? "Message approuvé" : "Message rejeté");
    loadMessages();
  } catch (e) {
    toast(e.message, true);
  }
}

async function broadcast(id) {
  try {
    await api(`/api/admin/messages/${id}/broadcast`, { method: "POST" });
    toast("Message diffusé — XML mis à jour");
    loadMessages();
  } catch (e) {
    toast(e.message, true);
  }
}

async function loadVmixUrls() {
  try {
    const { urls } = await api("/api/admin/vmix-urls");
    $("urlCurrent").textContent = urls.currentFile;
    $("urlFifo").textContent = urls.fifo;
  } catch (e) {
    toast(e.message, true);
  }
}

async function loadLiveConfig() {
  try {
    const { data } = await api("/api/config/live");
    $("hlsUrl").value = data.hlsUrl || "";
    $("viewers").value = data.viewers ?? 0;
    liveAds = Array.isArray(data.ads) ? data.ads : [];
    renderAds();
  } catch (e) {
    toast(e.message, true);
  }
}

function renderAds() {
  const wrap = $("adsEditor");
  wrap.innerHTML = "";
  liveAds.forEach((ad, i) => {
    const row = document.createElement("div");
    row.className = "ad-row";
    row.innerHTML = `
      <div><label>Titre</label><input data-i="${i}" data-f="title" value="${esc(ad.title)}" /></div>
      <div><label>Catégorie</label><input data-i="${i}" data-f="category" value="${esc(ad.category)}" /></div>
      <div><label>CTA</label><input data-i="${i}" data-f="cta" value="${esc(ad.cta)}" /></div>
      <div><label>URL</label><input data-i="${i}" data-f="url" value="${esc(ad.url)}" /></div>
    `;
    row.querySelectorAll("input").forEach((inp) => {
      inp.addEventListener("input", () => {
        liveAds[+inp.dataset.i][inp.dataset.f] = inp.value;
      });
    });
    const del = btn("Supprimer", "btn-danger", () => {
      liveAds.splice(i, 1);
      renderAds();
    });
    del.style.marginTop = "0.5rem";
    row.appendChild(del);
    wrap.appendChild(row);
  });
}

$("btnGoogle").addEventListener("click", async () => {
  try {
    await signInWithPopup(auth, provider);
  } catch (e) {
    toast(e.message, true);
  }
});

$("btnLogout").addEventListener("click", () => signOut(auth));

$("btnAddAd").addEventListener("click", () => {
  liveAds.push({
    id: "ad" + Date.now(),
    category: "",
    title: "",
    cta: "",
    url: "",
  });
  renderAds();
});

$("btnSaveLive").addEventListener("click", async () => {
  try {
    await api("/api/config/live", {
      method: "PUT",
      body: JSON.stringify({
        hlsUrl: $("hlsUrl").value.trim(),
        viewers: Number($("viewers").value) || 0,
        ads: liveAds,
      }),
    });
    toast("Configuration live enregistrée");
  } catch (e) {
    toast(e.message, true);
  }
});

$("btnSeed").addEventListener("click", async () => {
  if (!confirm("Initialiser tarifs & config live dans Firestore ?")) return;
  try {
    await api("/api/admin/seed", { method: "POST" });
    toast("Base initialisée");
    loadLiveConfig();
  } catch (e) {
    toast(e.message, true);
  }
});

$("btnCopyCurrent").addEventListener("click", async () => {
  const t = $("urlCurrent").textContent;
  if (t) { await navigator.clipboard.writeText(t); toast("URL copiée"); }
});

$("btnCopyFifo").addEventListener("click", async () => {
  const t = $("urlFifo").textContent;
  if (t) { await navigator.clipboard.writeText(t); toast("URL copiée"); }
});

document.querySelectorAll("#statusTabs button").forEach((b) => {
  b.addEventListener("click", () => {
    currentStatus = b.dataset.status;
    document.querySelectorAll("#statusTabs button").forEach((x) => x.classList.toggle("active", x === b));
    loadMessages();
  });
});

document.querySelectorAll("#mainTabs button").forEach((b) => {
  b.addEventListener("click", () => {
    const tab = b.dataset.tab;
    document.querySelectorAll("#mainTabs button").forEach((x) => x.classList.toggle("active", x === b));
    $("tabMod").classList.toggle("hidden", tab !== "mod");
    $("tabPubs").classList.toggle("hidden", tab !== "pubs");
    $("tabVmix").classList.toggle("hidden", tab !== "vmix");
    if (tab === "pubs") loadLiveConfig();
    if (tab === "vmix") loadVmixUrls();
  });
});

onAuthStateChanged(auth, async (user) => {
  if (user) {
    try {
      await refreshToken(user);
      $("loginSection").classList.add("hidden");
      $("appSection").classList.remove("hidden");
      $("userBar").classList.remove("hidden");
      $("userEmail").textContent = user.email || user.uid;
      loadMessages();
    } catch (e) {
      toast(e.message, true);
      signOut(auth);
    }
  } else {
    idToken = null;
    $("loginSection").classList.remove("hidden");
    $("appSection").classList.add("hidden");
    $("userBar").classList.add("hidden");
  }
});

setInterval(async () => {
  if (auth.currentUser) await refreshToken(auth.currentUser);
}, 45 * 60 * 1000);
