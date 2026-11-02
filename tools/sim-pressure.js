// Course entre PV qui apparaissent et degats du joueur (formules de web/enemies.json), comparee aux degats recus reels.
// Chaque minute : monstres vivants = file d'attente nourrie par le budget d'apparition, videe par le DPS reel.
// Usage : node tools/sim-pressure.js
const fs = require("fs");
const path = require("path");
const log = console.log;
console.log = () => {};
process.argv[2] = "1";
const { solo, statAt, med } = require("./sim-calib.js");
console.log = log;
const E = JSON.parse(fs.readFileSync(path.join(__dirname, "..", "AS-Companion", "web", "enemies.json"), "utf8"));

const hpAt = (z, t) => (1 + 0.1 * t + 0.036 * t * t + 0.00704 * t ** 3) * 4.95 * z.diff * (1 + (z.growth || 0) * Math.min(1, t / 20) ** 2);
const dmgAt = (z, t) => (1 + 0.07 * t + 0.015 * t * t + 0.0002 * t ** 3) * 1.25 * Math.sqrt(z.diff);
const budget = (t) => 0.6 * (0.9 + 0.32 * t + 0.025 * t * t);
function zoneMix(z, t) {
  const m = (z.mobs || z.enemies || []).filter((x) => (x.at || 0) <= t * 60 && !x.elite);
  if (!m.length) return null;
  const w = m.reduce((a, x) => a + (x.weight || 1), 0);
  const avg = (k) => m.reduce((a, x) => a + (x[k] || 0) * (x.weight || 1), 0) / w;
  return { hp: avg("hp"), dmg: avg("dmg"), cost: avg("cost") || 1 };
}

const pts = [];
for (const x of solo) {
  const z = E.zones[x.zone];
  if (!z) continue;
  let alive = 0;
  for (let m = 1; m <= Math.min(20, Math.floor(x.time / 60)); m++) {
    const s = x.samples.filter((p) => p.t > (m - 1) * 60 && p.t <= m * 60);
    if (s.length < 2) continue;
    const a = s[0], b = s[s.length - 1], dt = b.t - a.t;
    const dps = (b.dealt - a.dealt) / dt, taken = (b.taken - a.taken) / dt;
    const mix = zoneMix(z, m - 0.5);
    if (!mix || !(dps > 0)) continue;
    const hp = mix.hp * hpAt(z, m - 0.5), spawn = Math.min(3, Math.max(1, dps / (hp * budget(m) / mix.cost))) * budget(m) / mix.cost;
    // File : arrivees spawn/s, sorties dps/hp par seconde, plafond 50 vivants
    alive = Math.max(Math.min(36, 4 + 1.6 * m) * 0.2, Math.min(50, alive + (spawn - dps / hp) * 60));
    const arm = Math.min(0.7, statAt(x, b.t).arm || 0);
    const pred = alive * mix.dmg * dmgAt(z, m - 0.5) * (1 - arm);
    if (taken >= 0) pts.push({ pred, taken, m, install: x.run.install, hp: b.hpm });
  }
}
const spearman = (p) => {
  const rank = (i) => { const o = p.map((q, j) => [q[i], j]).sort((a, b) => a[0] - b[0]), r = []; o.forEach(([, j], k) => (r[j] = k)); return r; };
  const a = rank(0), b = rank(1), n = p.length, ma = (n - 1) / 2;
  let num = 0, da = 0, db = 0;
  for (let i = 0; i < n; i++) { num += (a[i] - ma) * (b[i] - ma); da += (a[i] - ma) ** 2; db += (b[i] - ma) ** 2; }
  return num / Math.sqrt(da * db);
};
log("minutes", pts.length, "Spearman predit/reel toutes minutes", spearman(pts.map((p) => [p.pred, p.taken])).toFixed(2));
for (const mm of [3, 6, 10, 15]) { const q = pts.filter((p) => p.m === mm); if (q.length > 10) log(mm + " min n=" + q.length, "Spearman", spearman(q.map((p) => [p.pred, p.taken])).toFixed(2), "ratio median reel/predit", med(q.filter((p) => p.pred > 0).map((p) => p.taken / p.pred)).toFixed(3)); }
// Reference naive : dégats recus expliques par la seule minute
log("reference minute seule", spearman(pts.map((p) => [p.m, p.taken])).toFixed(2));
