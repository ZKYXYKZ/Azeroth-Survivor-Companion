// Cale le simulateur sur les chronologies : facteur par sort et part des procs par talent, ecrits dans web/simcal.json.
// Chaque fenetre de 5 min d'une partie solo compare le compteur reel au simulateur nourri des stats et rangs reels.
// Validation : apprentissage sur une partie des joueurs, mesure sur les autres. Usage : node tools/sim-tune.js [iters] [--write]
const fs = require("fs");
const path = require("path");

const ITERS = +process.argv[2] || 10;
const WRITE = process.argv.includes("--write");
const log = console.log;
console.log = () => {};
process.argv[2] = "1";
const { solo, sim, ctx, decodeBuild, statAt, med, q } = require("./sim-calib.js");
console.log = log;

const DATA = ctx.DATA;
const SHRINK = 4, MIN_RUNS = 3;
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const sd = sim.get();
const yieldAt = (m) => ctx.mcYield(m);

// Ramene chaque ligne du compteur a un sort ou a un talent de la classe (noms anglais et francais)
function nameMaps(c) {
  const spells = {}, talents = {};
  for (const s of c.spells) for (const l of ["en", "fr"]) spells[s.name[l]] = s.key;
  for (const t of c.trees) for (const x of t.talents) for (const l of ["en", "fr"]) talents[x.name[l]] = x.key;
  return { spells, talents };
}
// Un proc deja modelise par le simulateur compte dans le sort qu'il lance
const MODELLED = { hot_streak: "pyroblast", chastise: "holy_nova" };

function windows(x) {
  const out = [];
  const c = ctx.cls(x.run.class);
  const maps = nameMaps(c);
  const metAt = (t) => x.meters.reduce((b, m) => (Math.abs(m.t - t) < Math.abs(b.t - t) ? m : b), x.meters[0]);
  for (let m = 5; m <= 20 && m * 60 <= x.time + 30; m += 5) {
    const a = metAt((m - 5) * 60), b = metAt(m * 60), dt = b.t - a.t;
    if (dt < 120) continue;
    const real = {}, proc = {};
    let named = 0;
    for (const [k, v] of Object.entries(b.m)) {
      const d = (v - (a.m[k] || 0)) / dt;
      if (!(d > 0)) continue;
      const tal = maps.talents[k];
      const sp = maps.spells[k] || (tal && MODELLED[tal]);
      if (sp) { real[sp] = (real[sp] || 0) + d; named += d; }
      else if (tal) proc[tal] = (proc[tal] || 0) + d;
    }
    const st = statAt(x, (m - 2.5) * 60);
    const rk = x.ranks.reduce((best, r) => (Math.abs(r.t - (m - 2.5) * 60) < Math.abs(best.t - (m - 2.5) * 60) ? r : best), x.ranks[0]);
    out.push({ m: m - 2.5, real, proc, named, st, rk: rk.r, install: x.run.install, runId: x.run.runId, cls: x.run.class });
  }
  return out;
}

function scOf(x, w) {
  const sc = decodeBuild(x.run.build, x.run.race);
  if (!sc) return null;
  const c = ctx.cls(x.run.class);
  sc.spells = Object.entries(w.rk).filter(([k]) => ctx.spellOf(c, k)).map(([k, r]) => ({ key: k, w: 3, rank: Math.max(1, r) }));
  const am = (x.run.jewels || []).find((j) => j.startsWith("leg:") || DATA.amulets.some((a) => a.key === j));
  sc.amulet = am || "";
  sc.real = { dmg: w.st.dmg, crit: w.st.crit, cm: w.st.cm, cd: w.st.cd, echo: w.st.echo, area: w.st.area };
  return sc;
}

const samples = [];
for (const x of solo) {
  if (!x.run.build || !x.meters.length || !x.ranks.length) continue;
  for (const w of windows(x)) {
    if (!isFinite(w.st.dmg)) continue;
    const sc = scOf(x, w);
    if (!sc || !sc.spells.length) continue;
    sd.cal = null;
    const r = sim.simulate(sc);
    const rows = {};
    for (const row of r.rows) if (row.mix > 0) rows[row.key] = row.mix * yieldAt(w.m);
    const named = Object.values(rows).reduce((a, b) => a + b, 0);
    samples.push({ w, rows, simNamed: named, talents: sc.talents });
  }
}

