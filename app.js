(() => {
  const $ = (id) => document.getElementById(id);

  const el = {
    modPick: $("modPick"),
    modHint: $("modHint"),
    btnClear: $("btnClear"),
    btnClearCache: $("btnClearCache"),

    statusDot: $("statusDot"),
    statusTitle: $("statusTitle"),
    statusText: $("statusText"),

    // tabs
    tabCards: $("tabCards"),
    tabDuelists: $("tabDuelists"),
    panelCards: $("panelCards"),
    panelDuelists: $("panelDuelists"),

    // cards filters
    qName: $("qName"),
    qId: $("qId"),
    qType: $("qType"),
    qStar: $("qStar"),
    qAttr: $("qAttr"),
    qDuelist: $("qDuelist"),
    qDuelRank: $("qDuelRank"),

    // cards UI
    resultMeta: $("resultMeta"),
    list: $("list"),
    detailMeta: $("detailMeta"),
    details: $("details"),

    // duelists UI
    duelistPick: $("duelistPick"),
    duelistHideZero: $("duelistHideZero"),
    duelistThead: $("duelistThead"),
    duelistMeta: $("duelistMeta"),
    duelistMeta: $("duelistMeta"),
    duelistTbody: $("duelistTbody"),
  };

  let worker = null;
  let isReady = false;
  let selectedCardId = null;
  let datasetTotalCards = null;

  // Duelists table view (tabs)
  let duelTab = "all"; // all | deck | zpow | spow | stec
  let lastDuelistPayload = null;

  const ATTR_LABEL = {
    0: "Light",
    1: "Dark",
    2: "Earth",
    3: "Water",
    4: "Fire",
    5: "Wind",
    6: "Spell/Equip/Ritual",
    7: "Trap",
  };

  // --- UI helpers (chips) ---
  // Guardian Stars usam símbolos astronômicos Unicode: ☉ ☿ ♀ ☾ ♂ ♃ ♄ ♅ ♆ ♇
  // (Uranus: ♅)
  const GS_SYMBOL = {
    Sun: "☉",
    Mercury: "☿",
    Venus: "♀",
    Moon: "☾",
    Mars: "♂",
    Jupiter: "♃",
    Saturn: "♄",
    Uranus: "⛢",
    Neptune: "♆",
    Pluto: "♇",
  };

  function deckFlag(prob) {
    const n = Number(prob);
    return Number.isFinite(n) && n > 0 ? "Sim" : "";
  }

  function gsSymbol(name) {
    const key = String(name || "").trim();
    return GS_SYMBOL[key] || key || "•";
  }

  function attrName(attrCode) {
    const k = Number(attrCode);
    return (Number.isFinite(k) && ATTR_LABEL[k]) ? ATTR_LABEL[k] : null;
  }

  function slugAttr(name) {
    return String(name || "").trim().toLowerCase().replaceAll("/", "-").replaceAll(" ", "-");
  }

  function renderTypeChip(type) {
    return `<span class="chip type">${escapeHtml(String(type))}</span>`;
  }

  function renderGsChip(st1, st2) {
    const a = gsSymbol(st1);
    const b = gsSymbol(st2);
    //const title = `GS: ${String(st1 || "-")} / ${String(st2 || "-")}`;
    return `
      <span class="chip gs" title="${escapeHtml("1")}">
        <span class="gs-sym">${escapeHtml(a)}</span>
        <span class="gs-sep">/</span>
        <span class="gs-sym">${escapeHtml(b)}</span>
      </span>
    `;
  }

  function renderAttrChip(attrCode) {
    const name = attrName(attrCode) || String(attrCode ?? "");
    const cls = `attr-${slugAttr(name)}`;
    // Ícone + texto (bem clean). Ícones simples, só para leitura rápida.
    const icon = attrIconSvg(String(name || "").toLowerCase());
    return `
      <span class="chip attr ${cls}" title="Atributo: ${escapeHtml(String(name))}">
        <span class="attr-icon" aria-hidden="true">${icon}</span>
        <span class="attr-text">${escapeHtml(String(name))}</span>
      </span>
    `;
  }

  function attrIconSvg(nameLower) {
    // SVGs mínimos com fill="currentColor" para respeitar contraste do chip
    const wrap = (d) => `<svg viewBox="0 0 24 24" class="icon" focusable="false" aria-hidden="true">${d}</svg>`;
    switch (nameLower) {
      case "dark":
        return wrap('<path fill="currentColor" d="M21 14.5A8.5 8.5 0 0 1 9.5 3a7 7 0 1 0 11.5 11.5Z"/>');
      case "light":
        return wrap('<path fill="currentColor" d="M12 2.5a1 1 0 0 1 1 1V6a1 1 0 1 1-2 0V3.5a1 1 0 0 1 1-1Zm0 15a4.5 4.5 0 1 0 0-9 4.5 4.5 0 0 0 0 9Zm9.5-5.5a1 1 0 0 1-1 1H18a1 1 0 1 1 0-2h2.5a1 1 0 0 1 1 1ZM6 12a1 1 0 0 1-1 1H2.5a1 1 0 1 1 0-2H5a1 1 0 0 1 1 1Zm13.4 6.9a1 1 0 0 1 0 1.4l-1.8 1.8a1 1 0 0 1-1.4-1.4l1.8-1.8a1 1 0 0 1 1.4 0ZM7.8 8.3a1 1 0 0 1 0 1.4L6 11.5a1 1 0 1 1-1.4-1.4l1.8-1.8a1 1 0 0 1 1.4 0Zm-2 12.8a1 1 0 0 1-1.4 0l-1.8-1.8A1 1 0 1 1 4 17.9l1.8 1.8a1 1 0 0 1 0 1.4Zm16-12.8a1 1 0 0 1-1.4 0L18.6 6.5a1 1 0 1 1 1.4-1.4l1.8 1.8a1 1 0 0 1 0 1.4Z"/>');
      case "fire":
        return wrap('<path fill="currentColor" d="M13.5 2s.8 3.5-1.6 5.9C9.8 10.2 10 12 10 12s-2-1-2-4c-2.2 1.6-3.5 4-3.5 6.5A7.5 7.5 0 0 0 12 22a7.5 7.5 0 0 0 7.5-7.5c0-4-3-6.5-6-12.5Z"/>');
      case "water":
        return wrap('<path fill="currentColor" d="M12 2S6 9.2 6 13.5A6 6 0 0 0 12 19.5a6 6 0 0 0 6-6C18 9.2 12 2 12 2Z"/>');
      case "wind":
        return wrap('<path fill="currentColor" d="M4 10h11a3 3 0 1 0-2.8-4H10a5 5 0 1 1 5 6H4v-2Zm0 6h13a3 3 0 1 0-2.8-4H12a5 5 0 1 1 5 6H4v-2Z"/>');
      case "earth":
        return wrap('<path fill="currentColor" d="M3 19h18v2H3v-2Zm2-2 5.5-9 4 6 2-3 4.5 6H5Z"/>');
      case "divine":
        return wrap('<path fill="currentColor" d="M12 2l2.2 6.2L21 9l-5 3.7L17.5 20 12 16.6 6.5 20 8 12.7 3 9l6.8-.8L12 2Z"/>');
      default:
        return wrap('<circle cx="12" cy="12" r="8" fill="currentColor"/>');
    }
  }

  function renderLevelChip(level) {
    const maxStars = 12;
    const shown = Math.min(level, maxStars);
    const extra = level > maxStars ? `<span class="lv-more">+${level - maxStars}</span>` : "";
    const stars = Array.from({ length: shown }, () => `<img class="lv-star" src="./level-star.png" alt="" />`).join("");
    return `
      <span class="chip lv" title="Lv ${level}">
        <span class="lv-stars">${stars}</span>
        ${extra}
      </span>
    `;
  }

  function setStatus(kind, title, text) {
    el.statusDot.className = `dot ${kind === "ready" ? "ok" : kind === "error" ? "bad" : "warn"}`;
    el.statusTitle.textContent = title;
    el.statusText.textContent = text || "";
  }

  function setControlsEnabled(enabled) {
    el.modPick && (el.modPick.disabled = !enabled);
    el.btnClear.disabled = !enabled;
    el.qName.disabled = !enabled;
    el.qId.disabled = !enabled;
    el.qType.disabled = !enabled;
    el.qStar.disabled = !enabled;
    el.qAttr.disabled = !enabled;
    el.qDuelist.disabled = !enabled;
    el.qDuelRank.disabled = !enabled;

    el.tabCards.disabled = !enabled;
    el.tabDuelists.disabled = !enabled;

    el.duelistPick.disabled = !enabled;
    el.duelistHideZero.disabled = !enabled;
  }

  function fillSelect(select, items, toLabel = (it) => String(it ?? "")) {
    if (!select) return; // blindagem contra null
    const keep = select.value ?? "";
    select.innerHTML = `<option value="">Todos</option>`;

    for (const it of (items || [])) {
      const opt = document.createElement("option");
      opt.value = String(it?.id ?? it);
      opt.textContent = toLabel(it);
      select.appendChild(opt);
    }
    select.value = keep;
  }

  function setTab(which) {
    const cardsOn = which === "cards";
    el.tabCards.setAttribute("aria-selected", String(cardsOn));
    el.tabDuelists.setAttribute("aria-selected", String(!cardsOn));
    el.panelCards.hidden = !cardsOn;
    el.panelDuelists.hidden = cardsOn;
  }

  function pulseOnce(target) {
    if (!target) return;

    target.classList.add("pulse-target");

    // Reinicia a animação mesmo em cliques repetidos
    target.classList.remove("pulse-once");
    void target.offsetWidth; // força reflow
    target.classList.add("pulse-once");

    // Limpa depois (evita ficar “sujo” pra sempre)
    const cleanup = () => {
      target.classList.remove("pulse-once");
      target.removeEventListener("animationend", cleanup);
    };
    target.addEventListener("animationend", cleanup);
  }

  function gotoDuelist(duelistId) {
    const id = Number(duelistId);
    if (!Number.isFinite(id)) return;

    // 1) muda pra aba Duelistas
    setTab("duelists");

    // 2) seleciona o duelista no combo (se existir)
    el.duelistPick.value = String(id);

    // 3) carrega tabela do duelista
    requestDuelistCards();

    // 4) scroll suave pro painel (opcional)
    el.panelDuelists?.scrollIntoView?.({ behavior: "smooth", block: "start" });
    pulseOnce(el.panelDuelists);
    el.duelistPick?.focus?.();
  }

  function ensureWorker() {
    if (worker) return;

    worker = new Worker("./worker.js", { type: "classic" });

    worker.onmessage = (ev) => {
      const msg = ev.data;
      if (!msg || !msg.type) return;

      if (msg.type === "progress") {
        setStatus("warn", "Processando…", msg.text || "");
        return;
      }

      if (msg.type === "ready") {
        isReady = true;
        datasetTotalCards = Number.isFinite(msg.payload?.totalCards) ? msg.payload.totalCards : null;
        setStatus("ready", "Pronto", msg.text || "");
        setControlsEnabled(true);

        const payload = msg.payload || {};
        fillSelect(el.qType, payload.types);
        fillSelect(el.qStar, payload.stars);

        // Atributos fixos
        fillSelect(
          el.qAttr,
          Object.keys(ATTR_LABEL).map(k => ({ id: k, name: ATTR_LABEL[k] })),
          (it) => `${it.id} - ${it.name}`
        );

        // Duelistas (filtro e aba)
        fillSelect(el.qDuelist, payload.duelists, d => `${d.id} - ${d.name}`);
        fillSelect(el.duelistPick, payload.duelists, d => `${d.id} - ${d.name}`);

        // primeira lista
        runQuery();
        return;
      }

      if (msg.type === "results") {
        renderList(msg.items || [], msg.total ?? 0, msg.shown ?? 0);
        return;
      }

      if (msg.type === "details") {
        renderDetails(msg.item, msg.fusionGeneratedBy, msg.fusionGenerates);
        return;
      }

      if (msg.type === "duelist_cards") {
        renderDuelistTable(msg.payload);
        return;
      }

      if (msg.type === "error") {
        setStatus("error", "Erro", msg.text || "Falha no worker.");
        console.error(msg.error);
      }
    };

    worker.onerror = (e) => {
      setStatus("error", "Erro", "Falha no worker.");
      console.error(e);
    };
  }

  // ---- Mods ----
  let modsManifest = [];
  let currentMod = null;

  const LS_LAST_MOD = "cardsdb:lastModId"; // guarda o último mod

  function setModHint(mod) {
    if (!el.modHint) return;
    if (!mod) { el.modHint.textContent = ""; return; }
    const v = mod.version ? `v${mod.version}` : "";
    el.modHint.textContent = `${mod.name || ""}`.trim();
  }

  function resolveModUrl(mod) {
    // cache-busting controlado por version (basta atualizar version no mods.json)
    return mod.version ? `${mod.path}?v=${encodeURIComponent(mod.version)}` : mod.path;
  }

  async function fetchModArrayBuffer(mod) {
    const res = await fetch(resolveModUrl(mod));
    if (!res.ok) throw new Error(`Falha ao baixar ${mod.path} (HTTP ${res.status})`);
    return await res.arrayBuffer(); // :contentReference[oaicite:9]{index=9}
  }

  async function loadModsManifest() {
    const res = await fetch("./mods.json");
    if (!res.ok) throw new Error(`Falha ao ler mods.json (HTTP ${res.status})`);

    const data = await res.json();
    if (!data || !Array.isArray(data.mods) || !data.mods.length) {
      throw new Error("mods.json inválido (esperado: { mods: [...] })");
    }

    modsManifest = data.mods;

    el.modPick.innerHTML = modsManifest
      .map(m => `<option value="${escapeHtml(m.id)}">${escapeHtml(m.name)}${m.version ? ` (v${escapeHtml(m.version)})` : ""}</option>`)
      .join("");

    // inicial: último usado ou default:true ou primeiro
    const last = localStorage.getItem(LS_LAST_MOD); // :contentReference[oaicite:10]{index=10}
    const def = modsManifest.find(m => m.default) || modsManifest[0];
    const chosen = modsManifest.find(m => m.id === last) || def;

    el.modPick.disabled = false;
    el.modPick.value = chosen.id;

    return chosen;
  }

  async function loadMod(modId) {
    const mod = modsManifest.find(m => m.id === modId);
    if (!mod) return;

    currentMod = mod;
    localStorage.setItem(LS_LAST_MOD, mod.id); // :contentReference[oaicite:11]{index=11}
    setModHint(mod);

    setControlsEnabled(false);
    el.modPick.disabled = true;
    setStatus("warn", "Carregando mod…", `${mod.name}`);

    // 1) tenta cache primeiro
    const restored = await restoreCachedModIfAny(mod.id);
    if (restored) return;

    // 2) senão, baixa e salva no cache
    const buf = await fetchModArrayBuffer(mod);
    await saveCachedMod(mod, buf);

    ensureWorker();
    worker.postMessage({ cmd: "load", buffer: buf }, [buf]); // transferable :contentReference[oaicite:12]{index=12}
  }


  /*function readJsonFile(file) {
    ensureWorker();
    setControlsEnabled(false);
    isReady = false;

    setStatus("warn", "Lendo arquivo…", file?.name || "");
    file.arrayBuffer().then((buf) => {
      worker.postMessage({ cmd: "load", buffer: buf }, [buf]);
    }).catch((err) => {
      setStatus("error", "Erro", "Não consegui ler o arquivo.");
      console.error(err);
      setControlsEnabled(true);
    });
  }*/

  function getFilters() {
    const idRaw = Number(el.qId.value);
    const id = Number.isFinite(idRaw) && el.qId.value !== "" ? idRaw : null;

    const attrRaw = Number(el.qAttr.value);
    const attr = Number.isFinite(attrRaw) && el.qAttr.value !== "" ? attrRaw : null;

    const duelIdRaw = Number(el.qDuelist.value);
    const duelId = Number.isFinite(duelIdRaw) && el.qDuelist.value !== "" ? duelIdRaw : null;

    const duelRankRaw = Number(el.qDuelRank.value);
    const duelRank = Number.isFinite(duelRankRaw) && el.qDuelRank.value !== "" ? duelRankRaw : null;

    return {
      name: el.qName.value || "",
      id,
      type: el.qType.value || "",
      star: el.qStar.value || "",
      attr,
      duelId,
      duelRank,
    };
  }

  function runQuery() {
    if (!worker || !isReady) return;
    const filters = getFilters();
    worker.postMessage({ cmd: "query", filters });
  }

  function requestDetails(cardId) {
    if (!worker || !isReady) return;
    selectedCardId = cardId;
    el.detailMeta.textContent = `Carregando detalhes da carta ${cardId}…`;
    el.details.innerHTML = "";
    worker.postMessage({ cmd: "details", id: cardId });
  }

  function requestDuelistCards() {
    if (!worker || !isReady) return;
    const duelId = Number(el.duelistPick.value);
    if (!Number.isFinite(duelId) || !el.duelistPick.value) {
      el.duelistMeta.textContent = "Selecione um duelista.";
      el.duelistTbody.innerHTML = "";
      return;
    }
    el.duelistMeta.textContent = "Carregando…";
    worker.postMessage({ cmd: "duelist_cards", duelId });
  }

  function renderList(items, total, shown) {
    const base = `Resultados: ${total}`;
    const extra = (Number.isFinite(datasetTotalCards) ? ` / Total: ${datasetTotalCards}` : "");
    el.resultMeta.textContent = `${base}${extra} (mostrando ${shown})`;
    el.list.innerHTML = "";

    for (const it of items) {
      const row = document.createElement("div");
      row.className = "item";
      row.innerHTML = `
        <div class="id"><a href="#${it.id}" data-card="${it.id}">${it.id}</a></div>
        <div class="nm">
          <div><a href="#${it.id}" data-card="${it.id}">${escapeHtml(it.name)}</a></div>
          <div class="meta">${escapeHtml(it.type)} • ${escapeHtml(gsSymbol(it.st1))} ${escapeHtml(gsSymbol(it.st2))} • ${escapeHtml(attrName(it.attr) || "-")}</div>
        </div>
      `;
      row.querySelectorAll("a[data-card]").forEach(a => {
        a.addEventListener("click", (ev) => {
          ev.preventDefault();
          requestDetails(Number(a.dataset.card));
        });
      });
      el.list.appendChild(row);
    }

    // se nada selecionado ainda, tenta puxar primeiro item
    if (items.length && !selectedCardId) {
      requestDetails(items[0].id);
    }
  }

  function renderDetails(item, fusionGeneratedBy, fusionGenerates) {
    if (!item) {
      el.detailMeta.innerHTML = "";
      el.details.innerHTML = `<div style="padding:20px; color:var(--muted)">Selecione uma carta para ver os detalhes.</div>`;
      return;
    }

    // Limpa o meta antigo, pois agora o cabeçalho faz parte do card completo
    el.detailMeta.innerHTML = "";

    const c = item.card || {};
    const atk = item.atk ?? 0;
    const def = item.def ?? 0;
    const level = Number(c.Nivel);

    el.details.innerHTML = `
      <div class="fm-card-box">
        <!-- Header: Nome e Atributo -->
        <div class="fm-header">
          <div class="fm-title">${escapeHtml(c.Nombre)}</div>
          <div class="fm-attr">${c.Atributo != null ? renderAttrChip(c.Atributo) : ""}</div>
        </div>

        <!-- Body: Imagem e Status -->
        <div class="fm-body">
          <div class="fm-img-placeholder">
            <span>${c.Numero}</span>
          </div>
          <div class="fm-stats">
            <div class="fm-stat-row">
              <span class="fm-label">ATK</span> <span class="fm-val">${atk}</span>
            </div>
            <div class="fm-stat-row">
              <span class="fm-label">DEF</span> <span class="fm-val">${def}</span>
            </div>
            <div class="fm-stat-row">
              <span class="fm-label">Type</span> <span>${c.Tipo ? renderTypeChip(c.Tipo) : "-"}</span>
            </div>
            <div class="fm-stat-row">
              <span class="fm-label">Stars</span> 
              <span>${(c.St1 || c.St2) ? renderGsChip(c.St1, c.St2) : "-"}</span>
            </div>
            <div class="fm-level" style="margin-top:4px">
              ${(Number.isFinite(level) && level > 0) ? renderLevelChip(level) : ""}
            </div>
          </div>
        </div>

        <!-- Descrição e Meta -->
        <div class="fm-desc">
          ${escapeHtml(c.Comentario || "Sem descrição.")}
          <div class="fm-meta-row">
            <span>Password: ${escapeHtml(c.Password || "-")}</span>
            <span>Preço: ${escapeHtml(c.Precio || "-")}</span>
          </div>
        </div>
      </div>

      <!-- Tabelas de dados -->
      ${renderDrop(item.drop)}
      ${renderFusionGeneratedBy(fusionGeneratedBy)}
      ${renderFusionGenerates(fusionGenerates)}
      ${renderEquipos(item.equipos)}
      ${renderRitual(item.ritual)}
      ${renderIni(item.ini)}
    `;

    // links autoreferenciáveis nos ids de cartas dentro dos detalhes
    el.details.querySelectorAll("a[data-card]").forEach(a => {
      a.addEventListener("click", (ev) => {
        ev.preventDefault();
        requestDetails(Number(a.dataset.card));
      });
    });

    // links para duelistas dentro dos Drops (id/nome)
    el.details.querySelectorAll("a[data-duelist]").forEach(a => {
      a.addEventListener("click", (ev) => {
        ev.preventDefault();
        gotoDuelist(a.dataset.duelist);
      });
    });
  }

  function dropRankLabel(rank) {
    const r = Number(rank);
    if (r === 0) return "Deck";
    if (r === 1) return "Z POW";
    if (r === 2) return "S POW";
    if (r === 3) return "S TEC";
    return String(rank ?? "");
  }

  function renderDrop(dropArr) {
    if (!Array.isArray(dropArr) || !dropArr.length) return "";
    const rows = dropArr
      .filter(d => d && d.id != null && Number(d.rank) !== 0)
      .map(d => {
        const rankText = dropRankLabel(d.rank);
        const prob = String(d.prob ?? "");
        const did = String(d.id);
        const dname = String(d.nombre ?? "");

        return `<tr>
  <td class="num">
    <a href="#duelist-${escapeHtml(did)}" data-duelist="${escapeHtml(did)}">${escapeHtml(did)}</a>
  </td>
  <td>
    <a href="#duelist-${escapeHtml(did)}" data-duelist="${escapeHtml(did)}">${escapeHtml(dname)}</a>
  </td>
  <td class="num">${escapeHtml(rankText)}</td>
  <td class="num">${escapeHtml(prob)}</td>
</tr>`;

      }).join("");

    if (!rows) return "";

    return `
      <div class="sectionTitle">Drops</div>
      <table class="table">
        <thead><tr><th>ID</th><th>Duelista</th><th>Rank</th><th>Prob</th></tr></thead>
        <tbody>${rows}</tbody>
      </table>
    `;
  }

  function renderFusionGeneratedBy(arr) {
    if (!Array.isArray(arr) || !arr.length) return "";

    const rows = arr.map(x => {
      const a = x?.aId ?? "";
      const b = x?.bId ?? "";
      return `<tr>
        <td class="num"><a href="#${a}" data-card="${a}">${escapeHtml(String(a))}</a></td>
        <td>${escapeHtml(String(x?.aName ?? ""))}</td>
        <td class="num"><a href="#${b}" data-card="${b}">${escapeHtml(String(b))}</a></td>
        <td>${escapeHtml(String(x?.bName ?? ""))}</td>
      </tr>`;
    }).join("");

    return `
      <div class="sectionTitle">Fusões que geram esta carta <span class="muted">(${arr.length})</span></div>
      <table class="table">
        <thead>
          <tr><th>ID</th><th>Material 1</th><th>ID</th><th>Material 2</th></tr>
        </thead>
        <tbody>${rows}</tbody>
      </table>
    `;
  }

  function renderFusionGenerates(arr) {
    if (!Array.isArray(arr) || !arr.length) return "";

    const rows = arr.map(x => {
      const w = x?.withId ?? "";
      const r = x?.resultId ?? "";
      return `<tr>
        <td class="num"><a href="#${w}" data-card="${w}">${escapeHtml(String(w))}</a></td>
        <td>${escapeHtml(String(x?.withName ?? ""))}</td>
        <td class="num"><a href="#${r}" data-card="${r}">${escapeHtml(String(r))}</a></td>
        <td>${escapeHtml(String(x?.resultName ?? ""))}</td>
      </tr>`;
    }).join("");

    return `
      <div class="sectionTitle">Fusões que esta carta gera <span class="muted">(${arr.length})</span></div>
      <table class="table">
        <thead>
          <tr><th>ID</th><th>Com</th><th>ID</th><th>Resultado</th></tr>
        </thead>
        <tbody>${rows}</tbody>
      </table>
    `;
  }

  // (Legacy) lista completa de fusões. Mantida para referência.
  function renderFusions(fusionArr) {
    if (!Array.isArray(fusionArr) || !fusionArr.length) return "";
    const rows = fusionArr.map(fx => {
      const a = fx?.c1?.Numero ?? "";
      const b = fx?.c2?.Numero ?? "";
      const r = fx?.f?.Numero ?? "";
      return `<tr>
        <td class="num"><a href="#${a}" data-card="${a}">${escapeHtml(String(a))}</a></td>
        <td>${escapeHtml(String(fx?.c1?.Nombre ?? ""))}</td>
        <td class="num"><a href="#${b}" data-card="${b}">${escapeHtml(String(b))}</a></td>
        <td>${escapeHtml(String(fx?.c2?.Nombre ?? ""))}</td>
        <td class="num"><a href="#${r}" data-card="${r}">${escapeHtml(String(r))}</a></td>
        <td>${escapeHtml(String(fx?.f?.Nombre ?? ""))}</td>
      </tr>`;
    }).join("");

    return `
      <div class="sectionTitle">Fusões</div>
      <table class="table">
        <thead>
          <tr><th>ID</th><th>C1</th><th>ID</th><th>C2</th><th>ID</th><th>Resultado</th></tr>
        </thead>
        <tbody>${rows}</tbody>
      </table>
    `;
  }

  function renderEquipos(arr) {
    if (!Array.isArray(arr) || !arr.length) return "";
    const chips = arr.map(e => {
      const id = e?.id ?? "";
      const name = e?.nombre ?? "";
      return `<span class="chip"><a href="#${id}" data-card="${id}">${escapeHtml(String(id))}</a> ${escapeHtml(String(name))}</span>`;
    }).join("");
    return `<div class="sectionTitle">Equipamentos relacionados</div><div class="chips">${chips}</div>`;
  }

  function renderRitual(arr) {
    if (!Array.isArray(arr) || !arr.length) return "";
    const rows = arr.map(r => {
      const ri = r?.Ri?.id ?? "";
      const rf = r?.Rf?.id ?? "";
      const c1 = r?.c1?.id ?? "";
      const c2 = r?.c2?.id ?? "";
      const c3 = r?.c3?.id ?? "";
      return `<tr>
        <td class="num"><a href="#${ri}" data-card="${ri}">${escapeHtml(String(ri))}</a></td>
        <td>${escapeHtml(String(r?.Ri?.nombre ?? ""))}</td>
        <td class="num"><a href="#${c1}" data-card="${c1}">${escapeHtml(String(c1))}</a></td>
        <td class="num"><a href="#${c2}" data-card="${c2}">${escapeHtml(String(c2))}</a></td>
        <td class="num"><a href="#${c3}" data-card="${c3}">${escapeHtml(String(c3))}</a></td>
        <td class="num"><a href="#${rf}" data-card="${rf}">${escapeHtml(String(rf))}</a></td>
        <td>${escapeHtml(String(r?.Rf?.nombre ?? ""))}</td>
      </tr>`;
    }).join("");

    return `
      <div class="sectionTitle">Rituais</div>
      <table class="table">
        <thead><tr><th>Ritual</th><th>Nome</th><th>C1</th><th>C2</th><th>C3</th><th>Resultado</th><th>Nome</th></tr></thead>
        <tbody>${rows}</tbody>
      </table>
    `;
  }

  function renderIni(arr) {
    if (!Array.isArray(arr) || !arr.length) return "";
    const rows = arr.map(x => `
      <tr>
        <td class="num">${escapeHtml(String(x?.Set ?? ""))}</td>
        <td class="num">${escapeHtml(String(x?.Carta ?? ""))}</td>
        <td class="num">${escapeHtml(String(x?.Prob ?? ""))}</td>
      </tr>
    `).join("");

    return `
      <div class="sectionTitle">Deck inicial (ini)</div>
      <table class="table">
        <thead><tr><th>Set</th><th>Carta</th><th>Prob</th></tr></thead>
        <tbody>${rows}</tbody>
      </table>
    `;
  }
  function probValue(x) {
    // no dataset: treat empty/0 as inactive
    if (x == null) return 0;
    const s = String(x).trim();
    if (!s) return 0;
    const n = Number(s);
    return Number.isFinite(n) ? n : 0;
  }

  function isActiveProb(x) {
    return probValue(x) > 0;
  }

  function setDuelistTab(next) {
    duelTab = next || "all";

    // Update buttons (visual + ARIA)
    document.querySelectorAll("button[data-duel-tab]").forEach(btn => {
      const active = btn.dataset.duelTab === duelTab;
      btn.classList.toggle("active", active);
      btn.setAttribute("aria-selected", active ? "true" : "false");
      btn.setAttribute("tabindex", active ? "0" : "-1");
    });

    // Re-render without needing new worker request
    if (lastDuelistPayload) renderDuelistTable(lastDuelistPayload);
  }

  function ensureTabBadge(btn) {
    // Cria spans internos se o HTML estiver sem estrutura (retrocompatível)
    let label = btn.querySelector(".label");
    let badge = btn.querySelector(".badge");
    if (!label) {
      const txt = btn.textContent.trim();
      btn.textContent = "";
      label = document.createElement("span");
      label.className = "label";
      label.textContent = txt;
      btn.appendChild(label);
    }
    if (!badge) {
      badge = document.createElement("span");
      badge.className = "badge";
      badge.setAttribute("aria-hidden", "true");
      badge.textContent = "0";
      btn.appendChild(badge);
    }
    return { label, badge };
  }

  function updateDuelTabBadges(totals) {
    const t = totals || { totalAll: 0, totalDeck: 0, totalZ: 0, totalSP: 0, totalST: 0 };
    const map = {
      all: t.totalAll,
      deck: t.totalDeck,
      zpow: t.totalZ,
      spow: t.totalSP,
      stec: t.totalST,
    };

    document.querySelectorAll("button[data-duel-tab]").forEach(btn => {
      const key = btn.dataset.duelTab || "all";
      const { badge } = ensureTabBadge(btn);
      const v = map[key];
      badge.textContent = (v == null) ? "0" : String(v);
    });
  }

  function setDuelistHeader(tabKey) {
    if (!el.duelistThead) return;

    if (tabKey === "all") {
      el.duelistThead.innerHTML = `
        <tr>
          <th style="width:90px">ID</th>
          <th>Carta</th>
          <th style="width:120px">Deck</th>
          <th style="width:110px">Z POW</th>
          <th style="width:110px">S POW</th>
          <th style="width:110px">S TEC</th>
        </tr>
      `;
      return;
    }

    const label = ({
      deck: "Deck",
      zpow: "Z POW",
      spow: "S POW",
      stec: "S TEC",
    })[tabKey] || "Prob";

    el.duelistThead.innerHTML = `
      <tr>
        <th style="width:90px">ID</th>
        <th>Carta</th>
        <th style="width:140px">${escapeHtml(label)}</th>
      </tr>
    `;
  }

  function renderDuelistTable(payload) {
    if (!payload) {
      el.duelistMeta.textContent = "Duelista não encontrado.";
      el.duelistTbody.innerHTML = "";
      updateDuelTabBadges(null);
      return;
    }

    lastDuelistPayload = payload;

    const hideZero = !!el.duelistHideZero.checked;
    const rows = payload.rows || [];

    const filtered = hideZero
      ? rows.filter(r => String(r.r0 || r.r1 || r.r2 || r.r3).trim() !== "")
        .filter(r => !(r.r0 === "0" && r.r1 === "0" && r.r2 === "0" && r.r3 === "0"))
      : rows;

    el.duelistMeta.textContent = `${payload.id} - ${payload.name} • cartas: ${filtered.length}`;

    // Totais por rank (sempre calculados a partir do dataset completo do duelista)
    const totalAll = rows.length;
    const totalDeck = rows.filter(r => isActiveProb(r.r0)).length;
    const totalZ = rows.filter(r => isActiveProb(r.r1)).length;
    const totalSP = rows.filter(r => isActiveProb(r.r2)).length;
    const totalST = rows.filter(r => isActiveProb(r.r3)).length;

    // Define o "campo" ativo pela tab
    const tabField = ({
      deck: "r0",
      zpow: "r1",
      spow: "r2",
      stec: "r3",
    })[duelTab] || null;

    // A tab funciona como filtro: ela mostra apenas o que é relevante para aquela visão.
    let viewRows = rows;
    if (duelTab === "all") {
      viewRows = hideZero
        ? rows.filter(r => isActiveProb(r.r0) || isActiveProb(r.r1) || isActiveProb(r.r2) || isActiveProb(r.r3))
        : rows;
    } else if (tabField) {
      viewRows = rows.filter(r => isActiveProb(r[tabField]));
      // hideZero aqui é redundante, mas mantemos o comportamento sem surpresas
      if (hideZero) viewRows = viewRows.filter(r => isActiveProb(r[tabField]));
    }

    // Cabeçalho da tabela depende da tab
    setDuelistHeader(duelTab);

    // Meta (mini totalizador)
    const viewLabel = ({
      all: "Tudo",
      deck: "Deck",
      zpow: "Z POW",
      spow: "S POW",
      stec: "S TEC",
    })[duelTab] || "Tudo";

    el.duelistMeta.textContent =
      `${payload.id} - ${payload.name} • Total: ${totalAll} • Deck: ${totalDeck} • Z: ${totalZ} • S POW: ${totalSP} • S TEC: ${totalST}`;

    // Badges nas subtabs (sempre refletem o total do duelista, não o filtro atual)
    updateDuelTabBadges({ totalAll, totalDeck, totalZ, totalSP, totalST });

    // Render
    if (duelTab === "all") {
      el.duelistTbody.innerHTML = viewRows.map(r => `
        <tr>
          <td class="num"><a href="#${r.id}" data-card="${r.id}">${r.id}</a></td>
          <td>${escapeHtml(r.name || "")}</td>
          <td>${escapeHtml(deckFlag(r.r0))}</td>
          <td class="num">${escapeHtml(String(r.r1 || ""))}</td>
          <td class="num">${escapeHtml(String(r.r2 || ""))}</td>
          <td class="num">${escapeHtml(String(r.r3 || ""))}</td>
        </tr>
      `).join("");
    } else {
      const labelField = tabField || "r0";
      el.duelistTbody.innerHTML = viewRows.map(r => {
        const value =
          (duelTab === "deck")
            ? deckFlag(r.r0)                 // aqui vira "Sim"/"Não"
            : String(r[labelField] || "");

        // deck não precisa ser numérico, então removi class="num" nesse caso
        const tdClass = (duelTab === "deck") ? "" : ' class="num"';

        return `
      <tr>
        <td class="num"><a href="#${r.id}" data-card="${r.id}">${r.id}</a></td>
        <td>${escapeHtml(r.name || "")}</td>
        <td${tdClass}>${escapeHtml(value)}</td>
      </tr>
    `;
      }).join("");
    }


    el.duelistTbody.querySelectorAll("a[data-card]").forEach(a => {
      a.addEventListener("click", (ev) => {
        ev.preventDefault();
        setTab("cards");
        requestDetails(Number(a.dataset.card));
      });
    });
  }

  function escapeHtml(s) {
    return String(s ?? "")
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#039;");
  }

  function debounce(fn, waitMs = 160) {
    let t = null;
    return (...args) => {
      if (t) clearTimeout(t);
      t = setTimeout(() => fn(...args), waitMs);
    };
  }

  // ---- Cache (IndexedDB) ----
  const DB_NAME = "fm_remaster_cardsdb";
  const DB_VER = 1;
  const STORE = "datasets";
  const KEY_LAST = "last";

  function openDb() {
    return new Promise((resolve, reject) => {
      const req = indexedDB.open(DB_NAME, DB_VER);
      req.onupgradeneeded = () => {
        const db = req.result;
        if (!db.objectStoreNames.contains(STORE)) {
          db.createObjectStore(STORE);
        }
      };
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
  }

  async function idbPut(key, value) {
    const db = await openDb();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE, "readwrite");
      tx.objectStore(STORE).put(value, key);
      tx.oncomplete = () => { db.close(); resolve(true); };
      tx.onerror = () => { db.close(); reject(tx.error); };
    });
  }

  async function idbGet(key) {
    const db = await openDb();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE, "readonly");
      const req = tx.objectStore(STORE).get(key);
      req.onsuccess = () => { db.close(); resolve(req.result ?? null); };
      req.onerror = () => { db.close(); reject(req.error); };
    });
  }

  el.btnClearCache?.addEventListener("click", async () => {
    try {
      const db = await openDb();
      await new Promise((resolve, reject) => {
        const tx = db.transaction(STORE, "readwrite");
        tx.objectStore(STORE).clear();
        tx.oncomplete = () => { db.close(); resolve(true); };
        tx.onerror = () => { db.close(); reject(tx.error); };
      });

      localStorage.removeItem(LS_LAST_MOD);
      setStatus("warn", "Cache limpo", "O cache dos mods foi removido.");
    } catch (e) {
      setStatus("bad", "Falha ao limpar cache", String(e?.message || e));
    }
  });


  function modKey(modId) {
    return `mod:${modId}`;
  }

  async function saveCachedMod(mod, arrayBuffer) {
    try {
      const blob = new Blob([arrayBuffer], { type: "application/json" });
      const meta = { id: mod.id, name: mod.name, version: mod.version || "", path: mod.path, savedAt: Date.now() };
      await idbPut(modKey(mod.id), { blob, meta });
    } catch (e) {
      console.warn("Falha ao salvar cache do mod:", e);
    }
  }

  async function restoreCachedModIfAny(modId) {
    try {
      const cached = await idbGet(modKey(modId));
      if (!cached?.blob) return false;

      setStatus("warn", "Restaurando cache…", `Carregando mod ${modId} salvo no navegador.`);
      const buf = await cached.blob.arrayBuffer();
      ensureWorker();
      worker.postMessage({ cmd: "load", buffer: buf }, [buf]);
      return true;
    } catch (e) {
      console.warn("Falha ao restaurar cache do mod:", e);
      return false;
    }
  }


  // ---- Events ----
  el.tabCards.addEventListener("click", () => setTab("cards"));
  el.tabDuelists.addEventListener("click", () => setTab("duelists"));

  el.modPick.addEventListener("change", () => {
    const id = el.modPick.value;
    if (!id) return;
    loadMod(id).catch(err => {
      console.error(err);
      setStatus("error", "Erro", "Não consegui carregar o mod selecionado.");
      setControlsEnabled(true);
    });
  });

  el.modPick.addEventListener("change", () => {
    const id = el.modPick.value;
    if (!id) return;
    loadMod(id).catch(err => {
      console.error(err);
      setStatus("error", "Erro", "Não consegui carregar o mod selecionado.");
      setControlsEnabled(true);
      el.modPick.disabled = false;
    });
  });


  el.btnClear.addEventListener("click", () => {
    el.qName.value = "";
    el.qId.value = "";
    el.qType.value = "";
    el.qStar.value = "";
    el.qAttr.value = "";
    el.qDuelist.value = "";
    el.qDuelRank.value = "";
    selectedCardId = null;
    runQuery();
  });

  el.btnClearCache?.addEventListener("click", async () => {
    try {
      await idbDel(KEY_LAST);
      setStatus("warn", "Cache limpo", "O cache foi removido. Selecione um JSON para recarregar.");
    } catch (e) {
      setStatus("bad", "Falha ao limpar cache", String(e?.message || e));
    }
  });


  const runQueryNameDebounced = debounce(runQuery, 160);
  el.qName.addEventListener("input", runQueryNameDebounced);
  [el.qId, el.qType, el.qStar, el.qAttr, el.qDuelist, el.qDuelRank]
    .forEach(ctrl => ctrl.addEventListener("input", runQuery));

  el.qType.addEventListener("change", runQuery);
  el.qStar.addEventListener("change", runQuery);
  el.qAttr.addEventListener("change", runQuery);
  el.qDuelist.addEventListener("change", runQuery);
  el.qDuelRank.addEventListener("change", runQuery);

  el.duelistPick.addEventListener("change", requestDuelistCards);
  el.duelistHideZero.addEventListener("change", requestDuelistCards);


  // Ocultar 0 só re-renderiza, não precisa pedir de novo ao worker
  el.duelistHideZero.addEventListener("change", () => {
    if (lastDuelistPayload) renderDuelistTable(lastDuelistPayload);
  });

  // Tabs do painel de duelistas (Deck / Z / S POW / S TEC)
  document.querySelectorAll("button[data-duel-tab]").forEach(btn => {
    btn.addEventListener("click", () => setDuelistTab(btn.dataset.duelTab));
  });

  // Navegação por teclado nas tabs (setas esquerda/direita), seguindo o padrão ARIA
  const tabButtons = Array.from(document.querySelectorAll("button[data-duel-tab]"));
  const tablist = tabButtons[0]?.parentElement;
  if (tablist) {
    tablist.addEventListener("keydown", (ev) => {
      const keys = ["ArrowLeft", "ArrowRight", "Home", "End"];
      if (!keys.includes(ev.key)) return;

      const current = tabButtons.findIndex(b => b.dataset.duelTab === duelTab);
      if (current === -1) return;

      ev.preventDefault();
      let next = current;

      if (ev.key === "ArrowLeft") next = (current - 1 + tabButtons.length) % tabButtons.length;
      if (ev.key === "ArrowRight") next = (current + 1) % tabButtons.length;
      if (ev.key === "Home") next = 0;
      if (ev.key === "End") next = tabButtons.length - 1;

      tabButtons[next].focus();
      setDuelistTab(tabButtons[next].dataset.duelTab);
    });
  }

  async function loadModsManifest() {
    // 1) busca o manifest (mesma origem do site)
    const res = await fetch("./mods.json", { cache: "no-store" });
    if (!res.ok) throw new Error(`mods.json HTTP ${res.status}`);

    const data = await res.json();
    if (!data || !Array.isArray(data.mods)) throw new Error("mods.json inválido: faltou 'mods' array");
    modsManifest = data.mods;

    // 2) preenche o select
    el.modPick.innerHTML = modsManifest
      .map(m => `<option value="${escapeHtml(m.id)}">${escapeHtml(m.name)}</option>`)
      .join("");

    // 3) escolhe mod inicial:
    //    - último escolhido pelo usuário (localStorage)
    //    - senão, o default
    //    - senão, o primeiro da lista
    const last = localStorage.getItem("cardsdb:lastModId");
    const def = modsManifest.find(m => m.default) || modsManifest[0];
    const chosen = modsManifest.find(m => m.id === last) || def;

    el.modPick.value = chosen?.id || "";
    updateModHint(chosen);
    if (chosen) await loadMod(chosen.id);
  }

  function updateModHint(mod) {
    if (!el.modHint) return;
    if (!mod) { el.modHint.textContent = ""; return; }
    el.modHint.textContent = `${mod.version ? `v${mod.version}` : ""} ${mod.path ? `• ${mod.path}` : ""}`.trim();
  }

  async function loadMod(modId) {
    const mod = (modsManifest || []).find(m => m.id === modId);
    if (!mod) return;

    localStorage.setItem("cardsdb:lastModId", mod.id); // lembra escolha :contentReference[oaicite:3]{index=3}
    updateModHint(mod);

    await loadJsonFromUrl(mod.path, `${mod.name}${mod.version ? ` (v${mod.version})` : ""}`);
  }

  async function loadJsonFromUrl(url, label) {
    ensureWorker();
    setControlsEnabled(false);
    isReady = false;

    setStatus("warn", "Carregando mod…", label || url);

    // fetch + arrayBuffer é o espelho do seu file.arrayBuffer() :contentReference[oaicite:4]{index=4}
    const res = await fetch(url, { cache: "no-store" });
    if (!res.ok) throw new Error(`Falha ao baixar JSON: HTTP ${res.status}`);

    const buf = await res.arrayBuffer();
    worker.postMessage({ cmd: "load", buffer: buf }, [buf]); // transfere o buffer pro Worker
  }
  
  // init
  setControlsEnabled(false);
  setTab("cards");
  setStatus("warn", "Inicializando…", "Carregando lista de mods…");

  loadModsManifest()
    .then((chosen) => loadMod(chosen.id))
    .catch((err) => {
      console.error(err);
      setStatus("error", "Erro", "Não consegui carregar o mods.json.");
      // deixa a UI travada porque não há fonte de dados
    });
})();
