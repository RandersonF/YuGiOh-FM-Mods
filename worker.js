/* eslint-disable no-restricted-globals */
let records = [];     // lista leve para filtro/lista
let byId = new Map(); // id -> item completo (data + card)
let types = new Set();
let stars = new Set();

// Índices globais de fusão (para separar 'gera' vs 'é gerada por')
let FUSION_BY_RESULT = new Map();   // resultId -> [{a,b}]
let FUSION_BY_MATERIAL = new Map(); // materialId -> [{withId,resultId}]

let DUELISTS = new Map(); // id(str) -> { id:number, name:string, cards: Map(cardId -> {r0,r1,r2,r3}) }
let DUELIST_LIST = [];    // [{id,name}]

function post(type, payload) {
  self.postMessage({ type, ...payload });
}

function safeNum(x) {
  const s = String(x ?? "").trim();
  if (!s || s === "-" || s.toLowerCase() === "null") return 0;
  const n = Number(s);
  return Number.isFinite(n) ? n : 0;
}

function safeIntOrNull(x) {
  const s = String(x ?? "").trim();
  if (!s || s === "-" || s.toLowerCase() === "null") return null;
  const n = Number(s);
  return Number.isFinite(n) ? n : null;
}


function safeCardNo(x) {
  const n = Number(String(x ?? "").trim());
  return Number.isFinite(n) ? n : null;
}

function normalizeAtkDef(card) {
  // "-" => 0 (stats runtime)
  return { atk: safeNum(card.Atk), def: safeNum(card.Def) };
}

