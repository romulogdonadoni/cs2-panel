const MAPS = [
  { id: "de_mirage", name: "Mirage" },
  { id: "de_dust2", name: "Dust II" },
  { id: "de_inferno", name: "Inferno" },
  { id: "de_nuke", name: "Nuke" },
  { id: "de_overpass", name: "Overpass" },
  { id: "de_vertigo", name: "Vertigo" },
  { id: "de_ancient", name: "Ancient" },
  { id: "de_anubis", name: "Anubis" },
];

const REGION_LBL = {
  sao_paulo: "São Paulo",
  miami: "Miami",
  europe: "Europa (Frankfurt)",
  custom: "Personalizado (Docker)",
};

const MODE_LBL = {
  competitive: "Competitivo",
  casual: "Casual",
  wingman: "Wingman",
  deathmatch: "Deathmatch",
};

const code = (() => {
  const m = location.pathname.match(/\/lobby\/([A-Z0-9]+)/i);
  return m ? m[1].toUpperCase() : "";
})();

let me = null;
let pollT = null;
let isLeader = false;
let lastJson = null;
let formSynced = false;

function $(id) {
  return document.getElementById(id);
}

function shortId(s) {
  if (!s || s.length < 6) {
    return s;
  }
  return "…" + s.slice(-5);
}

function showErr(t) {
  const el = $("lobby-err");
  if (!el) {
    return;
  }
  el.textContent = t;
  el.classList.remove("hidden");
}

function esc(s) {
  const d = document.createElement("div");
  d.textContent = s ?? "";
  return d.innerHTML;
}

async function api(path, o = {}) {
  return fetch(path, { credentials: "include", ...o });
}

function mapName(id) {
  return MAPS.find((m) => m.id === id)?.name || id;
}

function fillMapSelect() {
  const s = $("f-map");
  if (!s) {
    return;
  }
  s.innerHTML = MAPS.map((m) => `<option value="${m.id}">${esc(m.name)}</option>`).join("");
}

function render() {
  if (!lastJson) {
    return;
  }
  const { lobby, baseUrl } = lastJson;
  isLeader = me && me.steamid64 === lobby.leaderSteamid64;

  $("lobby-id-lbl").textContent = "#" + lobby.code;
  $("map-ph").textContent = mapName(lobby.mapId);
  $("mode-lbl").textContent = MODE_LBL[lobby.gameMode] || lobby.gameMode;
  $("region-lbl").textContent = REGION_LBL[lobby.region] || lobby.region;
  $("ms-lbl").textContent = "• ~16 ms";
  $("t1-name").textContent = lobby.team1Name;
  $("t2-name").textContent = lobby.team2Name;
  $("max-per-t").textContent = String(lobby.maxPerTeam);
  $("chat-code").textContent = lobby.code;

  const jUrl = (baseUrl || location.origin) + "/lobby/" + lobby.code;
  document.getElementById("btn-copy-invite").dataset.url = jUrl;

  const cap = lobby.maxPerTeam * 2;
  const filled = lobby.members.filter((m) => m.team === 1 || m.team === 2).length;
  $("status-pill").textContent = `Aguardando jogadores ${filled}/${cap}`;

  const m1 = lobby.members.filter((m) => m.team === 1);
  const m2 = lobby.members.filter((m) => m.team === 2);
  renderSlots("slots-1", m1, lobby.maxPerTeam, 1);
  renderSlots("slots-2", m2, lobby.maxPerTeam, 2);

  const specs = lobby.members.filter((m) => m.team === 3);
  $("spec-list").innerHTML = specs.length
    ? specs.map((p) => `<li><span class="pl-av"></span> ${esc(shortId(p.steamid64))}</li>`).join("")
    : "<li class='muted'>Nenhum</li>";

  $("btn-delete-lobby").classList.toggle("hidden", !isLeader);
  $("size-ctrl").querySelectorAll("button").forEach((b) => (b.disabled = !isLeader));
  $("edit-t1").disabled = !isLeader;
  $("edit-t2").disabled = !isLeader;
  const fs = document.querySelectorAll(
    "#panel-cfg input, #panel-cfg select, #btn-save-preset"
  );
  fs.forEach((x) => {
    if (x.id === "btn-save-preset") {
      x.disabled = !isLeader;
    } else {
      x.disabled = !isLeader;
    }
  });

  const self = lobby.members.find((m) => m.steamid64 === me.steamid64);
  $("self-bar").classList.toggle("hidden", !self);
  if (self) {
    const cb = $("self-ready");
    if (cb) {
      cb.checked = self.isReady;
    }
  }

  syncConfigForm(lobby);
}

