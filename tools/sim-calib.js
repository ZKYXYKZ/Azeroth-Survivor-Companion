// Compare le simulateur aux chronologies de community/data (voir community/README.md) : node tools/sim-calib.js [iters] [seuil minutes]
const fs = require("fs");
const path = require("path");
const vm = require("vm");

const root = path.join(__dirname, "..");
const web = path.join(root, "AS-Companion", "web");
const dataDir = path.join(root, "community", "data");
const ITERS = +process.argv[2] || 20;
const MIN_MIN = +process.argv[3] || 5;

const json = (f) => JSON.parse(fs.readFileSync(path.join(web, f), "utf8"));
const DATA = json("data.json");
const ctx = { DATA, Math, console, performance: { now: () => 0 }, lang: () => "en", L: (o) => (o && typeof o === "object" ? o.en : o), cls: (k) => DATA.classes.find((c) => c.key === k), spellOf: (c, k) => c.spells.find((s) => s.key === k), esc: (s) => s };
vm.createContext(ctx);
vm.runInContext(fs.readFileSync(process.env.SIM_FILE || path.join(web, "sim.js"), "utf8") + ";globalThis.API={simulate,monteCarlo,set(d){SIMDATA=d},withGameDb};", ctx);
const sim = ctx.API;
const sd = sim.withGameDb(json("simdata.json"), json("gamedb.json"));
sd.jewelUps = json("jewelups.json");
sim.set(sd);

const ndjson = (prefix) => fs.readdirSync(dataDir).filter((f) => f.startsWith(prefix)).flatMap((f) => fs.readFileSync(path.join(dataDir, f), "utf8").split("\n").filter(Boolean).map((l) => JSON.parse(l)));
const allRuns = ndjson("runs-");
const patch = new Map(allRuns.filter((r) => r.patch).map((r) => [r.patch, r.difficulty]));
const runs = new Map(allRuns.filter((r) => !r.patch && !r.suspect).map((r) => [r.runId, r]));

function parse(d, r) {
  const f = d.detail.split("|");
  const names = ["t", "lvl", "xp", "xpn", "hp", "hpm", "sh", "en", "el", "bu", "ga", "kills", "gold", "dealt", "taken"];
  const samples = f[6].split(";").map((s) => { const v = s.split(",").map(Number), o = {}; names.forEach((k, i) => (o[k] = v[i])); return o; });
  const stats = f[8].split(";").map((b) => { const [t, kv] = b.split(":"), o = { t: +t }; for (const p of (kv || "").split(",")) { const [k, v] = p.split("="); o[k] = +v; } return o; });
  const ranks = f[9].split(";").map((b) => { const [t, kv] = b.split(":"), o = { t: +t, r: {} }; for (const p of (kv || "").split(",")) { const [k, v] = p.split("="); if (k) o.r[k] = +v; } return o; });
  const meters = f[10].split(";").map((b) => { const [t, kv] = b.split(":"), o = { t: +t, m: {} }; for (const p of (kv || "").split(",")) { const [k, v] = p.split("="); if (k) o.m[k] = +v; } return o; });
  const head = f[1].split(",");
  return { run: r, zone: head[2], heroic: +head[3], diff: +head[4], result: f[2], level: +f[3], kills: +f[4], time: +f[5], samples, stats, ranks, meters };
}

function good() {
  const seen = new Set(), out = [];
  for (const d of ndjson("details-")) {
    const r = runs.get(d.runId);
    if (!r || seen.has(d.detail)) continue;
    seen.add(d.detail);
    const f = d.detail.split("|");
    if (Math.abs(+f[5] - r.time) > 3 && +f[4] !== r.kills) continue;
    if (r.level >= 70 || r.time < MIN_MIN * 60) continue;
    if (r.difficulty == null) r.difficulty = patch.get(r.runId);
    out.push(parse(d, r));
  }
  return out;
}

