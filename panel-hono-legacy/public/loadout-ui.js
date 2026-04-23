/**
 * Loadout interactivo: catálogo via /api/catalog/*, persistência /api/profile/loadout
 */
const SERVER_KEYS = [
  "CS2_SERVERNAME",
  "CS2_STARTMAP",
  "CS2_MAPGROUP",
  "CS2_GAMETYPE",
  "CS2_GAMEMODE",
  "CS2_MAXPLAYERS",
  "CS2_RCONPW",
  "CS2_PW",
  "CS2_HOST_WORKSHOP_MAP",
  "CS2_HOST_WORKSHOP_COLLECTION",
  "CS2_GAMEALIAS",
  "SRCDS_TOKEN",
  "PANEL_BASE_URL",
  "SESSION_SECRET",
  "LOADOUT_API_KEY",
  "ADMIN_STEAMID64S",
];

const state = {
  me: null,
  loadout: defaultLoadout(),
  section: "skins",
  skinFilter: "all",
  skinQ: "",
  skinOffset: 0,
  skinTotal: 0,
  skinLoading: false,
  agentTeam: "all",
  agentQ: "",
  agentOffset: 0,
  agentTotal: 0,
  selectedAgent: null,
  musicQ: "",
  musicOffset: 0,
  musicTotal: 0,
  saveTimer: null,
  saveStatus: "Pronto.",
};

function defaultLoadout() {
  return {
    version: 1,
    byWeaponId: {},
    agent_ct: null,
    agent_t: null,
    musicKit: null,
  };
}

function normalizeLoadout(body) {
  if (!body || typeof body !== "object") {
    return defaultLoadout();
  }
  const b = { ...defaultLoadout(), ...body };
  if (!b.byWeaponId || typeof b.byWeaponId !== "object") {
    b.byWeaponId = (body.slots && typeof body.slots === "object" ? body.slots : {}) || {};
  }
  return b;
}

function packSkin(s) {
  return {
    skinId: s.id,
    name: s.name,
    paint_index: String(s.paint_index),
    weapon_id: s.weapon?.weapon_id,
    weaponKey: s.weapon?.id,
    weaponName: s.weapon?.name,
    image: s.image,
    rarity: s.rarity?.name,
  };
}

function packAgent(a) {
  return {
    id: a.id,
    name: a.name,
    def_index: String(a.def_index),
    team: a.team?.id,
    image: a.image,
  };
}

function packMusic(m) {
  return { id: m.id, name: m.name, def_index: m.def_index != null ? String(m.def_index) : "", image: m.image };
}

async function api(path, opt = {}) {
  return fetch(path, { credentials: "include", ...opt });
}

function debounceSave() {
  if (state.saveTimer) {
    clearTimeout(state.saveTimer);
  }
  setSaveStatus("A guardar…", false);
  state.saveTimer = setTimeout(flushLoadout, 500);
}

async function flushLoadout() {
  state.saveTimer = null;
  const r = await api("/api/profile/loadout", {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(state.loadout),
  });
  if (!r.ok) {
    setSaveStatus("Erro a guardar.", true);
    return;
  }
  setSaveStatus("Guardado.", false);
}

function setSaveStatus(t, isErr) {
  state.saveStatus = t;
  const el = document.getElementById("save-status");
  if (el) {
    el.textContent = t;
    el.style.color = isErr ? "#f78" : "var(--muted)";
  }
}

function skinCardHtml(s) {
  const wk = s.weapon?.id;
  const sel = state.loadout.byWeaponId[wk];
  const on = sel && sel.skinId === s.id;
  const rar = s.rarity?.color || "#4b5c7a";
  return `
  <article class="item-card ${on ? "is-selected" : ""}" data-kind="skin" style="--rarity:${escAttr(rar)}" data-json="${escAttr(
    JSON.stringify(s)
  )}">
    <div class="item-card-img"><img loading="lazy" src="${escAttr(s.image)}" alt="" crossorigin="anonymous" /></div>
    <div class="item-card-body">
      <span class="item-card-weapon">${esc(s.weapon?.name || "")}</span>
      <span class="item-card-name">${esc(s.name)}</span>
    </div>
  </article>`;
}