function syncConfigForm(lobby) {
  if (isLeader && formSynced) {
    return;
  }
  const st = lobby.settings || {};
  $("f-mode").value = lobby.gameMode;
  $("f-lobby-visibility").value = st.lobbyVisibility || "public";
  $("f-map-sel").value = st.mapSelection || "selected";
  $("f-map").value = lobby.mapId;
  $("f-region").value = lobby.region;
  $("f-team-sel").value = st.teamSelection || "knife_round";
  $("f-voice").value = st.voiceChat || "all";
  $("f-free").checked = st.freeTeamSelect !== false;
  $("f-bots").checked = !!st.bots;
  $("f-ready").checked = st.readyCheck !== false;
  $("f-extra").checked = !!st.extraSettings;
  $("f-fun").checked = !!st.funSettings;
  if (isLeader) {
    formSynced = true;
  }
}

function renderSlots(ulId, list, max, team) {
  const ul = $(ulId);
  if (!ul) {
    return;
  }
  const rows = [];
  for (let i = 0; i < max; i++) {
    const p = list[i];
    if (p) {
      const canKick = isLeader && !p.isLeader;
      rows.push(
        `<li>
          <div class="pl-meta">
            <span class="pl-av"></span>
            <span>${p.isLeader ? "★ " : ""}${esc(shortId(p.steamid64))} ${p.isReady ? "✓" : ""}</span>
          </div>
          ${canKick ? `<button type="button" class="kbtn" data-kick="${esc(p.steamid64)}">expulsar</button>` : ""}
        </li>`
      );
    } else {
      rows.push(`<li class="empty">Vazio</li>`);
    }
  }
  ul.innerHTML = rows.join("");

  ul.querySelectorAll("[data-kick]").forEach((b) => {
    b.addEventListener("click", () => {
      if (confirm("Expulsar este jogador?")) {
        kick(b.getAttribute("data-kick"));
      }
    });
  });
}

async function loadLobby() {
  if (!code) {
    showErr("URL inválida.");
    return;
  }
  const r = await api("/api/lobbies/" + encodeURIComponent(code));
  if (r.status === 404) {
    showErr("Lobby não encontrada.");
    return;
  }
  const j = await r.json();
  if (j.error) {
    showErr(j.error);
    return;
  }
  lastJson = { lobby: j.lobby, baseUrl: j.baseUrl || lastJson?.baseUrl || location.origin };
  render();
}

async function joinTeam(t) {
  const r = await api("/api/lobbies/" + encodeURIComponent(code) + "/me", {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ team: t }),
  });
  if (!r.ok) {
    const j = await r.json().catch(() => ({}));
    alert(j.error || (await r.text()));
    return;
  }
  formSynced = false;
  await loadLobby();
}

async function setReady(v) {
  await api("/api/lobbies/" + encodeURIComponent(code) + "/me", {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ isReady: v }),
  });
  await loadLobby();
}

async function kick(sid) {
  await api("/api/lobbies/" + encodeURIComponent(code) + "/kick", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ steamid64: sid }),
  });
  await loadLobby();
}