function decodeBuild(code, race) {
  const f = code.split(";");
  const c = ctx.cls(f[1]);
  if (!c || f.length < 10) return null;
  const talents = {};
  f[3].split("/").forEach((s, ti) => { const tree = c.trees[ti]; if (tree) tree.talents.forEach((t, i) => { const v = +s[i]; if (v > 0) talents[t.key] = Math.min(v, t.max); }); });
  const list = (s) => s.split(",").filter(Boolean).map((x) => x.split(":")[0]);
  const spells = f[4].split(",").filter(Boolean).map((p) => { const [k, w] = p.split(":"); return { key: k, w: +w || 3, rank: 5 }; }).filter((s) => ctx.spellOf(c, s.key)).slice(0, 6);
  const has = (cat, k) => DATA[cat].some((j) => j.key === k);
  return { class: f[1], name: f[2], talents, spells, rings: list(f[6]).filter((k) => has("rings", k)).slice(0, 2), trinkets: list(f[7]).filter((k) => has("trinkets", k)).slice(0, 2), amulet: list(f[8])[0] || "", amuletUps: 0, race: race || "human", rarity: 1.5, density: 6, boss: 25, allies: [], gear: {} };
}

const q = (a, p) => { a = [...a].sort((x, y) => x - y); return a.length ? a[Math.floor((a.length - 1) * p)] : NaN; };
const med = (a) => q(a, 0.5);
const fmt = (v) => (v >= 1e6 ? (v / 1e6).toFixed(2) + "M" : v >= 1000 ? (v / 1000).toFixed(1) + "k" : isNaN(v) ? "-" : v.toFixed(2));
const dpsAt = (x, m) => { const a = x.samples.filter((s) => s.t >= (m - 1) * 60 && s.t < m * 60); return a.length > 1 ? (a[a.length - 1].dealt - a[0].dealt) / (a[a.length - 1].t - a[0].t) : NaN; };
const statAt = (x, t) => x.stats.reduce((b, s) => (Math.abs(s.t - t) < Math.abs(b.t - t) ? s : b), x.stats[0]);
const levelAt = (x, t) => { const a = x.samples.filter((s) => s.t <= t); return a.length ? a[a.length - 1].lvl : NaN; };

const all = good();
const solo = all.filter((x) => (x.run.coop || 1) === 1);
console.log("chronologies retenues", all.length, "solo", solo.length, "coop", all.length - solo.length);

console.log("\n# Niveau réel par minute (médiane solo / coop) et courbe du simulateur");
const lvlAt = ctx.mcLevelAt || null;
for (const m of [1, 2, 3, 5, 8, 10, 12, 15, 18, 20]) {
  const s = solo.filter((x) => x.time >= m * 60).map((x) => levelAt(x, m * 60)), c = all.filter((x) => x.run.coop > 1 && x.time >= m * 60).map((x) => levelAt(x, m * 60));
  console.log(m + " min", "solo", med(s), "n=" + s.length, "coop", med(c), "n=" + c.length);
}

console.log("\n# Stats réelles par minute (médiane toutes parties)");
for (const k of ["dmg", "crit", "cm", "echo", "cd", "area", "cnt", "hp"]) {
  console.log(k.padEnd(5), [1, 5, 10, 15, 20].map((m) => m + "min=" + fmt(med(all.filter((x) => x.time >= m * 60).map((x) => statAt(x, m * 60)[k]).filter((v) => isFinite(v))))).join("  "));
}

