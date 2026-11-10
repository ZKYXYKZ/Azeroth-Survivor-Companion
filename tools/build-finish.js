// Finition des builds proposes. Objectif : le plus de degats, avec un minimum de survie pour un debutant.
// Bijoux et amulette choisis au simulateur (Monte-Carlo) parmi tout le catalogue, sauf les objets de pure survie ;
// le vol de vie reste en reserve apres les deux bijoux portes. Bouclier de classe garde, sorts forts des vraies
// victoires gardes, race ponderee legerement par sa survie. Part des builds deja proposes (defaults.json).
// Usage : node tools/build-finish.js [--shard i/n] ; sans shard, fusionne aussi les morceaux dans tools/preset-tune.json.
const ARGV = process.argv.slice();
const fs = require("fs");
const path = require("path");
const log = console.log;
console.log = () => {};
const sh = process.argv.indexOf("--shard");
const [SI, SN] = sh > 0 ? process.argv[sh + 1].split("/").map(Number) : [0, 1];
process.argv[2] = "1";
const { sim, ctx, decodeBuild } = require("./sim-calib.js");
console.log = log;

const web = path.join(__dirname, "..", "AS-Companion", "web");
const sd = sim.get();
sd.cal = JSON.parse(fs.readFileSync(path.join(web, "simcal.json"), "utf8"));
const DATA = ctx.DATA;
const MINUTES = 15, SCREEN = 150, ITERS = 400;
const SURVIE = new Set(["animated_chain", "woven_ivy", "fallen_dragon", "steadfast_might", "jeklik", "soulstone", "lifegiving", "onyxia_blood", "star_of_mystaria", "dark_iron", "devoured", "archimtiros"]);
const DEF_SPELLS = { mage: ["ice_barrier"], priest: ["pw_shield"], paladin: ["holy_shield", "divine_shield"], shaman: ["lightning_shield"] };
const RACE_SAFE = { scourge: 1.04, nightelf: 1.04, dwarf: 1.04, tauren: 1.03, orc: 1.02, troll: 1.01, human: 1, gnome: 0.97 };
const ORIGIN = { warrior: ["human", "orc", "dwarf", "nightelf", "scourge", "tauren", "gnome", "troll"], paladin: ["human", "dwarf"], hunter: ["orc", "dwarf", "nightelf", "tauren", "troll"], rogue: ["human", "orc", "dwarf", "nightelf", "scourge", "gnome", "troll"], priest: ["human", "dwarf", "nightelf", "scourge", "troll"], shaman: ["orc", "tauren", "troll"], mage: ["human", "gnome", "scourge", "troll"], warlock: ["human", "orc", "gnome", "scourge"], druid: ["nightelf", "tauren"] };
const rd = (p) => fs.readdirSync(path.join(__dirname, "..", "community", "data")).filter((f) => f.startsWith(p)).flatMap((f) => fs.readFileSync(path.join(__dirname, "..", "community", "data", f), "utf8").split("\n").filter(Boolean).map((l) => JSON.parse(l)));
const realTop = {};
for (const r of rd("runs-").filter((x) => !x.patch && !x.suspect && x.result === "victory" && x.spells))
  for (const [k, v] of Object.entries(r.spells)) if (v.share >= 0.1 && ctx.DATA.classes.some((c) => c.key === r.class && c.spells.some((x) => x.key === k))) { const e = ((realTop[r.spec] = realTop[r.spec] || {})[k] = realTop[r.spec][k] || { n: 0, s: 0 }); e.n++; e.s += v.share; }
// Identite de la spe : ses deux sorts signatures d'avant l'optimisation (v1.7.61) restent en tete
const IDENT = Object.fromEntries(JSON.parse(require("child_process").execSync("git show v1.7.61:AS-Companion/web/defaults.json", { cwd: __dirname, maxBuffer: 1e8 }).toString()).map((p) => [p.name, p.code.split(";")[4].split(",").slice(0, 2).map((x) => x.split(":")[0]).filter((k) => ctx.DATA.classes.some((c) => c.key === p.class && c.spells.some((x) => x.key === k)))]));
// --only <classe> --free : une seule classe, sans sorts signatures imposes (Chaman : le simulateur decide), --out <fichier>
const arg = (k) => { const i = ARGV.indexOf(k); return i > 0 ? ARGV[i + 1] : null; };
const ONLY = arg("--only"), FREE = ARGV.includes("--free"), OUT = arg("--out");
if (FREE) for (const k of Object.keys(IDENT)) delete IDENT[k];
const clone = (x) => JSON.parse(JSON.stringify(x));
const mc = (sc, n) => sim.monteCarlo(sc, n, MINUTES).mean;