async function saveSettings() {
  const st = {
    lobbyVisibility: $("f-lobby-visibility").value,
    mapSelection: $("f-map-sel").value,
    teamSelection: $("f-team-sel").value,
    voiceChat: $("f-voice").value,
    freeTeamSelect: $("f-free").checked,
    bots: $("f-bots").checked,
    readyCheck: $("f-ready").checked,
    extraSettings: $("f-extra").checked,
    funSettings: $("f-fun").checked,
  };
  const r = await api("/api/lobbies/" + encodeURIComponent(code) + "/settings", {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      team1Name: $("t1-name").textContent.trim(),
      team2Name: $("t2-name").textContent.trim(),
      mapId: $("f-map").value,
      gameMode: $("f-mode").value,
      region: $("f-region").value,
      maxPerTeam: parseInt($("max-per-t").textContent, 10) || 5,
      settings: st,
    }),
  });
  if (!r.ok) {
    const j = await r.json().catch(() => ({}));
    alert(j.error || "Erro");
    return;
  }
  formSynced = false;
  await loadLobby();
}

function bumpSize(d) {
  if (!isLeader) {
    return;
  }
  const el = $("max-per-t");
  let n = parseInt(el.textContent, 10) || 5;
  n = Math.min(8, Math.max(1, n + d));
  el.textContent = String(n);
  void saveSettings();
}

function bind() {
  $("join-1")?.addEventListener("click", () => void joinTeam(1));
  $("join-2")?.addEventListener("click", () => void joinTeam(2));
  $("join-spec")?.addEventListener("click", () => void joinTeam(3));
  document.getElementById("btn-copy-invite")?.addEventListener("click", async () => {
    const u = document.getElementById("btn-copy-invite").dataset.url || location.href;
    try {
      await navigator.clipboard.writeText(u);
      alert("Link copiado: " + u);
    } catch {
      prompt("Copia o link:", u);
    }
  });
  $("btn-delete-lobby")?.addEventListener("click", async () => {
    if (!confirm("Excluir lobby para todos?")) {
      return;
    }
    const r = await api("/api/lobbies/" + encodeURIComponent(code), { method: "DELETE" });
    if (r.ok) {
      location.href = "/";
    } else {
      alert("Erro");
    }
  });
  $("self-ready")?.addEventListener("change", (e) => {
    setReady(e.target.checked);
  });
  $("btn-save-preset")?.addEventListener("click", () => void saveSettings());
  $("team-size-min")?.addEventListener("click", () => bumpSize(-1));
  $("team-size-plus")?.addEventListener("click", () => bumpSize(1));
  $("edit-t1")?.addEventListener("click", () => {
    if (!isLeader) {
      return;
    }
    const n = prompt("Nome do time 1:", $("t1-name").textContent);
    if (n == null) {
      return;
    }
    $("t1-name").textContent = n;
    void saveSettings();
  });
  $("edit-t2")?.addEventListener("click", () => {
    if (!isLeader) {
      return;
    }
    const n = prompt("Nome do time 2:", $("t2-name").textContent);
    if (n == null) {
      return;
    }
    $("t2-name").textContent = n;
    void saveSettings();
  });

  document.querySelectorAll(".tab").forEach((t) => {
    t.addEventListener("click", () => {
      const tab = t.getAttribute("data-tab");
      document.querySelectorAll(".tab").forEach((x) => x.classList.toggle("is-on", x === t));
      $("panel-cfg").classList.toggle("hidden", tab !== "cfg");
      $("panel-chat").classList.toggle("hidden", tab !== "chat");
    });
  });
}

async function main() {
  if (!code) {
    showErr("Código de lobby em falta no URL.");
    return;
  }
  fillMapSelect();
  bind();

  const meR = await api("/api/me");
  const meJ = await meR.json();
  if (!meJ.user) {
    $("lobby-gate")?.classList.remove("hidden");
    return;
  }
  me = meJ.user;
  $("lobby-root")?.classList.remove("hidden");
  const jr = await api("/api/lobbies/" + encodeURIComponent(code) + "/join", { method: "POST" });
  if (jr.status === 404) {
    showErr("Lobby não encontrada.");
    return;
  }
  if (!jr.ok) {
    showErr("Não foi possível entrar na lobby.");
    return;
  }
  formSynced = false;
  await loadLobby();
  pollT = setInterval(() => {
    void loadLobby();
  }, 2800);
}

main().catch((e) => {
  showErr(String(e));
});