function agentCardHtml(a) {
  const ct = state.loadout.agent_ct?.id === a.id;
  const tt = state.loadout.agent_t?.id === a.id;
  const pick = state.selectedAgent?.id === a.id;
  const rar = a.rarity?.color || "#888";
  return `
  <article class="item-card ${pick ? "is-selected" : ""}" data-kind="agent" style="--rarity:${escAttr(
    rar
  )}" data-json="${escAttr(JSON.stringify(a))}" title="Clica para selecionar; depois aplica a CT/T em baixo.">
    <div class="item-card-img"><img loading="lazy" src="${escAttr(a.image)}" alt="" crossorigin="anonymous" /></div>
    <div class="item-card-body">
      <span class="item-card-weapon">${ct ? "CT ✓" : ""} ${tt ? "T ✓" : ""} ${!ct && !tt ? a.team?.name : ""}</span>
      <span class="item-card-name">${esc(a.name)}</span>
    </div>
  </article>`;
}

function musicCardHtml(m) {
  const on = state.loadout.musicKit?.id === m.id;
  return `
  <article class="item-card ${on ? "is-selected" : ""}" data-kind="music" style="--rarity:#4b69ff" data-json="${escAttr(
    JSON.stringify(m)
  )}">
    <div class="item-card-img"><img loading="lazy" src="${escAttr(m.image || "")}" alt="" crossorigin="anonymous" /></div>
    <div class="item-card-body">
      <span class="item-card-weapon">Kit de música</span>
      <span class="item-card-name">${esc(m.name)}</span>
    </div>
  </article>`;
}