function fit(keep) {
  const sp = {}, tal = {};
  for (const s of samples) {
    if (!keep(s.w.install)) continue;
    for (const [k, v] of Object.entries(s.rows)) {
      const real = s.w.real[k];
      if (real > 0) ((sp[k] = sp[k] || { r: [], runs: new Set() }).r.push(Math.log(real / v)), sp[k].runs.add(s.w.runId));
    }
    if (s.w.named > 0) for (const k of Object.keys(s.talents)) {
      const d = s.w.proc[k];
      if (d !== undefined) ((tal[k] = tal[k] || { r: [], runs: new Set() }).r.push(d / s.w.named), tal[k].runs.add(s.w.runId));
    }
  }
  const spells = {}, talents = {};
  for (const [k, e] of Object.entries(sp)) {
    if (e.runs.size < MIN_RUNS) continue;
    spells[k] = +clamp(Math.exp(med(e.r) * e.runs.size / (e.runs.size + SHRINK)), 0.25, 4).toFixed(3);
  }
  for (const [k, e] of Object.entries(tal)) {
    if (e.runs.size < MIN_RUNS) continue;
    talents[k] = +clamp(med(e.r) * e.runs.size / (e.runs.size + SHRINK), 0, 3).toFixed(3);
  }
  // Le rendement global reste a MC_YIELD : seuls les ecarts entre sorts d'une meme classe comptent
  const byClass = {};
  for (const c of DATA.classes) for (const x of c.spells) if (spells[x.key]) (byClass[c.key] = byClass[c.key] || []).push(x.key);
  for (const keys of Object.values(byClass)) { const m = med(keys.map((k) => spells[k])); for (const k of keys) spells[k] = +clamp(spells[k] / m, 0.4, 2.5).toFixed(3); }
  return { spells, talents, n: { spells: Object.fromEntries(Object.entries(sp).map(([k, e]) => [k, e.runs.size])), talents: Object.fromEntries(Object.entries(tal).map(([k, e]) => [k, e.runs.size])) } };
}

// Mesure hors echantillon : DPS par partie sur Monte-Carlo complet
const spearman = (pts) => {
  const rank = (i) => { const o = pts.map((p, j) => [p[i], j]).sort((a, b) => a[0] - b[0]), r = []; o.forEach(([, j], k) => (r[j] = k)); return r; };
  const a = rank(0), b = rank(1), n = pts.length, ma = (n - 1) / 2;
  let num = 0, da = 0, db = 0;
  for (let i = 0; i < n; i++) { num += (a[i] - ma) * (b[i] - ma); da += (a[i] - ma) ** 2; db += (b[i] - ma) ** 2; }
  return num / Math.sqrt(da * db);
};
function score(list, cal) {
  sd.cal = cal;
  const out = [];
  for (const x of list) {
    const sc = decodeBuild(x.run.build, x.run.race);
    if (!sc || !sc.spells.length) continue;
    const s0 = x.stats[0];
    sc.gear = { dmg: s0.gdmg * 100, crit: s0.gcrit * 100, critDmg: s0.gcm * 100, cdr: s0.gcd * 100, echo: s0.gecho * 100, area: s0.garea * 100, targets: 0 };
    const mins = Math.min(20, Math.floor(x.time / 60));
    if (mins < 5) continue;
    const mc = sim.monteCarlo(sc, ITERS, mins);
    const a = x.samples[0], b = x.samples[x.samples.length - 1];
    const real = (b.dealt - a.dealt) / (b.t - a.t), s = mc.mean;
    if (real > 0 && s > 0) out.push({ real, s, spec: x.run.spec, zone: x.zone, install: x.run.install, coop: x.run.coop, build: x.run.build.split(";").slice(1, 3).join(" ") });
  }
  return out;
}
const report = (lbl, pts) => {
  const lr = pts.map((p) => Math.log(p.real / p.s)), m = lr.reduce((a, b) => a + b, 0) / lr.length;
  const spec = {};
  for (const p of pts) (spec[p.spec] = spec[p.spec] || []).push(Math.log(p.real / p.s));
  const big = Object.values(spec).filter((a) => a.length >= 5).map((a) => Math.abs(med(a)));
  log(lbl.padEnd(26), "n=" + pts.length, "écart log", Math.sqrt(lr.reduce((a, v) => a + (v - m) ** 2, 0) / lr.length).toFixed(2), "médiane x" + Math.exp(med(lr)).toFixed(2), "Spearman", spearman(pts.map((p) => [p.real, p.s])).toFixed(2), "erreur médiane par spé x" + Math.exp(med(big)).toFixed(2));
};