const presets = JSON.parse(fs.readFileSync(path.join(web, "defaults.json"), "utf8"));
const out = {};
presets.forEach((p, idx) => {
  if (idx % SN !== SI || (ONLY && p.class !== ONLY)) return;
  const f = p.code.split(";");
  const c = ctx.cls(p.class);
  const sc = decodeBuild(p.code, p.race);
  Object.assign(sc, { density: 6, boss: 25, rarity: 1.5, gear: { dmg: 46, crit: 10, critDmg: 15, cdr: 13, echo: 0, area: 19, targets: 0 } });
  sc.spells = f[4].split(",").map((x) => { const [key, w] = x.split(":"); return { key, w: +w, rank: Math.min(10, 2 + +w) }; });
  const spec = c.key + "-" + c.trees.findIndex((t) => t.talents.some((x) => x.row === 6 && sc.talents[x.key]));
  const must = Object.entries(realTop[spec] || {}).filter(([k, e]) => e.n >= 3 && c.spells.some((s) => s.key === k)).sort((a, b) => b[1].s - a[1].s).map((x) => x[0]).slice(0, 4);
  for (const k of must) if (!sc.spells.some((s) => s.key === k)) { const i = sc.spells.map((s) => must.includes(s.key)).lastIndexOf(false); if (i >= 0) sc.spells[i].key = k; }
  (IDENT[p.name] || []).forEach((k, i) => { const j = sc.spells.findIndex((s) => s.key === k); if (j === i) return; if (j > i) { const a = sc.spells[i].key; sc.spells[i].key = k; sc.spells[j].key = a; } else sc.spells[i].key = k; });
  must.push(...(IDENT[p.name] || []));
  const safe = DEF_SPELLS[p.class] || [];
  if (safe.length && !sc.spells.some((s) => safe.includes(s.key))) { const last = sc.spells.slice().reverse().find((s) => !must.includes(s.key)); last.key = safe[0]; }
  const rank = (cat, list) => list.filter((j) => !SURVIE.has(j)).map((j) => { const t = clone(sc); if (cat === "amulet") t.amulet = j; else t[cat] = [j]; return [j, mc(t, SCREEN)]; }).sort((a, b) => b[1] - a[1]).map((x) => x[0]);
  const legs = sc.spells.filter((s) => DATA.legendaries[s.key] && DATA.legendaries[s.key].lines.en.length).map((s) => "leg:" + s.key);
  const amulets = rank("amulet", legs.concat(DATA.amulets.map((j) => j.key))).slice(0, 4);
  // Regle de joueur (02/11) : la premiere amulette est une legendaire d'un des 3 sorts principaux
  const main = (k) => k.startsWith("leg:") && sc.spells.slice(0, 3).some((x) => "leg:" + x.key === k);
  const lead = amulets.find(main) || legs.find(main);
  if (lead) amulets.splice(0, amulets.length, ...[lead].concat(amulets.filter((k) => k !== lead)).slice(0, 4));
  sc.amulet = amulets[0];
  const ringsR = rank("rings", DATA.rings.map((j) => j.key));
  sc.rings = ringsR.slice(0, 2);
  const trinkR = rank("trinkets", DATA.trinkets.map((j) => j.key));
  sc.trinkets = trinkR.slice(0, 2);
  const rings = ringsR.slice(0, 2).concat(["blooddrinker"], ringsR.slice(2)).filter((k, i, a) => a.indexOf(k) === i).slice(0, 4);
  const races = Object.keys(RACE_SAFE).map((r) => ({ r, d: mc(Object.assign(clone(sc), { race: r }), ITERS) }));
  const pick = (list) => list.map((x) => ({ ...x, s: x.d * RACE_SAFE[x.r] })).sort((a, b) => b.s - a.s)[0];
  const best = pick(races.filter((x) => ORIGIN[p.class].includes(x.r))), any = pick(races);
  const alt = !ORIGIN[p.class].includes(any.r) && any.s > best.s * 1.02 ? any.r : "";
  log(p.name.padEnd(28), Math.round(best.d), best.r, alt, amulets[0], sc.rings.join("+"), sc.trinkets.join("+"));
  out[p.name] = { talents: sc.talents, spells: sc.spells.map((s) => [s.key, s.w]), rings, trinkets: trinkR.slice(0, 4), amulets, race: best.r, alt };
});
if (OUT) { fs.writeFileSync(OUT, JSON.stringify(out, null, 1) + "\n"); process.exit(0); }
fs.writeFileSync(path.join(__dirname, SN > 1 ? "finish-" + SI + ".json" : "preset-tune.json"), JSON.stringify(out, null, 1) + "\n");
if (SN > 1 && fs.readdirSync(__dirname).filter((x) => /^finish-\d+\.json$/.test(x)).length === SN) {
  const all = {};
  for (let i = 0; i < SN; i++) Object.assign(all, JSON.parse(fs.readFileSync(path.join(__dirname, "finish-" + i + ".json"), "utf8")));
  fs.writeFileSync(path.join(__dirname, "preset-tune.json"), JSON.stringify(all, null, 1) + "\n");
  for (let i = 0; i < SN; i++) fs.unlinkSync(path.join(__dirname, "finish-" + i + ".json"));
  log("fusion", Object.keys(all).length);
}