function esc(s) {
  const d = document.createElement("div");
  d.textContent = s ?? "";
  return d.innerHTML;
}
function escAttr(s) {
  return String(s)
    .replace(/&/g, "&amp;")
    .replace(/"/g, "&quot;")
    .replace(/</g, "&lt;")
    .replace(/\n/g, "&#10;");
}

async function fetchCatalogSkins(append) {
  if (state.skinLoading) {
    return;
  }
  state.skinLoading = true;
  const hint = document.getElementById("skins-hint");
  if (hint) {
    hint.textContent = "A carregar catálogo de skins (primeira vez pode demorar)…";
  }
  const u = new URL("/api/catalog/skins", location.origin);
  u.searchParams.set("filter", state.skinFilter);
  u.searchParams.set("q", state.skinQ);
  u.searchParams.set("limit", "48");
  u.searchParams.set("offset", String(append ? state.skinOffset : 0));
  const r = await api(u.pathname + u.search);
  const j = await r.json();
  state.skinLoading = false;
  if (!r.ok) {
    if (hint) {
      hint.textContent = j.error || "Erro a carregar.";
    }
    return;
  }
  if (j.error) {
    if (hint) {
      hint.textContent = j.error;
    }
  } else {
    if (hint) {
      hint.textContent = `${j.total} itens — filtro: ${state.skinFilter}`;
    }
  }
  const grid = document.getElementById("skins-grid");
  if (!grid) {
    return;
  }
  if (!append) {
    state.skinOffset = 0;
    grid.innerHTML = "";
  }
  state.skinTotal = j.total;
  for (const s of j.items) {
    grid.insertAdjacentHTML("beforeend", skinCardHtml(s));
  }
  state.skinOffset += j.items.length;
  const more = document.getElementById("skins-more");
  if (more) {
    more.style.display = state.skinOffset < state.skinTotal ? "inline-block" : "none";
  }
  syncSkinSelectionHiglight();
}

async function fetchCatalogAgents(append) {
  const u = new URL("/api/catalog/agents", location.origin);
  u.searchParams.set("team", state.agentTeam);
  u.searchParams.set("q", state.agentQ);
  u.searchParams.set("limit", "48");
  u.searchParams.set("offset", String(append ? state.agentOffset : 0));
  const r = await api(u.pathname + u.search);
  const j = await r.json();
  const grid = document.getElementById("agents-grid");
  if (!grid) {
    return;
  }
  if (!append) {
    state.agentOffset = 0;
    grid.innerHTML = "";
  }
  if (!r.ok) {
    document.getElementById("agents-hint").textContent = j.error || "Erro";
    return;
  }
  state.agentTotal = j.total;
  for (const a of j.items) {
    grid.insertAdjacentHTML("beforeend", agentCardHtml(a));
  }
  state.agentOffset += j.items.length;
  const more = document.getElementById("agents-more");
  if (more) {
    more.style.display = state.agentOffset < state.agentTotal ? "inline-block" : "none";
  }
}

async function fetchCatalogMusic(append) {
  const u = new URL("/api/catalog/music", location.origin);
  u.searchParams.set("q", state.musicQ);
  u.searchParams.set("limit", "60");
  u.searchParams.set("offset", String(append ? state.musicOffset : 0));
  const r = await api(u.pathname + u.search);
  const j = await r.json();
  const grid = document.getElementById("music-grid");
  if (!grid) {
    return;
  }
  if (!append) {
    state.musicOffset = 0;
    grid.innerHTML = "";
  }
  if (!r.ok) {
    return;
  }
  state.musicTotal = j.total;
  for (const m of j.items) {
    grid.insertAdjacentHTML("beforeend", musicCardHtml(m));
  }
  state.musicOffset += j.items.length;
  const more = document.getElementById("music-more");
  if (more) {
    more.style.display = state.musicOffset < state.musicTotal ? "inline-block" : "none";
  }
}

function gridClickHandler(ev) {
  const card = ev.target.closest?.(".item-card");
  if (!card || !ev.currentTarget.contains(card)) {
    return;
  }
  onCardClick({ currentTarget: card });
}

function onCardClick(ev) {
  const card = ev.currentTarget;
  const kind = card.getAttribute("data-kind");
  const raw = card.getAttribute("data-json");
  if (!raw) {
    return;
  }
  const data = JSON.parse(raw);
  if (kind === "skin") {
    const s = data;
    const wk = s.weapon?.id;
    if (!wk) {
      return;
    }
    state.loadout.byWeaponId[wk] = packSkin(s);
    debounceSave();
    renderSelectionSummary();
    document.querySelectorAll("#skins-grid .item-card").forEach((c) => c.classList.remove("is-selected"));
    syncSkinSelectionHiglight();
  } else if (kind === "agent") {
    state.selectedAgent = packAgent(data);
    document.querySelectorAll("#agents-grid .item-card").forEach((c) => c.classList.remove("is-selected"));
    card.classList.add("is-selected");
  } else if (kind === "music") {
    state.loadout.musicKit = packMusic(data);
    debounceSave();
    renderSelectionSummary();
    document.querySelectorAll("#music-grid .item-card").forEach((c) => c.classList.remove("is-selected"));
    card.classList.add("is-selected");
  }
}

function syncSkinSelectionHiglight() {
  document.querySelectorAll("#skins-grid .item-card").forEach((c) => {
    const d = c.getAttribute("data-json");
    if (!d) {
      return;
    }
    const s = JSON.parse(d);
    const wk = s.weapon?.id;
    const sel = state.loadout.byWeaponId[wk];
    if (sel && sel.skinId === s.id) {
      c.classList.add("is-selected");
    }
  });
}

function renderSelectionSummary() {
  const box = document.getElementById("selection-summary");
  if (!box) {
    return;
  }
  const L = state.loadout;
  const parts = [];
  for (const [wk, p] of Object.entries(L.byWeaponId)) {
    parts.push(
      pillHtml(p.image, p.name, p.weaponName || wk)
    );
  }
  if (L.agent_ct) {
    parts.push(pillHtml(L.agent_ct.image, L.agent_ct.name, "Agente CT"));
  }
  if (L.agent_t) {
    parts.push(pillHtml(L.agent_t.image, L.agent_t.name, "Agente T"));
  }
  if (L.musicKit) {
    parts.push(pillHtml(L.musicKit.image, L.musicKit.name, "Música"));
  }
  box.innerHTML = parts.length ? parts.join("") : "<p class='muted'>Nada escolhido ainda.</p>";
}

function pillHtml(img, title, sub) {
  return `<div class="sel-pill"><img src="${escAttr(img || "")}" alt=""/><div class="txt"><b>${esc(
    title
  )}</b><small>${esc(sub)}</small></div></div>`;
}

function goSection(name) {
  state.section = name;
  document.querySelectorAll("#section-nav .side-item").forEach((b) => {
    b.classList.toggle("is-active", b.getAttribute("data-section") === name);
  });
  document.getElementById("section-skins").classList.toggle("hidden", name !== "skins");
  document.getElementById("section-agents").classList.toggle("hidden", name !== "agents");
  document.getElementById("section-music").classList.toggle("hidden", name !== "music");
  if (name === "skins" && !document.getElementById("skins-grid").childElementCount) {
    void fetchCatalogSkins(false);
  }
  if (name === "agents" && !document.getElementById("agents-grid").childElementCount) {
    void fetchCatalogAgents(false);
  }
  if (name === "music" && !document.getElementById("music-grid").childElementCount) {
    void fetchCatalogMusic(false);
  }
}

function buildServerForm(env) {
  const el = document.getElementById("server-fields");
  if (!el) {
    return;
  }
  el.innerHTML = "";
  for (const k of SERVER_KEYS) {
    const v = env[k] ?? "";
    const d = document.createElement("div");
    d.className = "field";
    d.innerHTML = `<label for="f-${k}">${k}</label><input id="f-${k}" name="${k}" value="${String(v).replace(
      /"/g,
      "&quot;"
    )}" type="${/TOKEN|SECRET|KEY|RCONPW/i.test(k) ? "password" : "text"}" />`;
    el.append(d);
  }
}

let searchDebounce;
function applySkinSearch() {
  clearTimeout(searchDebounce);
  searchDebounce = setTimeout(() => {
    const v = document.getElementById("grid-search")?.value || "";
    state.skinQ = v;
    void fetchCatalogSkins(false);
  }, 320);
}

document.getElementById("section-nav")?.addEventListener("click", (e) => {
  const b = e.target.closest(".side-item");
  if (!b) {
    return;
  }
  goSection(b.getAttribute("data-section"));
});

document.getElementById("skin-filters")?.addEventListener("click", (e) => {
  const b = e.target.closest(".fchip");
  if (!b) {
    return;
  }
  document.querySelectorAll("#skin-filters .fchip").forEach((x) => x.classList.remove("is-on"));
  b.classList.add("is-on");
  state.skinFilter = b.getAttribute("data-filter") || "all";
  void fetchCatalogSkins(false);
});

document.getElementById("grid-search")?.addEventListener("input", () => applySkinSearch());

document.getElementById("skins-more")?.addEventListener("click", () => fetchCatalogSkins(true));

document.getElementById("agent-team")?.addEventListener("click", (e) => {
  const b = e.target.closest(".fchip");
  if (!b) {
    return;
  }
  document.querySelectorAll("#agent-team .fchip").forEach((x) => x.classList.remove("is-on"));
  b.classList.add("is-on");
  state.agentTeam = b.getAttribute("data-team") || "all";
  void fetchCatalogAgents(false);
});

let agentSearchT;
document.getElementById("agents-search")?.addEventListener("input", () => {
  clearTimeout(agentSearchT);
  agentSearchT = setTimeout(() => {
    state.agentQ = document.getElementById("agents-search").value || "";
    void fetchCatalogAgents(false);
  }, 300);
});
document.getElementById("agents-more")?.addEventListener("click", () => fetchCatalogAgents(true));

let musicT;
document.getElementById("music-search")?.addEventListener("input", () => {
  clearTimeout(musicT);
  musicT = setTimeout(() => {
    state.musicQ = document.getElementById("music-search").value || "";
    void fetchCatalogMusic(false);
  }, 300);
});
document.getElementById("music-more")?.addEventListener("click", () => fetchCatalogMusic(true));

document.querySelectorAll("[data-apply-agent]").forEach((btn) => {
  btn.addEventListener("click", () => {
    if (!state.selectedAgent) {
      setSaveStatus("Selecciona um agente na grelha.", true);
      return;
    }
    const w = btn.getAttribute("data-apply-agent");
    if (w === "ct") {
      state.loadout.agent_ct = { ...state.selectedAgent };
    } else if (w === "t") {
      state.loadout.agent_t = { ...state.selectedAgent };
    } else {
      state.loadout.agent_ct = { ...state.selectedAgent };
      state.loadout.agent_t = { ...state.selectedAgent };
    }
    debounceSave();
    renderSelectionSummary();
    void fetchCatalogAgents(false);
  });
});

document.getElementById("btn-save-server")?.addEventListener("click", async () => {
  const updates = {};
  for (const k of SERVER_KEYS) {
    const el = document.getElementById(`f-${k}`);
    if (el) {
      updates[k] = el.value;
    }
  }
  const r = await api("/api/panel/server", {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ updates }),
  });
  const j = await r.json();
  if (!r.ok) {
    alert(j.error || "Erro");
    return;
  }
  buildServerForm(j.env);
  alert("ficheiro .env guardado. Reinicia: docker compose up -d cs2");
});

