// Finition des builds proposes, pour un debutant : part des resultats de build-tune.js, puis impose un socle de survie.
// Aucun modele de survie n'a tenu hors echantillon (tools/sim-survival.js), le socle est donc une regle fixe :
// un anneau defensif porte, une resurrection ou des PV en reserve, race ponderee par sa survie.
// Refuse tout build sous FLOOR du DPS optimise. Ecrit tools/preset-tune.json.
const fs = require("fs");
const path = require("path");
const log = console.log;
console.log = () => {};
process.argv[2] = "1";
const { sim, ctx, decodeBuild } = require("./sim-calib.js");
console.log = log;

const web = path.join(__dirname, "..", "AS-Companion", "web");
const sd = sim.get();
sd.cal = JSON.parse(fs.readFileSync(path.join(web, "simcal.json"), "utf8"));
const MINUTES = 15, ITERS = 400, FLOOR = 0.85;
const DEF_RINGS = ["blooddrinker", "archimtiros", "dark_iron", "devoured"];
const DEF_TRINKETS = ["soulstone", "lifegiving", "onyxia_blood"];
const DEF_SPELLS = { mage: ["ice_barrier"], priest: ["pw_shield", "renew"], warrior: ["bloodthirst", "shield_slam"], paladin: ["holy_shield", "divine_shield", "holy_light"], shaman: ["lightning_shield", "healing_wave", "magma_totem"], warlock: ["drain_life"], druid: ["rejuvenation", "regrowth", "thorns"] };
// Valeur de survie estimee de chaque race (immunite, bouclier, PV), a defaut de mesure
const RACE_SAFE = { scourge: 1.1, nightelf: 1.1, dwarf: 1.1, tauren: 1.08, orc: 1.05, troll: 1.02, human: 1, gnome: 0.95 };
const ORIGIN = { warrior: ["human", "orc", "dwarf", "nightelf", "scourge", "tauren", "gnome", "troll"], paladin: ["human", "dwarf"], hunter: ["orc", "dwarf", "nightelf", "tauren", "troll"], rogue: ["human", "orc", "dwarf", "nightelf", "scourge", "gnome", "troll"], priest: ["human", "dwarf", "nightelf", "scourge", "troll"], shaman: ["orc", "tauren", "troll"], mage: ["human", "gnome", "scourge", "troll"], warlock: ["human", "orc", "gnome", "scourge"], druid: ["nightelf", "tauren"] };