log("fenêtres", samples.length, "parties", new Set(samples.map((s) => s.w.runId)).size, "joueurs", new Set(samples.map((s) => s.w.install)).size);
const installs = [...new Set(solo.map((x) => x.run.install))].sort();
const FOLDS = 3;
const base = [], tuned = [];
// Part de chaque sort hors echantillon : un facteur n'est garde que s'il predit mieux la part reelle du sort
const shareErr = {};
const shareOf = (s, cal, k) => { const v = (cal && cal.spells[k]) || 1; let t = 0; for (const [x, y] of Object.entries(s.rows)) t += y * ((cal && cal.spells[x]) || 1); return t > 0 ? (s.rows[k] * v) / t : 0; };
for (let f = 0; f < FOLDS; f++) {
  const test = new Set(installs.filter((_, i) => i % FOLDS === f));
  const cal = fit((i) => !test.has(i));
  for (const sm of samples) {
    if (!test.has(sm.w.install) || !(sm.w.named > 0)) continue;
    for (const k of Object.keys(sm.rows)) {
      const real = (sm.w.real[k] || 0) / sm.w.named;
      if (real <= 0.01 || !cal.spells[k]) continue;
      const e = (shareErr[k] = shareErr[k] || { raw: 0, cal: 0, n: 0 });
      e.raw += Math.abs(Math.log(shareOf(sm, null, k) / real));
      e.cal += Math.abs(Math.log(shareOf(sm, cal, k) / real));
      e.n++;
    }
  }
  const list = solo.filter((x) => x.run.build && test.has(x.run.install));
  base.push(...score(list, null));
  tuned.push(...score(list, cal));
}
report("sans calage (hors éch.)", base);
report("calé (hors éch.)", tuned);
// Correction a posteriori apprise sur les autres joueurs : zone, spe, puis les deux
const loo = (pts, keys) => pts.map((p) => {
  let s = p.s;
  for (const key of keys) {
    const o = pts.filter((q2) => q2.install !== p.install && key(q2) === key(p)).map((q2) => Math.log(q2.real / q2.s));
    if (o.length >= 3) s *= Math.exp(med(o) * o.length / (o.length + SHRINK));
  }
  return Object.assign({}, p, { s });
});
report("calé + zone", loo(tuned, [(p) => p.zone]));
report("calé + spé", loo(tuned, [(p) => p.spec]));
report("calé + zone + spé", loo(loo(tuned, [(p) => p.zone]), [(p) => p.spec]));
const zonesOf = (cal) => {
  const z = {};
  for (const p of score(solo.filter((x) => x.run.build), cal)) (z[p.zone] = z[p.zone] || []).push(Math.log(p.real / p.s));
  for (const k of Object.keys(z)) z[k] = +Math.exp(med(z[k]) * z[k].length / (z[k].length + SHRINK)).toFixed(3);
  return z;
};
const full = fit(() => true);
const kept = Object.keys(full.spells).filter((k) => shareErr[k] && shareErr[k].cal < shareErr[k].raw);
log("facteurs validés par la part hors échantillon", kept.length + "/" + Object.keys(full.spells).length, "écartés :", Object.keys(full.spells).filter((k) => !kept.includes(k)).map((k) => k + " " + full.spells[k]).join(", "));
for (const k of Object.keys(full.spells)) if (!kept.includes(k)) delete full.spells[k];
// Correction par spe apres la zone : DPS affiche et comparaisons entre spes, sans effet sur le choix des sorts d'une spe
const specsOf = (cal, zones) => {
  const sp = {};
  for (const p of score(solo.filter((x) => x.run.build), cal)) (sp[p.spec] = sp[p.spec] || []).push(Math.log(p.real / (p.s * (zones[p.zone] || 1))));
  for (const k of Object.keys(sp)) sp[k] = +Math.exp(med(sp[k]) * sp[k].length / (sp[k].length + SHRINK)).toFixed(3);
  return sp;
};
log("sorts calés", Object.keys(full.spells).length, "talents à procs", Object.keys(full.talents).length);
log(Object.entries(full.spells).sort((a, b) => a[1] - b[1]).map(([k, v]) => k + " " + v + " (" + full.n.spells[k] + ")").join(", "));
log(Object.entries(full.talents).sort((a, b) => b[1] - a[1]).map(([k, v]) => k + " " + v + " (" + full.n.talents[k] + ")").join(", "));
if (WRITE) {
  fs.writeFileSync(path.join(__dirname, "..", "AS-Companion", "web", "simcal.json"), JSON.stringify((() => { const zones = zonesOf(full); return { spells: full.spells, talents: full.talents, zones, specs: specsOf(full, zones) }; })(), null, 1) + "\n");
  log("simcal.json écrit");
}
