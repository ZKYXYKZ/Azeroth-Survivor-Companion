// Modele de survie par minute : risque de mourir selon PV, reduction, soins, difficulte et capacite a tuer.
// Regression logistique, validee en laissant de cote chaque joueur. Usage : node tools/sim-survival.js [--write]
const fs = require("fs");
const path = require("path");
const log = console.log;
console.log = () => {};
process.argv[2] = "1";
const { solo, statAt } = require("./sim-calib.js");
console.log = log;

const web = path.join(__dirname, "..", "AS-Companion", "web");
const G = JSON.parse(fs.readFileSync(path.join(web, "gamedb.json"), "utf8"));
const zoneAvg = (z, m, k) => {
  const e = ((G.zones[z] && G.zones[z].enemies) || []).filter((x) => x.at <= m * 60);
  if (!e.length) return k === "hp" ? 100 : 10;
  const w = e.reduce((a, x) => a + x.weight, 0);
  return e.reduce((a, x) => a + x[k] * x.weight, 0) / w;
};

const NAMES = ["cste", "logPV", "reduc", "logSoin", "logDiff", "logMin", "logTuer", "logMonstre"];
const rows = [];
for (const x of solo) {
  const diff = x.diff > 0 ? x.diff : 1, heroic = x.heroic || 0;
  const end = Math.floor(x.time / 60);
  for (let m = 2; m <= Math.min(end, 24); m++) {
    const t = m * 60;
    const pts = x.samples.filter((s) => s.t > t - 60 && s.t <= t);
    if (pts.length < 2) continue;
    const a = pts[0], b = pts[pts.length - 1];
    const dps = Math.max(1, (b.dealt - a.dealt) / Math.max(1, b.t - a.t));
    const st = statAt(x, t);
    const heal = Math.max(0.1, (st.reg || 0) + (st.heal || 0) * dps);
    const f = [1, Math.log(b.hpm || 100), Math.min(0.7, st.arm || 0), Math.log(heal), Math.log(diff) + heroic * 0.3, Math.log(m), Math.log(dps / (zoneAvg(x.zone, m, "hp") * diff)), Math.log(zoneAvg(x.zone, m, "dmg") * diff)];
    const died = m === end && x.result !== "victory" ? 1 : 0;
    rows.push({ f, y: died, install: x.run.install, run: x.run.runId, win: x.result === "victory" });
  }
}
const mean = NAMES.map((_, j) => rows.reduce((a, r) => a + r.f[j], 0) / rows.length);
const std = NAMES.map((_, j) => Math.sqrt(rows.reduce((a, r) => a + (r.f[j] - mean[j]) ** 2, 0) / rows.length) || 1);
for (const r of rows) r.z = r.f.map((v, j) => (j ? (v - mean[j]) / std[j] : 1));

function fitLog(list, l2 = 0.01, iters = 300, lr = 0.5) {
  const w = new Array(NAMES.length).fill(0);
  for (let it = 0; it < iters; it++) {
    const g = new Array(w.length).fill(0);
    for (const r of list) {
      const p = 1 / (1 + Math.exp(-r.z.reduce((a, v, j) => a + v * w[j], 0)));
      for (let j = 0; j < w.length; j++) g[j] += (p - r.y) * r.z[j];
    }
    for (let j = 0; j < w.length; j++) w[j] -= lr * (g[j] / list.length + (j ? l2 * w[j] : 0));
  }
  return w;
}
const prob = (r, w) => 1 / (1 + Math.exp(-r.z.reduce((a, v, j) => a + v * w[j], 0)));
const auc = (pos, neg) => { let n = 0; for (const a of pos) for (const b of neg) n += a > b ? 1 : a === b ? 0.5 : 0; return n / (pos.length * neg.length); };

const pts = [], runRisk = new Map();
for (const inst of new Set(rows.map((r) => r.install))) {
  const w = fitLog(rows.filter((r) => r.install !== inst));
  for (const r of rows.filter((q) => q.install === inst)) {
    const p = prob(r, w);
    pts.push({ p, y: r.y });
    const e = runRisk.get(r.run) || { s: 1, win: r.win };
    e.s *= 1 - p;
    runRisk.set(r.run, e);
  }
}
log("minutes", rows.length, "morts", rows.filter((r) => r.y).length, "parties", runRisk.size);
log("AUC mort dans la minute", auc(pts.filter((p) => p.y).map((p) => p.p), pts.filter((p) => !p.y).map((p) => p.p)).toFixed(3));
const runs = [...runRisk.values()];
log("AUC victoire par partie", auc(runs.filter((r) => r.win).map((r) => r.s), runs.filter((r) => !r.win).map((r) => r.s)).toFixed(3));
const w = fitLog(rows);
log("poids", NAMES.map((n, j) => n + " " + w[j].toFixed(2)).join("  "));
if (process.argv.includes("--write")) {
  const f = path.join(web, "simcal.json");
  const cal = JSON.parse(fs.readFileSync(f, "utf8"));
  cal.survival = { names: NAMES, w: w.map((v) => +v.toFixed(4)), mean: mean.map((v) => +v.toFixed(4)), std: std.map((v) => +v.toFixed(4)) };
  fs.writeFileSync(f, JSON.stringify(cal, null, 1) + "\n");
  log("simcal.json complété");
}
