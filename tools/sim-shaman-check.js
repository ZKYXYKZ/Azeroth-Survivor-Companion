// Compare les builds Chaman du site communautaire via le moteur de simulation (DPS seul, pas de survie).
// Usage: node tools/sim-shaman-check.js
const fs = require("fs");
const path = require("path");
const vm = require("vm");

const root = path.join(__dirname, "..");
const web = path.join(root, "AS-Companion", "web");
const json = (f) => JSON.parse(fs.readFileSync(path.join(web, f), "utf8"));
const DATA = json("data.json");
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

const BUILDS = [
  ["AVANT - Chaman Totems", "SB1;shaman;Chaman Totems;5503113200000/0000000000000/0551135014321;magma_totem:5,searing_totem:5,fire_nova:4,flame_shock:3,chain_lightning:3,lightning_bolt:2;earth_shock,frost_shock,lightning_shield;accuria,spell_power,quick_strike,blooddrinker;chosen,earthstrike,tep,lifegiving;leg:magma_totem,leg:searing_totem,fire_lord,malice_stone;50,0,1,3,20,2,1"],
  ["APRES - Chaman Totems", "SB1;shaman;Chaman Totems;5503113200000/0000000000000/0551135014231;magma_totem:5,searing_totem:5,fire_nova:4,flame_shock:3,chain_lightning:3,lightning_bolt:2;earth_shock,frost_shock,lightning_shield;accuria,spell_power,quick_strike,blooddrinker;chosen,earthstrike,tep,lifegiving;leg:magma_totem,leg:searing_totem,fire_lord,malice_stone;50,0,1,3,20,2,1"],
  ["AVANT - Chaman Elementaire", "SB1;shaman;Chaman Elementaire;5500145015131/5005142300000/0000000000000;chain_lightning:5,lightning_bolt:5,earth_shock:3,frost_shock:3,flame_shock:3,searing_totem:2;call_of_flame,healing_wave,lightning_shield;accuria,dragonslayer,quick_strike,spell_power;chosen,blackhand,earthstrike,hoj;leg:chain_lightning,leg:lightning_bolt,onyxia_tooth,malice_stone;50,0,1,3,20,2,1"],
  ["APRES - Chaman Elementaire", "SB1;shaman;Chaman Elementaire;5500145015131/5305112300000/0000000000000;chain_lightning:5,lightning_bolt:5,earth_shock:3,frost_shock:3,flame_shock:3,searing_totem:2;call_of_flame,healing_wave,lightning_shield;accuria,dragonslayer,quick_strike,spell_power;chosen,blackhand,earthstrike,hoj;leg:chain_lightning,leg:lightning_bolt,onyxia_tooth,malice_stone;50,0,1,3,20,2,1"],
  ["AVANT - Chaman Amelioration", "SB1;shaman;Chaman Amelioration;5105135000000/5530105213321/0000000000000;lightning_bolt:5,earth_shock:4,frost_shock:4,chain_lightning:4,flame_shock:3,searing_totem:3;call_of_flame,fire_nova,healing_wave;accuria,dragonslayer,quick_strike,blooddrinker;chosen,earthstrike,hoj,blackhand;leg:lightning_bolt,leg:earth_shock,malice_stone,onyxia_tooth;50,0,1,3,20,2,1"],
  ["APRES - Chaman Amelioration", "SB1;shaman;Chaman Amelioration;5530115000000/5005153213321/0000000000000;lightning_bolt:5,earth_shock:4,frost_shock:4,chain_lightning:4,flame_shock:3,searing_totem:3;call_of_flame,fire_nova,healing_wave;accuria,dragonslayer,quick_strike,blooddrinker;chosen,earthstrike,hoj,blackhand;leg:lightning_bolt,leg:earth_shock,malice_stone,onyxia_tooth;50,0,1,3,20,2,1"],
  ["REF Affliction Warlock", "SB1;warlock;Affliction Warlock;5532101513131/00000000000000/5501130500000;corruption:5,curse_of_agony:5,shadow_bolt:4,drain_life:3,immolate:3,death_coil:2;demonic_empowerment,fear,hellfire;seal_damned,accuria,quick_strike,dragonslayer;chosen,earthstrike,hoj,tep;leg:corruption,leg:curse_of_agony,fire_lord,eye_of_hakkar;50,0,1,3,20,2,1"],
];

const ITERS = 300;
const MINUTES = 15;
const fmt = (v) => (v >= 1e6 ? (v / 1e6).toFixed(2) + "M" : v >= 1000 ? (v / 1000).toFixed(1) + "k" : v.toFixed(0));

console.log(`Simulation Monte-Carlo (${ITERS} iterations, ${MINUTES} minutes, race gnome, sans recrudescence de deces)`);
console.log("");
for (const [label, code] of BUILDS) {
  const sc = decodeBuild(code, "gnome");
  if (!sc) { console.log(label, "DECODAGE ECHOUE"); continue; }
  const mc = sim.monteCarlo(sc, ITERS, MINUTES);
  console.log(`== ${label} (${sc.class}) ==`);
  console.log(`  DPS moyen=${fmt(mc.mean)}  p10=${fmt(mc.p10)}  p50=${fmt(mc.p50)}  p90=${fmt(mc.p90)}  niveau moyen=${mc.level.toFixed(1)}`);
  console.log(`  Courbe DPS/minute: ${mc.curve.map((v, i) => `${i + 1}m=${fmt(v)}`).join("  ")}`);
  console.log(`  Repartition degats par sort: ${mc.spells.filter(s => s.share > 0.01).map(s => `${s.key}=${(s.share * 100).toFixed(0)}%`).join(", ")}`);
  console.log("");
}