function normalizeName(s) {
  return String(s ?? "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
}

function dedupeFusions(fusionArr) {
  if (!Array.isArray(fusionArr) || !fusionArr.length) return [];
  const seen = new Set();
  const out = [];

  for (const fx of fusionArr) {
    const a = safeCardNo(fx?.c1?.Numero);
    const b = safeCardNo(fx?.c2?.Numero);
    const r = safeCardNo(fx?.f?.Numero);

    if (a == null || b == null || r == null) {
      out.push(fx);
      continue;
    }

    const min = Math.min(a, b);
    const max = Math.max(a, b);
    const key = `${min}|${max}|${r}`;

    if (seen.has(key)) continue;
    seen.add(key);
    out.push(fx);
  }
  return out;
}

function upsertDuelDrop(duelId, duelName, cardId, rank, prob) {
  const key = String(duelId);
  if (!DUELISTS.has(key)) {
    DUELISTS.set(key, { id: Number(duelId), name: String(duelName || ""), cards: new Map() });
  }
  const d = DUELISTS.get(key);
  if (!d.name && duelName) d.name = String(duelName);

  if (!d.cards.has(cardId)) {
    d.cards.set(cardId, { r0: null, r1: null, r2: null, r3: null });
  }
  const rec = d.cards.get(cardId);
  const p = prob == null ? null : String(prob);

  if (rank === 0) rec.r0 = p;
  else if (rank === 1) rec.r1 = p;
  else if (rank === 2) rec.r2 = p;
  else if (rank === 3) rec.r3 = p;
}

function buildCaches(items) {
  records = [];
  byId = new Map();
  types = new Set();
  stars = new Set();
  DUELISTS = new Map();
  DUELIST_LIST = [];

  FUSION_BY_RESULT = new Map();
  FUSION_BY_MATERIAL = new Map();
  const seenFusionGlobal = new Set(); // min|max|result

  for (const it of items) {
    const data = it?.data;
    const card = data?.card;
    if (!card) continue;

    const id = Number(card.Numero);
    if (!Number.isFinite(id)) continue;

    const name = String(card.Nombre ?? "");
    const type = String(card.Tipo ?? "");
    const st1 = String(card.St1 ?? "");
    const st2 = String(card.St2 ?? "");
    const attr = safeIntOrNull(card.Atributo);

    types.add(type);
    if (st1) stars.add(st1);
    if (st2) stars.add(st2);

    const { atk, def } = normalizeAtkDef(card);

    const full = {
      id,
      card,
      atk,
      def,
      drop: Array.isArray(data.drop) ? data.drop : [],
      fusion: dedupeFusions(data.fusion),
      equipos: Array.isArray(data.equipos) ? data.equipos : [],
      ritual: Array.isArray(data.ritual) ? data.ritual : [],
      ini: Array.isArray(data.ini) ? data.ini : [],
    };

    // Indexa fusões em 2 contextos:
    // 1) "fusões que geram a carta"   -> resultId = id
    // 2) "fusões que a carta gera"    -> materialId = id
    // Obs: não vamos listar a própria carta na UI; aqui só guardamos IDs.
    if (Array.isArray(full.fusion) && full.fusion.length) {
      for (const fx of full.fusion) {
        const a = safeCardNo(fx?.c1?.Numero);
        const b = safeCardNo(fx?.c2?.Numero);
        const r = safeCardNo(fx?.f?.Numero);
        if (a == null || b == null || r == null) continue;

        const min = Math.min(a, b);
        const max = Math.max(a, b);
        const key = `${min}|${max}|${r}`;
        if (seenFusionGlobal.has(key)) continue;
        seenFusionGlobal.add(key);

        // 1) Por resultado (gera a carta)
        // Se algum material for o próprio resultado, ignora (evita listar a própria carta como material)
        if (a !== r && b !== r) {
          const arr = FUSION_BY_RESULT.get(r) || [];
          arr.push({ a, b });
          FUSION_BY_RESULT.set(r, arr);
        }

        // 2) Por material (a carta gera resultados)
        if (a !== b) {
          const arrA = FUSION_BY_MATERIAL.get(a) || [];
          arrA.push({ withId: b, resultId: r });
          FUSION_BY_MATERIAL.set(a, arrA);

          const arrB = FUSION_BY_MATERIAL.get(b) || [];
          arrB.push({ withId: a, resultId: r });
          FUSION_BY_MATERIAL.set(b, arrB);
        }
      }
    }

    byId.set(id, full);
    records.push({
      id,
      name,
      nameN: normalizeName(name),
      type,
      st1,
      st2,
      attr,
    });

    const dropArr = data.drop;
    if (Array.isArray(dropArr)) {
      for (const d of dropArr) {
        const duelId = safeNum(d?.id);
        const duelName = d?.nombre ?? "";
        const rank = safeNum(d?.rank);
        const prob = d?.prob ?? null;

        if (Number.isFinite(duelId) && Number.isFinite(rank)) {
          upsertDuelDrop(duelId, duelName, id, rank, prob);
        }
      }
    }
  }

  DUELIST_LIST = Array.from(DUELISTS.values())
    .map(d => ({ id: d.id, name: d.name }))
    .sort((a, b) => a.id - b.id);

  records.sort((a, b) => a.id - b.id);
}

function query(filters) {
  const nameN = normalizeName(filters.name || "");
  const id = Number.isFinite(filters.id) ? filters.id : null;
  const type = filters.type || "";
  const star = filters.star || "";
  const attr = Number.isFinite(filters.attr) ? filters.attr : null;
  const duelId = Number.isFinite(filters.duelId) ? filters.duelId : null;
  const duelRank = Number.isFinite(filters.duelRank) ? filters.duelRank : null;

  let res = records;

  if (id != null) res = res.filter(r => r.id === id);
  if (type) res = res.filter(r => r.type === type);
  if (star) res = res.filter(r => r.st1 === star || r.st2 === star);
  if (nameN) res = res.filter(r => r.nameN.includes(nameN));
  if (attr != null) res = res.filter(r => r.attr === attr);

  if (duelId != null) {
    const d = DUELISTS.get(String(duelId));
    if (!d) {
      res = [];
    } else {
      const allowed = new Set();
      for (const [cardId, probs] of d.cards.entries()) {
        if (duelRank == null) {
          if (probs.r0 || probs.r1 || probs.r2 || probs.r3) allowed.add(cardId);
        } else {
          const ok =
            (duelRank === 0 && probs.r0) ||
            (duelRank === 1 && probs.r1) ||
            (duelRank === 2 && probs.r2) ||
            (duelRank === 3 && probs.r3);
          if (ok) allowed.add(cardId);
        }
      }
      res = res.filter(r => allowed.has(r.id));
    }
  }

  const total = res.length;

  const LIMIT = 800;
  const shown = Math.min(total, LIMIT);
  const items = res.slice(0, LIMIT).map(r => ({
    id: r.id,
    name: r.name,
    type: r.type,
    st1: r.st1,
    st2: r.st2,
    attr: r.attr,
  }));

  return { total, shown, items };
}

function getDuelistCards(duelId) {
  const d = DUELISTS.get(String(duelId));
  if (!d) return null;

  const rows = [];
  for (const [cardId, probs] of d.cards.entries()) {
    const full = byId.get(Number(cardId));
    const name = full?.card?.Nombre ? String(full.card.Nombre) : "";
    rows.push({
      id: Number(cardId),
      name,
      r0: probs.r0 ?? "",
      r1: probs.r1 ?? "",
      r2: probs.r2 ?? "",
      r3: probs.r3 ?? "",
    });
  }

  rows.sort((a, b) => a.id - b.id);

  // Totalizadores
  const isActive = (v) => {
    const s = String(v ?? "").trim();
    return s !== "" && s !== "0";
  };

  let deckCount = 0;
  let zCount = 0;
  let sPowCount = 0;
  let sTecCount = 0;
  let dropCount = 0; // pelo menos um entre r1-r3
  let anyCount = 0;  // pelo menos um entre r0-r3

  for (const r of rows) {
    const inDeck = isActive(r.r0);
    const inZ = isActive(r.r1);
    const inSPow = isActive(r.r2);
    const inSTec = isActive(r.r3);

    if (inDeck) deckCount++;
    if (inZ) zCount++;
    if (inSPow) sPowCount++;
    if (inSTec) sTecCount++;

    if (inZ || inSPow || inSTec) dropCount++;
    if (inDeck || inZ || inSPow || inSTec) anyCount++;
  }

  const totals = {
    total: rows.length,
    any: anyCount,
    deck: deckCount,
    drops: dropCount,
    z: zCount,
    sPow: sPowCount,
    sTec: sTecCount,
  };

  return { id: d.id, name: d.name, rows, totals };
}

self.onmessage = (ev) => {
  const msg = ev.data;
  if (!msg || !msg.cmd) return;

  try {
    if (msg.cmd === "load") {
      post("progress", { text: "Decodificando bytes…" });

      const decoder = new TextDecoder("utf-8");
      const jsonText = decoder.decode(msg.buffer);

      post("progress", { text: "Parseando JSON (isso pode levar alguns segundos)…" });
      const items = JSON.parse(jsonText);

      post("progress", { text: "Indexando em memória…" });
      buildCaches(items);

      const typeList = Array.from(types).filter(Boolean).sort();
      const starList = Array.from(stars).filter(Boolean).sort();

      post("ready", {
        text: `Pronto. Cartas indexadas: ${records.length}.`,
        payload: { types: typeList, stars: starList, duelists: DUELIST_LIST, totalCards: records.length },
      });
      return;
    }

    if (msg.cmd === "query") {
      const { total, shown, items } = query(msg.filters || {});
      post("results", { total, shown, items });
      return;
    }

    if (msg.cmd === "details") {
      const id = Number(msg.id);
      const item = byId.get(id) || null;

      let fusionGeneratedBy = null;
      let fusionGenerates = null;
      let ritual = null;

      if (item) {
        // Fusões que geram esta carta (resultado = id): lista pares {a,b}
        const genBy = FUSION_BY_RESULT.get(id) || [];
        fusionGeneratedBy = genBy.map(({ a, b }) => {
          const ca = byId.get(a)?.card || {};
          const cb = byId.get(b)?.card || {};
          return {
            aId: a, aName: String(ca.Nombre ?? ""),
            bId: b, bName: String(cb.Nombre ?? ""),
          };
        });

        // Fusões que esta carta faz/gera (material = id): lista {withId,resultId}
        const gen = FUSION_BY_MATERIAL.get(id) || [];
        fusionGenerates = gen.map(({ withId, resultId }) => {
          const cw = byId.get(withId)?.card || {};
          const cr = byId.get(resultId)?.card || {};
          return {
            withId,
            withName: String(cw.Nombre ?? ""),
            resultId,
            resultName: String(cr.Nombre ?? ""),
          };
        });

        // Rituais: enriquecer com nomes para permitir busca de imagens (thumbs)
        if (Array.isArray(item.ritual)) {
          ritual = item.ritual.map(r => {
            const resolve = (comp) => {
              const cid = safeCardNo(comp?.id || comp);
              if (!cid) return { id: "", nombre: "" };
              const found = byId.get(cid);
              const name = comp?.nombre || found?.card?.Nombre || "";
              return { id: cid, nombre: String(name) };
            };
            return {
              Ri: resolve(r.Ri),
              c1: resolve(r.c1),
              c2: resolve(r.c2),
              c3: resolve(r.c3),
              Rf: resolve(r.Rf)
            };
          });
        }
      }

      post("details", { item, fusionGeneratedBy, fusionGenerates, ritual });
      return;
    }

    if (msg.cmd === "duelist_cards") {
      const duelId = Number(msg.duelId);
      const payload = Number.isFinite(duelId) ? getDuelistCards(duelId) : null;
      post("duelist_cards", { payload });
      return;
    }
  } catch (err) {
    post("error", { text: "Erro no worker.", error: String(err?.stack || err) });
  }
};
