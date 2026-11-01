// Analyse en lecture seule : simule chaque build suggere (defaults.json) et le croise avec les
// vraies stats communautaires (tools/.cache/as-stats.json, recupere depuis as-stats.zkysolutions.com).
// Ne modifie rien. Usage: node tools/analyze-all-specs.js
const fs = require("fs");
const path = require("path");
const vm = require("vm");

const root = path.join(__dirname, "..");
const web = path.join(root, "AS-Companion", "web");
const json = (f) => JSON.parse(fs.readFileSync(path.join(web, f), "utf8"));
const DATA = json("data.json");
const DEFAULTS = json("defaults.json");
const STATS = JSON.parse(fs.readFileSync(path.join(__dirname, ".cache", "as-stats.json"), "utf8"));

const ctx = { DATA, Math, console, performance: { now: () => 0 }, lang: () => "en", L: (o) => (o && typeof o === "object" ? o.en : o), cls: (k) => DATA.classes.find((c) => c.key === k), spellOf: (c, k) => c.spells.find((s) => s.key === k), esc: (s) => s };
vm.createContext(ctx);
vm.runInContext(fs.readFileSync(path.join(web, "sim.js"), "utf8") + ";globalThis.API={simulate,monteCarlo,set(d){SIMDATA=d},withGameDb};", ctx);
const sim = ctx.API;
const sd = sim.withGameDb(json("simdata.json"), json("gamedb.json"));
sd.jewelUps = json("jewelups.json");
sim.set(sd);

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

const ITERS = 400;
const MINUTES = 15;
const fmt = (v) => (v == null || isNaN(v) ? "-" : v >= 1e6 ? (v / 1e6).toFixed(2) + "M" : v >= 1000 ? (v / 1000).toFixed(1) + "k" : v.toFixed(0));
const pct = (v) => (v == null || isNaN(v) ? "-" : (v * 100).toFixed(0) + "%");

// Specs = index dans l'ordre des builds par classe (0,1,2) pour matcher "classe-N" des stats reelles.
const bySpecIndex = {};
for (const b of DEFAULTS) (bySpecIndex[b.class] = bySpecIndex[b.class] || []).push(b);

// Agrege les vraies stats par "classe-specIndex" a partir de groups (classe/race/zone/difficulte -> fusion).
// Mediane plutot que moyenne : un seul groupe a DPS tres eleve (petit echantillon, triche possible,
// difficulte faible) ecrase sinon completement l'image du joueur typique.
const q = (a, p) => { const s = a.slice().sort((x, y) => x - y); return s.length ? s[Math.min(s.length - 1, Math.floor((s.length - 1) * p))] : NaN; };
const med = (a) => q(a, 0.5);

const real = {};
for (const g of STATS.groups) {
  const key = g.spec; // deja au format "classe-N"
  const r = (real[key] = real[key] || { runs: 0, wins: 0, dpsList: [], levelList: [], bestDps: 0, groupCount: 0 });
  r.runs += g.runs;
  r.wins += g.wins;
  r.groupCount++;
  if (g.avgDps) for (let i = 0; i < g.runs; i++) r.dpsList.push(g.avgDps);
  r.bestDps = Math.max(r.bestDps, g.bestDps || 0);
  if (g.avgLevel) for (let i = 0; i < g.runs; i++) r.levelList.push(g.avgLevel);
}

console.log(`Source stats: ${STATS.runs} parties, ${STATS.players} joueurs, maj ${STATS.updated}`);
console.log(`Simulation: ${ITERS} iterations Monte-Carlo, ${MINUTES} min, race du preset\n`);

const rows = [];
for (const [cls, builds] of Object.entries(bySpecIndex)) {
  builds.forEach((b, specIdx) => {
    const specKey = `${cls}-${specIdx}`;
    const sc = decodeBuild(b.code, b.race);
    let mc = null;
    try { mc = sim.monteCarlo(sc, ITERS, MINUTES); } catch (e) { /* ignore */ }
    const r = real[specKey] || { runs: 0, wins: 0, dpsList: [], levelList: [], bestDps: 0, groupCount: 0 };
    rows.push({
      cls, specKey, name: b.name,
      simDps: mc ? mc.mean : NaN,
      realRuns: r.runs, realWins: r.wins, realGroups: r.groupCount, realWinRate: r.runs ? r.wins / r.runs : NaN,
      realMedDps: med(r.dpsList), realP25Dps: q(r.dpsList, 0.25), realP75Dps: q(r.dpsList, 0.75),
      realBestDps: r.bestDps,
      realMedLevel: med(r.levelList),
    });
  });
}

rows.sort((a, b) => (a.realWinRate ?? 2) - (b.realWinRate ?? 2));
console.log("Classe".padEnd(10), "Spec".padEnd(24), "Parties".padEnd(8), "Victoires".padEnd(10), "Tx victoire".padEnd(12), "DPS simule".padEnd(11), "DPS reel med".padEnd(13), "DPS reel [q25-q75]".padEnd(20), "Niveau med");
for (const row of rows) {
  console.log(
    row.cls.padEnd(10), row.name.padEnd(24), String(row.realRuns).padEnd(8), String(row.realWins).padEnd(10),
    pct(row.realWinRate).padEnd(12), fmt(row.simDps).padEnd(11), fmt(row.realMedDps).padEnd(13),
    `[${fmt(row.realP25Dps)}-${fmt(row.realP75Dps)}]`.padEnd(20), fmt(row.realMedLevel)
  );
}

module.exports = { rows, decodeBuild, sim, real };
