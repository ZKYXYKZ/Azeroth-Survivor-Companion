const http = require("http");
const fs = require("fs");
const path = require("path");
const crypto = require("crypto");
const zlib = require("zlib");

const PORT = +process.env.PORT || 3040;
const DATA = process.env.DATA_DIR || path.join(__dirname, "data");
const PUBLIC = path.join(__dirname, "public");
const MAX_BODY = 64 * 1024;
const LIMIT_IP = 60;
const LIMIT_INSTALL = 30;
const LIMIT_DETAILS = 150;
const HELD_LEVEL = 70;
const HELD_KILLS = 20000;
const RECENT = 50;
const MAX_BUILDS = 5000;
const MIN_VICTORY = 15 * 60;
const DAY_BYTES = 300 * 1024 * 1024;
const KEY = /^[\p{L}\p{N} _:'().,!-]{1,40}$/u;
const CTRL = /[\u0000-\u001f\u007f]/;

fs.mkdirSync(DATA, { recursive: true });

const I18N = fs.readFileSync(path.join(PUBLIC, "i18n.json"));
const NAMES = JSON.parse(fs.readFileSync(path.join(__dirname, "names.json"), "utf8"));
const index = (table) => { const o = {}; for (const [k, names] of Object.entries(table)) { o[k] = k; for (const n of names) o[n.toLowerCase()] = k; } return o; };
const ZONE_OF = index(NAMES.zones), RACE_OF = index(NAMES.races);
const keyOf = (table, v) => (typeof v === "string" ? table[v.toLowerCase()] || null : null);

const CLASSES = ["warrior", "paladin", "hunter", "rogue", "priest", "shaman", "mage", "warlock", "druid"];
const RESULTS = ["victory", "defeat", "left"];
const CLASS_IDS = { 1: "warrior", 2: "paladin", 3: "hunter", 4: "rogue", 5: "priest", 7: "shaman", 8: "mage", 9: "warlock", 11: "druid" };

const str = (v, max) => (typeof v === "string" ? v.slice(0, max) : null);
const num = (v, lo, hi) => (typeof v === "number" && isFinite(v) ? Math.min(hi, Math.max(lo, v)) : null);
const hash = (s) => crypto.createHash("sha256").update(s).digest("hex").slice(0, 16);

function clean(r, ip) {
  if (!r || typeof r !== "object" || r.v !== 1) return null;
  const cls = str(r.class, 20);
  if (!CLASSES.includes(cls)) return null;
  const install = str(r.install, 64);
  if (!install || install.length < 16) return null;
  const run = {
    at: new Date().toISOString(),
    install: hash(install),
    runId: typeof r.runId === "string" && /^[0-9a-f]{16}$/.test(r.runId) ? r.runId : null,
    client: str(r.client, 20),
    class: cls,
    race: keyOf(RACE_OF, r.race),
    spec: typeof r.spec === "string" && new RegExp("^" + cls + "-[0-2]$").test(r.spec) ? r.spec : null,
    zone: keyOf(ZONE_OF, r.zone),
    difficulty: num(r.difficulty, 0, 10),
    coop: Math.round(num(r.coop, 1, 5) || 1),
    role: r.role === "host" || r.role === "guest" ? r.role : null,
    group: typeof r.group === "string" && /^[0-9a-f]{16}$/.test(r.group) ? r.group : null,
    party: Array.isArray(r.party) ? r.party.slice(0, 5).map((m) => ({ class: CLASS_IDS[m && m.classId] || null, race: keyOf(RACE_OF, m && m.race), host: !!(m && m.host), me: !!(m && m.me) })) : null,
    downed: num(r.downed, 0, 1000),
    allyDowned: num(r.allyDowned, 0, 1000),
    result: RESULTS.includes(r.result) ? r.result : "defeat",
    time: num(r.time, 0, 36000),
    level: num(r.level, 0, 500),
    kills: num(r.kills, 0, 1e7),
    dps: num(r.dps, 0, 1e12),
    damage: num(r.damage, 0, 1e15),
    taken: num(r.taken, 0, 1e12),
    build: typeof r.build === "string" && r.build.startsWith("SB1;" + cls + ";") && !CTRL.test(r.build) ? r.build.slice(0, 2000) : null,
    startedAt: str(r.startedAt, 40),
    endedAt: str(r.endedAt, 40),
    jewels: Array.isArray(r.jewels) ? r.jewels.slice(0, 8).map((j) => str(j, 40)).filter((j) => j && KEY.test(j)) : [],
    amuletUps: num(r.amuletUps, 0, 50),
    minutes: Array.isArray(r.minutes) ? r.minutes.slice(0, 120).map((m) => ({ dps: num(m && m.dps, 0, 1e12), taken: num(m && m.taken, 0, 1e12), level: num(m && m.level, 0, 500) })) : [],
    spells: Object.create(null),
    detail: typeof r.detail === "string" && r.detail.startsWith("AZD1|") ? r.detail.slice(0, 1000000) : null,
    picks: Array.isArray(r.picks) ? r.picks.slice(0, 400).map((p) => ({ t: num(p && p.t, 0, 36000), took: str(p && p.took, 40), kind: str(p && p.kind, 20), rarity: num(p && p.rarity, 0, 10) })) : [],
  };
  if (r.spells && typeof r.spells === "object")
    for (const [k, v] of Object.entries(r.spells).slice(0, 40)) {
      const key = str(k, 40);
      if (key && KEY.test(key) && v && typeof v === "object") run.spells[key] = { rank: num(v.rank, 0, 100), share: num(v.share, 0, 1) };
    }
  if (!run.time || run.level == null || !run.zone) return null;
  const real = (Date.parse(run.endedAt) - Date.parse(run.startedAt)) / 1000;
  if (isFinite(real) && real < run.time * 0.9) run.suspect = true;
  if (run.result === "victory" && run.time < MIN_VICTORY) run.suspect = true;
  return run;
}

let stats, open = new Map(), held = new Set();
const LIMITS = { dmg: 1000, crit: 10, cm: 100, area: 100, echo: 10, cnt: 100, reg: 1e6, spd: 10 };
function cheated(detail) {
  const f = detail.split("|");
  for (const block of (f[8] || "").split(";"))
    for (const kv of (block.split(":")[1] || "").split(",")) {
      const [k, v] = kv.split("=");
      if (LIMITS[k] && +v > LIMITS[k]) return true;
    }
  for (const sample of (f[6] || "").split(";")) {
    const v = sample.split(",").map(Number);
    if (v[4] > v[5] * 1.05 + 1 || v[4] >= 9999) return true;
  }
  return false;
}
function detailKeys() {
  const ids = new Set(), olds = new Set(), seen = new Set();
  for (const f of fs.readdirSync(DATA).filter((n) => /^details-\d{4}-\d{2}.ndjson$/.test(n)))
    for (const line of fs.readFileSync(path.join(DATA, f), "utf8").split("\n")) {
      if (!line) continue;
      try {
        const d = JSON.parse(line);
        if (d.runId) seen.add(d.install + "|" + d.runId);
        if (!cheated(d.detail)) continue;
        if (d.runId) ids.add(d.install + "|" + d.runId);
        else olds.add(d.install + "|" + d.level + "|" + d.kills);
      } catch (e) {}
    }
  return { ids, olds, seen };
}
function outsized(r) {
  return r.level >= HELD_LEVEL || r.kills > HELD_KILLS;
}
function heroicOf(detail) {
  const h = +((detail.split("|")[1] || "").split(",")[3]);
  return isFinite(h) && h >= 0 && h <= 10 ? h : null;
}
function emptyStats() {
  return { runs: 0, installs: new Set(), groups: Object.create(null), builds: Object.create(null), spells: Object.create(null), recent: [], best: Object.create(null), nbuilds: 0 };
}
function allies(r) {
  if (!Array.isArray(r.party) || (r.coop || 1) < 2) return [];
  return r.party.filter((m) => m && !m.me).map((m) => ({ class: m.class, race: m.race, host: !!m.host }));
}
function selfHost(r) {
  return Array.isArray(r.party) && r.party.some((m) => m && m.me && m.host);
}
function named(code, name) {
  const p = code.split(";");
  p[2] = name;
  return p.join(";");
}
function groupKey(r) {
  return [r.class, r.spec || "?", r.race || "?", r.zone || "?", r.difficulty == null ? "?" : r.difficulty, r.coop || 1, allies(r).map((m) => m.class || "?").sort().join("+")].join("|");
}
function add(r) {
  if (r.suspect) return;
  stats.runs++;
  stats.installs.add(r.install);
  const g = (stats.groups[groupKey(r)] = stats.groups[groupKey(r)] || { n: 0, wins: 0, time: 0, level: 0, dps: 0, best: 0, dmg: 0, kills: 0, bestDmg: 0 });
  g.n++;
  if (r.result === "victory") g.wins++;
  g.time += r.time || 0;
  g.level += r.level || 0;
  g.dps += r.dps || 0;
  g.best = Math.max(g.best, r.dps || 0);
  g.dmg += r.damage || 0;
  g.kills += r.kills || 0;
  g.bestDmg = Math.max(g.bestDmg, r.damage || 0);
  const bk = r.build && named(r.build, "") + "#" + (r.coop || 1) + "|" + allies(r).map((m) => m.class || "?").sort().join("+");
  if (bk && (stats.builds[bk] || stats.nbuilds < MAX_BUILDS)) {
    if (!stats.builds[bk]) stats.nbuilds++;
    const b = (stats.builds[bk] = stats.builds[bk] || { n: 0, wins: 0, dps: 0, dmg: 0, kills: 0, class: r.class, names: Object.create(null) });
    b.n++;
    const nm = r.build.split(";")[2] || "";
    b.names[nm] = (b.names[nm] || 0) + 1;
    if (r.result === "victory") b.wins++;
    b.dps += r.dps || 0;
    b.dmg += r.damage || 0;
    b.kills += r.kills || 0;
  }
  for (const [k, v] of Object.entries(r.spells || {})) {
    if (!KEY.test(k)) continue;
    const s = (stats.spells[r.class + "|" + k] = stats.spells[r.class + "|" + k] || { n: 0, share: 0 });
    s.n++;
    s.share += v.share || 0;
  }
  const zk = (r.zone || "?") + "|" + (r.difficulty == null ? "?" : r.difficulty) + "|" + (r.coop || 1);
  if (!stats.best[zk] || (r.damage || 0) > (stats.best[zk].damage || 0)) stats.best[zk] = { dps: r.dps, damage: r.damage, kills: r.kills, with: allies(r), host: selfHost(r), class: r.class, spec: r.spec, race: r.race, level: r.level, time: r.time, result: r.result, at: r.at };
  stats.recent.unshift({ class: r.class, spec: r.spec, race: r.race, zone: r.zone, difficulty: r.difficulty, coop: r.coop || 1, with: allies(r), host: selfHost(r), result: r.result, level: r.level, time: r.time, dps: r.dps, damage: r.damage, kills: r.kills, at: r.at });
  if (stats.recent.length > RECENT) stats.recent.length = RECENT;
}

function files() {
  return fs.readdirSync(DATA).filter((f) => /^runs-\d{4}-\d{2}\.ndjson$/.test(f)).sort();
}
function rebuild() {
  stats = emptyStats();
  open = new Map();
  held = new Set();
  const runs = [], patch = new Map();
  for (const f of files())
    for (const line of fs.readFileSync(path.join(DATA, f), "utf8").split("\n")) {
      if (!line) continue;
      try { const r = JSON.parse(line); if (r.patch) patch.set(r.install + "|" + r.patch, r.difficulty); else runs.push(r); } catch (e) {}
    }
  const bad = detailKeys();
  for (const r of runs) {
    const k = r.install + "|" + r.runId;
    if ((r.runId && bad.ids.has(k)) || bad.olds.has(r.install + "|" + r.level + "|" + r.kills)) r.suspect = true;
    if (r.runId && patch.has(k)) r.difficulty = patch.get(k);
    if (r.runId && r.difficulty == null) open.set(k, r.at.slice(0, 7));
    if (outsized(r) && !bad.seen.has(k)) held.add(k);
    else add(r);
  }
  cache = null;
}

let cache = null, cacheAt = 0;
function snapshot() {
  if (cache && Date.now() - cacheAt < 60000) return cache;
  const groups = Object.entries(stats.groups).map(([k, g]) => {
    const [cls, spec, race, zone, difficulty, coop, mates] = k.split("|");
    return { class: cls, spec, race, zone, difficulty, coop: +coop || 1, with: mates ? mates.split("+").map((c) => ({ class: c === "?" ? null : c })) : [], runs: g.n, wins: g.wins, avgTime: Math.round(g.time / g.n), avgLevel: Math.round((g.level / g.n) * 10) / 10, avgDps: Math.round(g.dps / g.n), bestDps: Math.round(g.best), avgDamage: Math.round(g.dmg / g.n), bestDamage: Math.round(g.bestDmg), avgKills: Math.round(g.kills / g.n) };
  });
  const builds = Object.entries(stats.builds).map(([k, b]) => {
    const name = Object.entries(b.names).sort((x, y) => y[1] - x[1])[0][0], code = named(k.slice(0, k.lastIndexOf("#")), name), [coop, mates] = k.slice(k.lastIndexOf("#") + 1).split("|");
    return { code, coop: +coop || 1, with: mates ? mates.split("+").map((c) => ({ class: c === "?" ? null : c })) : [], class: b.class, name, names: Object.keys(b.names), runs: b.n, wins: b.wins, avgDps: Math.round(b.dps / b.n), avgDamage: Math.round(b.dmg / b.n), avgKills: Math.round(b.kills / b.n) };
  }).sort((a, b) => b.runs - a.runs).slice(0, 50);
  const spells = Object.entries(stats.spells).map(([k, s]) => ({ class: k.split("|")[0], spell: k.split("|")[1], runs: s.n, avgShare: Math.round((s.share / s.n) * 1000) / 10 })).filter((s) => s.runs >= 3).sort((a, b) => b.avgShare - a.avgShare);
  const best = Object.entries(stats.best).map(([k, v]) => Object.assign({ zone: k.split("|")[0], difficulty: k.split("|")[1], coop: +k.split("|")[2] || 1 }, v)).sort((a, b) => (b.damage || 0) - (a.damage || 0));
  cache = JSON.stringify({ updated: new Date().toISOString(), runs: stats.runs, players: stats.installs.size, groups, builds, spells, best, recent: stats.recent });
  cacheAt = Date.now();
  return cache;
}

let day = "", dayBytes = 0;
function quota(n) {
  const d = new Date().toISOString().slice(0, 10);
  if (d !== day) { day = d; dayBytes = 0; }
  if (dayBytes + n > DAY_BYTES) return false;
  dayBytes += n;
  return true;
}

const hits = new Map();
function limited(key, max) {
  const now = Date.now();
  const h = hits.get(key);
  if (!h || now - h.at > 3600000) { hits.set(key, { at: now, n: 1 }); return false; }
  h.n++;
  return h.n > max;
}
setInterval(() => { const now = Date.now(); for (const [k, h] of hits) if (now - h.at > 3600000) hits.delete(k); }, 600000).unref();

function send(res, code, body, type) {
  res.writeHead(code, { "Content-Type": type || "application/json; charset=utf-8", "Cache-Control": code === 200 && type ? "public, max-age=60" : "no-store" });
  res.end(body);
}

const server = http.createServer((req, res) => {
  const ip = (req.headers["x-real-ip"] || req.socket.remoteAddress || "").toString();
  const url = req.url.split("?")[0];
  if (req.method === "POST" && url === "/api/runs") {
    if (limited("ip:" + ip, LIMIT_IP)) return send(res, 429, '{"error":"too many"}');
    let size = 0;
    const chunks = [];
    req.on("data", (c) => {
      size += c.length;
      if (size > MAX_BODY) { send(res, 413, '{"error":"too large"}'); req.destroy(); return; }
      chunks.push(c);
    });
    req.on("end", () => {
      if (size > MAX_BODY) return;
      let r;
      try {
        let body = Buffer.concat(chunks);
        if ((req.headers["content-encoding"] || "").includes("gzip")) body = zlib.gunzipSync(body, { maxOutputLength: 2 * 1024 * 1024 });
        r = clean(JSON.parse(body.toString("utf8")), ip);
      } catch (e) { r = null; }
      if (!r) return send(res, 400, '{"error":"invalid"}');
      if (limited("in:" + r.install, LIMIT_INSTALL)) return send(res, 429, '{"error":"too many"}');
      const month = r.at.slice(0, 7);
      let detail = r.detail;
      delete r.detail;
      if (detail && CTRL.test(detail)) detail = null;
      if (detail && cheated(detail)) r.suspect = true;
      if (!quota(JSON.stringify(r).length + (detail ? detail.length : 0))) return send(res, 503, '{"error":"busy"}');
      if (detail) fs.appendFile(path.join(DATA, "details-" + month + ".ndjson"), JSON.stringify({ at: r.at, install: r.install, runId: r.runId, class: r.class, zone: r.zone, level: r.level, kills: r.kills, detail }) + "\n", () => {});
      fs.appendFile(path.join(DATA, "runs-" + month + ".ndjson"), JSON.stringify(r) + "\n", (err) => {
        if (err) return send(res, 500, '{"error":"store"}');
        if (r.runId && r.difficulty == null && !detail) open.set(r.install + "|" + r.runId, month);
        if (outsized(r) && !detail) held.add(r.install + "|" + r.runId);
        else add(r);
        send(res, 201, '{"ok":true}');
      });
    });
    return;
  }
  if (req.method === "POST" && url === "/api/details") {
    if (limited("dip:" + ip, LIMIT_DETAILS)) return send(res, 429, '{"error":"too many"}');
    let size = 0;
    const chunks = [];
    req.on("data", (c) => {
      size += c.length;
      if (size > MAX_BODY) { send(res, 413, '{"error":"too large"}'); req.destroy(); return; }
      chunks.push(c);
    });
    req.on("end", () => {
      if (size > MAX_BODY) return;
      let d;
      try {
        let body = Buffer.concat(chunks);
        if ((req.headers["content-encoding"] || "").includes("gzip")) body = zlib.gunzipSync(body, { maxOutputLength: 2 * 1024 * 1024 });
        d = JSON.parse(body.toString("utf8"));
      } catch (e) { d = null; }
      const install = d && str(d.install, 64);
      const ok = d && d.v === 1 && install && install.length >= 16 && typeof d.runId === "string" && /^[0-9a-f]{16}$/.test(d.runId) && CLASSES.includes(d.class) && typeof d.detail === "string" && d.detail.startsWith("AZD1|") && d.detail.length <= 1000000 && !CTRL.test(d.detail);
      if (!ok) return send(res, 400, '{"error":"invalid"}');
      const who = hash(install);
      if (limited("din:" + who, LIMIT_DETAILS)) return send(res, 429, '{"error":"too many"}');
      if (!quota(d.detail.length + 200)) return send(res, 503, '{"error":"busy"}');
      const at = new Date().toISOString();
      fs.appendFile(path.join(DATA, "details-" + at.slice(0, 7) + ".ndjson"), JSON.stringify({ at, install: who, runId: d.runId, class: d.class, level: num(d.level, 0, 500), kills: num(d.kills, 0, 1e7), detail: d.detail }) + "\n", (err) => {
        if (err) return send(res, 500, '{"error":"store"}');
        const k = who + "|" + d.runId, month = open.get(k), h = heroicOf(d.detail);
        if (cheated(d.detail)) { open.delete(k); rebuild(); }
        else if (month && h != null) {
          open.delete(k);
          fs.appendFile(path.join(DATA, "runs-" + month + ".ndjson"), JSON.stringify({ patch: d.runId, install: who, difficulty: h }) + "\n", () => rebuild());
        }
        else if (held.has(k)) rebuild();
        send(res, 201, '{"ok":true}');
      });
    });
    return;
  }
  if (req.method === "GET" && url === "/api/stats") return send(res, 200, snapshot(), "application/json; charset=utf-8");
  if (req.method === "GET" && (url === "/" || url === "/index.html")) return send(res, 200, fs.readFileSync(path.join(PUBLIC, "index.html")), "text/html; charset=utf-8");
  if (req.method === "GET" && url === "/i18n.json") return send(res, 200, I18N, "application/json; charset=utf-8");
  if (req.method === "GET" && url === "/health") return send(res, 200, '{"ok":true}');
  send(res, 404, '{"error":"not found"}');
});

rebuild();
server.listen(PORT, "127.0.0.1", () => console.log("as-stats on 127.0.0.1:" + PORT + ", " + stats.runs + " runs"));
