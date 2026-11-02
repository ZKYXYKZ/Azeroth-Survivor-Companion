// Optimise les builds proposes sur le simulateur cale, en plusieurs passes : talents (simulate, deterministe), puis sorts,
// amulette, anneaux et bijoux (Monte-Carlo). Le simulateur ne mesure pas la survie : les talents defensifs ne perdent aucun
// point et l'apogee ne change pas. Chaque resultat est confirme sur CONFIRM parties.
// Usage : node tools/build-tune.js [passes] [--shard i/n], ecrit tools/preset-tune[-i].json, lu par gen-presets.js.
const fs = require("fs");
const path = require("path");

const PASSES = +process.argv[2] || 2;
const sh = process.argv.indexOf("--shard");
const [SI, SN] = sh > 0 ? process.argv[sh + 1].split("/").map(Number) : [0, 1];
const log = console.log;
console.log = () => {};
process.argv[2] = "1";
const { sim, ctx, decodeBuild } = require("./sim-calib.js");
console.log = log;

const web = path.join(__dirname, "..", "AS-Companion", "web");
const sd = sim.get();
sd.cal = JSON.parse(fs.readFileSync(path.join(web, "simcal.json"), "utf8"));
const DATA = ctx.DATA;
const MINUTES = 18, SCREEN = 60, CONFIRM = 300, MIN_MC = 0.03;
const HAND = new Set(["Chaman Amélioration"]); // fait main d'après les parties réelles, procs et survie inconnus du simulateur
const NOSIM = /pickup|experience|gold|movement speed|buffs are/i; // effets absents du simulateur, gain de pur hasard
const DEF = /damage taken|less damage|damage reduction|maximum health|max health|health per second|would kill|heals? |shield|return to life/i;
const EXCL = [["soul_devourer", "soul_link"], ["pact_of_the_annihilan", "butcher"], ["leader_of_pack", "cat_form"], ["legion_gate", "demonic_supremacy"]];
const clone = (x) => JSON.parse(JSON.stringify(x));
const mc = (sc, n) => sim.monteCarlo(sc, n, MINUTES).mean;

function validTalents(c, tal) {
  let total = 0;
  for (const tree of c.trees) for (const t of tree.talents) {
    const r = tal[t.key] || 0;
    if (r > t.max) return false;
    total += r;
    if (!r) continue;
    const below = tree.talents.filter((o) => o.row < t.row).reduce((a, o) => a + (tal[o.key] || 0), 0);
    if (below < t.row * 5) return false;
    if (t.req && !tal[t.req]) return false;
  }
  if (total !== 51) return false;
  return !EXCL.some(([a, b]) => tal[a] && tal[b]);
}

function tuneTalents(base, c) {
  const all = c.trees.flatMap((t) => t.talents);
  const locked = new Set(all.filter((t) => t.row === 6 || DEF.test(t.desc.en || "")).map((t) => t.key));
  const state = clone(base);
  state.level = 40;
  const score = (tal) => { state.talents = tal; return sim.simulate(state).total; };
  let cur = clone(base.talents), best = score(cur);
  for (let step = 0; step < 40; step++) {
    let top = null, topS = best * 1.002;
    for (const a of all) {
      if (!cur[a.key] || locked.has(a.key)) continue;
      for (const b of all) {
        if (a === b || b.row === 6 || (cur[b.key] || 0) >= b.max) continue;
        const t = Object.assign({}, cur);
        if (--t[a.key] === 0) delete t[a.key];
        t[b.key] = (t[b.key] || 0) + 1;
        if (!validTalents(c, t)) continue;
        const s = score(t);
        if (s > topS) { topS = s; top = t; }
      }
    }
    if (!top) break;
    cur = top; best = topS;
  }
  return cur;
}

function tuneSpells(base, c) {
  let cur = clone(base), curD = mc(cur, SCREEN * 2);
  const dealt = (k) => { const b = sd.spells[k]; return b && !["defense", "buff"].includes(b.kind); };
  base.spells.forEach((_, i) => {
    const s = cur.spells[i];
    if (!dealt(s.key)) return;
    for (const n of c.spells) {
      if (cur.spells.some((x) => x.key === n.key) || !dealt(n.key)) continue;
      if (n.key === "rockbiter" && !cur.talents.rockbiter_initiation) continue;
      const t = clone(cur);
      t.spells[i] = { key: n.key, w: s.w, rank: s.rank };
      const d = mc(t, SCREEN);
      if (d > curD * 1.05) { const d2 = mc(t, SCREEN * 2); if (d2 > curD * 1.03) { cur = t; curD = d2; } }
    }
  });
  // Poids : le sort qui fait le plus de degats passe devant
  const share = {};
  for (const x of sim.monteCarlo(cur, SCREEN, MINUTES).spells) share[x.key] = x.share;
  const ws = cur.spells.map((s) => s.w).sort((a, b) => b - a);
  const order = cur.spells.slice().sort((a, b) => (share[b.key] || 0) - (share[a.key] || 0));
  order.forEach((s, i) => (s.w = ws[i]));
  cur.spells = order;
  return cur;
}