console.log("\n# Réel / simulé, DPS par minute, solo (médiane des ratios)");
const ratios = {};
const rec = [];
const byClass = {};
for (const x of solo) {
  if (!x.run.build) continue;
  const sc = decodeBuild(x.run.build, x.run.race);
  if (!sc || !sc.spells.length) continue;
  const s0 = x.stats[0];
  sc.gear = { dmg: s0.gdmg * 100, crit: s0.gcrit * 100, critDmg: s0.gcm * 100, cdr: s0.gcd * 100, echo: s0.gecho * 100, area: s0.garea * 100, targets: 0 };
  const mins = Math.min(20, Math.floor(x.time / 60));
  let mc;
  try { mc = sim.monteCarlo(sc, ITERS, mins); } catch (e) { continue; }
  for (let m = 1; m <= mins; m++) {
    const real = dpsAt(x, m), s = mc.curve[m - 1];
    if (!(real > 0) || !(s > 0)) continue;
    (ratios[m] = ratios[m] || []).push(real / s);
    rec.push({ install: x.run.install, m, real, s });
    if (m % 5 === 0) (byClass[x.run.spec + "@" + m] = byClass[x.run.spec + "@" + m] || []).push(real / s);
  }
}
const lg = (a) => a.map(Math.log);
for (const m of Object.keys(ratios)) {
  const a = ratios[m];
  console.log(String(m).padStart(2), "min n=" + String(a.length).padEnd(4), "médiane x" + med(a).toFixed(2), "q25 x" + q(a, 0.25).toFixed(2), "q75 x" + q(a, 0.75).toFixed(2), "écart log " + Math.sqrt(lg(a).reduce((s, v) => s + (v - med(lg(a))) ** 2, 0) / a.length).toFixed(2));
}
console.log("\n# Par spé (médiane à 5, 10, 15 min, au moins 3 parties)");
for (const sp of [...new Set(Object.keys(byClass).map((k) => k.split("@")[0]))].sort()) {
  const cells = [5, 10, 15].map((m) => { const a = byClass[sp + "@" + m] || []; return a.length >= 3 ? m + "min x" + med(a).toFixed(1) + " (" + a.length + ")" : m + "min -"; });
  console.log(sp.padEnd(11), cells.join("  "));
}
const spearman = (pts) => {
  const rank = (i) => { const o = pts.map((p, j) => [p[i], j]).sort((a, b) => a[0] - b[0]), r = []; o.forEach(([, j], k) => (r[j] = k)); return r; };
  const a = rank(0), b = rank(1), n = pts.length, ma = (n - 1) / 2;
  let num = 0, da = 0, db = 0;
  for (let i = 0; i < n; i++) { num += (a[i] - ma) * (b[i] - ma); da += (a[i] - ma) ** 2; db += (b[i] - ma) ** 2; }
  return num / Math.sqrt(da * db);
};
console.log("\n# Classement des parties, réel contre simulé (Spearman)");
for (const m of [5, 10, 15]) { const p = rec.filter((r) => r.m === m).map((r) => [r.real, r.s]); console.log(m + " min", "n=" + p.length, spearman(p).toFixed(2)); }
console.log("\n# Validation : rendement appris sur la moitié des installations, testé sur l'autre");
const installs = [...new Set(rec.map((r) => r.install))].sort();
const foldA = new Set(installs.filter((_, i) => i % 2 === 0));
for (const [train, test] of [[(r) => foldA.has(r.install), (r) => !foldA.has(r.install)], [(r) => !foldA.has(r.install), (r) => foldA.has(r.install)]]) {
  const y = {};
  for (let m = 1; m <= 18; m++) y[m] = med(rec.filter((r) => train(r) && r.m === m).map((r) => r.real / r.s));
  const out = [5, 10, 15].map((m) => { const a = rec.filter((r) => test(r) && r.m === m).map((r) => r.real / (r.s * y[m])); return m + "min x" + med(a).toFixed(2) + " [" + q(a, 0.25).toFixed(2) + "-" + q(a, 0.75).toFixed(2) + "] n=" + a.length; });
  console.log(out.join("  "));
}
console.log("\nRendement à reporter (toutes installations) :", JSON.stringify([1, 2, 3, 4, 5, 6, 8, 10, 12, 14, 16, 18].map((m) => { const a = rec.filter((r) => Math.abs(r.m - m) <= 1).map((r) => r.real / r.s); return [m, +med(a).toFixed(2)]; })));
module.exports = { all, solo, sim, ctx, decodeBuild, dpsAt, statAt, levelAt, med, q, fmt };