document.getElementById("server-toggle")?.addEventListener("click", (e) => {
  const p = document.getElementById("server-panel");
  const t = e.currentTarget;
  const collapsed = p.classList.toggle("collapsed");
  t.setAttribute("aria-expanded", (!collapsed).toString());
  t.textContent = collapsed
    ? "Servidor Docker (mapa, CS2_*, GSLT) ▸"
    : "Servidor Docker (mapa, CS2_*, GSLT) ▾";
});

async function main() {
  const meR = await api("/api/me");
  const me = await meR.json();
  const userLine = document.getElementById("user-line");
  const loginBtn = document.getElementById("btn-login");
  if (!me.user) {
    userLine.textContent = "Não autenticado";
    document.getElementById("app").classList.add("hidden");
    document.getElementById("gate")?.classList.remove("hidden");
    loginBtn?.classList.remove("hidden");
    return;
  }
  state.me = me.user;
  userLine.textContent = "Steam " + me.user.steamid64;
  loginBtn?.classList.add("hidden");
  document.getElementById("btn-lobby-create")?.classList.remove("hidden");
  document.getElementById("lobby-join-wrap")?.classList.remove("hidden");
  document.getElementById("gate")?.classList.add("hidden");
  document.getElementById("app")?.classList.remove("hidden");
  document.getElementById("server-panel")?.classList.remove("hidden");

  const lr = await (await api("/api/profile/loadout")).json();
  if (!lr.error) {
    state.loadout = normalizeLoadout(lr.body);
  }
  renderSelectionSummary();

  const sr = await (await api("/api/panel/server")).json();
  if (!sr.error) {
    buildServerForm(sr.env);
  }

  document.getElementById("skins-grid")?.addEventListener("click", gridClickHandler);
  document.getElementById("agents-grid")?.addEventListener("click", gridClickHandler);
  document.getElementById("music-grid")?.addEventListener("click", gridClickHandler);

  goSection("skins");
  void fetchCatalogSkins(false);

  document.getElementById("btn-lobby-create")?.addEventListener("click", async () => {
    const r = await api("/api/lobbies", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({}),
    });
    if (!r.ok) {
      const t = await r.text();
      alert(t);
      return;
    }
    const j = await r.json();
    const c = j.lobby?.code;
    if (c) {
      location.href = "/lobby/" + c;
    }
  });
  document.getElementById("btn-lobby-join")?.addEventListener("click", () => {
    const v = (document.getElementById("lobby-code-in")?.value || "").trim().toUpperCase();
    if (v.length < 4) {
      alert("Introduz o código da lobby (letras e números).");
      return;
    }
    location.href = "/lobby/" + v;
  });
}

main().catch((e) => {
  const userLine = document.getElementById("user-line");
  if (userLine) {
    userLine.textContent = "Erro: " + e;
  }
});