function tuneJewels(base, c, keepRing, keepTrinket) {
  const cur = clone(base);
  const legs = cur.spells.filter((s) => DATA.legendaries[s.key]).map((s) => "leg:" + s.key);
  const amu = legs.concat(DATA.amulets.map((j) => j.key)).map((a) => { const t = clone(cur); t.amulet = a; return [a, mc(t, SCREEN)]; }).sort((a, b) => b[1] - a[1]);
  cur.amulet = amu[0][0];
  cur.amuletsList = amu.slice(0, 4).map((x) => x[0]);
  const pick = (cat, list, keep) => {
    const scored = list.map((j) => { const t = clone(cur); t[cat] = [j.key]; return [j.key, mc(t, SCREEN)]; }).sort((a, b) => b[1] - a[1]).map((x) => x[0]);
    const top = keep.filter((k) => list.some((j) => j.key === k)).concat(scored).filter((k, i, a) => a.indexOf(k) === i);
    cur[cat] = scored.slice(0, 2);
    cur[cat + "List"] = scored.slice(0, 4 - keep.length).concat(keep).concat(top).filter((k, i, a) => a.indexOf(k) === i).slice(0, 4);
  };
  const sim = (j) => !j.desc.en.every((l) => NOSIM.test(l));
  pick("rings", DATA.rings.filter(sim), keepRing);
  pick("trinkets", DATA.trinkets.filter(sim), keepTrinket);
  return cur;
}

// Race la plus forte : la chance du gnome ne gagne que si elle bat nettement les autres
const ORIGIN = { warrior: ["human", "orc", "dwarf", "nightelf", "scourge", "tauren", "gnome", "troll"], paladin: ["human", "dwarf"], hunter: ["orc", "dwarf", "nightelf", "tauren", "troll"], rogue: ["human", "orc", "dwarf", "nightelf", "scourge", "gnome", "troll"], priest: ["human", "dwarf", "nightelf", "scourge", "troll"], shaman: ["orc", "tauren", "troll"], mage: ["human", "gnome", "scourge", "troll"], warlock: ["human", "orc", "gnome", "scourge"], druid: ["nightelf", "tauren"] };
const LUCK_MARGIN = 1.05;
function chooseRace(sc) {
  const all = Object.keys(ORIGIN).reduce((a, k) => a.concat(ORIGIN[k]), []).filter((r, i, a) => a.indexOf(r) === i);
  const d = {};
  for (const r of all) d[r] = mc(Object.assign(clone(sc), { race: r }), CONFIRM);
  const best = (list) => {
    const others = list.filter((r) => r !== "gnome").sort((a, b) => d[b] - d[a]);
    return !others.length || (list.includes("gnome") && d.gnome > d[others[0]] * LUCK_MARGIN) ? "gnome" : others[0];
  };
  const race = best(ORIGIN[sc.class]), top = best(all);
  return { race, alt: !ORIGIN[sc.class].includes(top) && d[top] > d[race] * 1.02 ? top : "", d };
}

const presets = JSON.parse(fs.readFileSync(path.join(web, "defaults.json"), "utf8"));
const out = {};
presets.forEach((p, idx) => {
  if (idx % SN !== SI || HAND.has(p.name)) return;
  const f = p.code.split(";");
  const c = ctx.cls(p.class);
  const base = decodeBuild(p.code, p.race);
  Object.assign(base, { density: 6, boss: 25, rarity: 1.5, gear: { dmg: 46, crit: 10, critDmg: 15, cdr: 13, echo: 0, area: 19, targets: 0 } });
  base.spells.forEach((s) => (s.rank = Math.max(1, Math.min(10, 2 + s.w))));
  base.rings = f[6].split(",").slice(0, 2);
  base.trinkets = f[7].split(",").slice(0, 2);
  const start = mc(base, CONFIRM);
  const keepR = f[6].split(",").filter((k) => k === "blooddrinker"), keepT = f[7].split(",").filter((k) => ["lifegiving", "soulstone"].includes(k));
  let cur = base, races = null;
  for (let pass = 0; pass < PASSES; pass++) {
    cur.talents = tuneTalents(cur, c);
    cur = tuneSpells(cur, c);
    cur = tuneJewels(cur, c, keepR, keepT);
    races = chooseRace(cur);
    cur.race = races.race;
  }
  const end = mc(cur, CONFIRM);
  const gain = end / start - 1;
  log(p.name.padEnd(30), Math.round(start), "->", Math.round(end), "+" + Math.round(gain * 100) + "%", p.race, "->", races.race, races.alt);
  if (gain >= MIN_MC) out[p.name] = { gain: +gain.toFixed(3), race: races.race, alt: races.alt, talents: cur.talents, spells: cur.spells.map((s) => [s.key, s.w]), rings: cur.ringsList, trinkets: cur.trinketsList, amulets: cur.amuletsList };
});
fs.writeFileSync(path.join(__dirname, SN > 1 ? "preset-tune-" + SI + ".json" : "preset-tune.json"), JSON.stringify(out, null, 1) + "\n");
log("fin", Object.keys(out).length);