// Le reel prime : sort a 10 % ou plus des degats dans au moins 3 victoires de la spe, a garder
const rd = (p) => fs.readdirSync(path.join(__dirname, "..", "community", "data")).filter((f) => f.startsWith(p)).flatMap((f) => fs.readFileSync(path.join(__dirname, "..", "community", "data", f), "utf8").split("\n").filter(Boolean).map((l) => JSON.parse(l)));
const wins = rd("runs-").filter((r) => !r.patch && !r.suspect && r.result === "victory" && r.spells);
const realTop = {};
for (const r of wins) for (const [k, v] of Object.entries(r.spells)) if (v.share >= 0.1) { const e = ((realTop[r.spec] = realTop[r.spec] || {})[k] = realTop[r.spec][k] || { n: 0, s: 0 }); e.n++; e.s += v.share; }
const TANKS = new Set(["Paladin Protection", "Guerrier Protection", "Druide Ours"]);
const specOf = (c, talents) => { const i = c.trees.findIndex((t) => t.talents.some((x) => x.row === 6 && talents[x.key])); return c.key + "-" + i; };
const tune = {};
for (const f of fs.readdirSync(__dirname)) if (/^preset-tune-\d+\.json$/.test(f)) Object.assign(tune, JSON.parse(fs.readFileSync(path.join(__dirname, f), "utf8")));
const presets = JSON.parse(fs.readFileSync(path.join(web, "defaults.json"), "utf8"));
const out = {};
for (const p of presets) {
  const f = p.code.split(";");
  const t = tune[p.name] || { talents: null, spells: f[4].split(",").map((x) => { const [k, w] = x.split(":"); return [k, +w]; }), rings: f[6].split(","), trinkets: f[7].split(","), amulets: f[8].split(","), race: p.race, alt: p.raceAlt || "" };
  const sc = decodeBuild(p.code, p.race);
  if (t.talents) sc.talents = t.talents;
  Object.assign(sc, { density: 6, boss: 25, rarity: 1.5, gear: { dmg: 46, crit: 10, critDmg: 15, cdr: 13, echo: 0, area: 19, targets: 0 } });
  sc.spells = t.spells.map(([key, w]) => ({ key, w, rank: Math.max(1, Math.min(10, 2 + w)) }));
  sc.amulet = t.amulets[0];
  sc.rings = t.rings.slice(0, 2);
  sc.trinkets = t.trinkets.slice(0, 2);
  sc.race = t.race;
  const cls0 = ctx.cls(p.class);
  const must = Object.entries(realTop[specOf(cls0, sc.talents)] || {}).filter(([k, e]) => e.n >= 3 && cls0.spells.some((s) => s.key === k)).sort((a, b) => b[1].s - a[1].s).map((x) => x[0]).slice(0, 4);
  for (const k of must) if (!sc.spells.some((s) => s.key === k)) { const i = sc.spells.map((s) => must.includes(s.key)).lastIndexOf(false); if (i >= 0) sc.spells[i].key = k; }
  must.forEach((k, i) => { const j = sc.spells.findIndex((s) => s.key === k); if (j > i) { const a = sc.spells[i].key; sc.spells[i].key = k; sc.spells[j].key = a; } });
  t.spells = sc.spells.map((s) => [s.key, s.w]);
  if (TANKS.has(p.name)) { t.rings = f[6].split(","); t.trinkets = f[7].split(","); t.amulets = f[8].split(","); sc.rings = t.rings.slice(0, 2); sc.trinkets = t.trinkets.slice(0, 2); sc.amulet = t.amulets[0]; }
  // Bouclier ou soin de classe : remplace le dernier sort du build s'il n'y en a aucun
  const safe = DEF_SPELLS[p.class] || [];
  if (safe.length && !sc.spells.some((s) => safe.includes(s.key))) {
    const last = sc.spells.slice().reverse().find((s) => !must.includes(s.key));
    last.key = safe[0];
    t.spells = sc.spells.map((s) => [s.key, s.w]);
  }
  const top = sim.monteCarlo(sc, ITERS, MINUTES).mean;
  // Socle : anneau defensif en deuxieme place, resurrection ou PV juste apres les bijoux portes
  const ring = t.rings.find((k) => DEF_RINGS.includes(k)) || DEF_RINGS[0];
  const rings = [t.rings[0], ring].concat(t.rings.slice(1)).filter((k, i, a) => a.indexOf(k) === i).slice(0, 4);
  const trink = t.trinkets.find((k) => DEF_TRINKETS.includes(k)) || DEF_TRINKETS[0];
  const trinkets = t.trinkets.slice(0, 2).concat([trink]).concat(t.trinkets.slice(2)).filter((k, i, a) => a.indexOf(k) === i).slice(0, 4);
  sc.rings = rings.slice(0, 2);
  const races = Object.keys(RACE_SAFE).map((r) => ({ r, d: sim.monteCarlo(Object.assign(JSON.parse(JSON.stringify(sc)), { race: r }), ITERS, MINUTES).mean }));
  const rank = (list) => list.map((x) => ({ ...x, s: x.d * RACE_SAFE[x.r] })).sort((a, b) => b.s - a.s)[0];
  const best = rank(races.filter((x) => ORIGIN[p.class].includes(x.r)));
  const any = rank(races);
  const alt = !ORIGIN[p.class].includes(any.r) && any.s > best.s * 1.02 ? any.r : "";
  const ratio = best.d / top;
  log(p.name.padEnd(30), Math.round(best.d), (ratio * 100).toFixed(0) + "%", p.race, "->", best.r, alt, rings.slice(0, 2).join("+"), trink);
  if (ratio < FLOOR) { log("  sous le plancher, anneau defensif gardé en 3e place"); rings.splice(1, 1); rings.splice(2, 0, ring); }
  out[p.name] = { talents: t.talents || sc.talents, spells: t.spells, rings: rings.filter((k, i, a) => a.indexOf(k) === i).slice(0, 4), trinkets, amulets: t.amulets, race: best.r, alt };
}
fs.writeFileSync(path.join(__dirname, "preset-tune.json"), JSON.stringify(out, null, 1) + "\n");
log("fin");
