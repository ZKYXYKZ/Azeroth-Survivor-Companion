const SIM_STR = {
  fr: {
    title: "Simulateur", experimental: "Expérimental : les parties simulées sont calées sur les parties partagées, mais un build précis peut s'écarter du réel d'un facteur 2 ou plus. L'équipement de départ est la médiane des joueurs, à remplacer par le vôtre.", intro: "Dégâts théoriques d'un build : sorts et rangs, talents, bijoux, race et densité d'ennemis. Les chiffres viennent des cartes du jeu ; les effets marqués « non simulé » ne sont pas comptés.",
    build: "Build", fromBuild: "Charger depuis", race: "Race", level: "Rangs des sorts", rarity: "Rareté moyenne des cartes", density: "Ennemis à moins de 10 m", boss: "Temps sur les boss",
    spells: "Sorts", rank: "Rang", jewels: "Bijoux", rings: "Anneaux", trinkets: "Bijoux", amulet: "Amulette", none: "Aucun",
    total: "DPS total", pack: "En meute", single: "Sur un boss", share: "Part", perCast: "par lancer", every: "toutes les {v} s",
    noData: "pas encore de données pour ce sort", estCd: "recharge estimée", notSim: "Non simulé", compare: "Comparer avec un second build", copyA: "Copier le build A",
    optimize: "Suggestions", optimizeHelp: "Gain de DPS si l'on remplace un élément, à rangs égaux.", replace: "Remplacer {a} par {b}", stats: "Statistiques du build",
    dmg: "Dégâts", cdr: "Recharges", crit: "Critique", critDmg: "Dégâts critiques", echo: "Échos", luck: "Chance", targets: "Cibles en plus", area: "Zone",
    rarities: ["Commun", "Inhabituel", "Rare", "Épique", "Légendaire"], toBuild: "Créer le build", mcTitle: "Parties simulées", runs: "parties", simulate: "Simuler", running: "Simulation…", mcHelp: "Rejoue des parties complètes : montées de niveau, cartes tirées selon la chance, choix du compagnon, coffres.", mcMean: "DPS moyen sur la partie", mcRange: "Pire 10 % / meilleur 10 %", mcLevel: "Niveau final moyen", mcDist: "répartition des parties", mcHave: "Obtenu", mcRank: "Rang moyen", mcWin: "Le build B fait mieux que le A dans {v} % des parties.", mcDone: "{n} parties simulées en {ms} ms.", procs: "Effets déclenchés", killsRun: "Kills sur 20 min", zone: "Zone", zoneAny: "Toutes", gear: "Équipement et collection", gearSet: "Stuff complet", gearManual: "Saisie libre", gearStars: "Étoiles", gearPieces: "Pièces portées", gearHint: "Remplit les chiffres avec le stuff du jeu (8 pièces, armes, bonus de set), sans la collection", group: "Groupe (coop)", noAlly: "Pas d'allié", allyShout: "Cri de guerre d'un guerrier : +{v} % de dégâts en moyenne", allyMark: "Marque du chasseur : la cible subit +{v} % de dégâts", pets: "Familiers et démons", kills: "Explosions à la mort", procs: "Effets déclenchés", procNote: "dont {v} lancers gratuits par seconde", amuletUps: "amulette améliorée {v} fois", amuletNoUp: "amulette sans amélioration",
  },
  en: {
    title: "Simulator", experimental: "Experimental: simulated runs are calibrated on shared runs, but a given build can differ from reality by a factor of 2 or more. Starting gear is the players' median, replace it with yours.", intro: "Theoretical damage of a build: spells and ranks, talents, jewelry, race and enemy density. Numbers come from the game's cards; effects marked \"not simulated\" are left out.",
    build: "Build", fromBuild: "Load from", race: "Race", level: "Spell ranks", rarity: "Average card rarity", density: "Enemies within 10 yd", boss: "Time on bosses",
    spells: "Spells", rank: "Rank", jewels: "Jewelry", rings: "Rings", trinkets: "Trinkets", amulet: "Amulet", none: "None",
    total: "Total DPS", pack: "In a pack", single: "On a boss", share: "Share", perCast: "per cast", every: "every {v} sec",
    noData: "no data yet for this spell", estCd: "estimated cooldown", notSim: "Not simulated", compare: "Compare with a second build", copyA: "Copy build A",
    optimize: "Suggestions", optimizeHelp: "DPS gain from swapping one element, at equal ranks.", replace: "Replace {a} with {b}", stats: "Build stats",
    dmg: "Damage", cdr: "Cooldowns", crit: "Crit", critDmg: "Crit damage", echo: "Echoes", luck: "Luck", targets: "Extra targets", area: "Area",
    rarities: ["Common", "Uncommon", "Rare", "Epic", "Legendary"], toBuild: "Create the build", mcTitle: "Simulated runs", runs: "runs", simulate: "Simulate", running: "Simulating…", mcHelp: "Replays full runs: level-ups, cards drawn by luck, the companion picks, caches.", mcMean: "Average DPS over the run", mcRange: "Worst 10% / best 10%", mcLevel: "Average final level", mcDist: "run spread", mcHave: "Obtained", mcRank: "Avg rank", mcWin: "Build B beats build A in {v}% of runs.", mcDone: "{n} runs simulated in {ms} ms.", procs: "Triggered effects", killsRun: "Kills over 20 min", zone: "Zone", zoneAny: "All", gear: "Gear and collection", gearSet: "Full set", gearManual: "Manual", gearStars: "Stars", gearPieces: "Pieces worn", gearHint: "Fills the numbers with the game's gear (8 pieces, weapons, set bonuses), without the collection", group: "Group (co-op)", noAlly: "No ally", allyShout: "A warrior's Battle Shout: +{v}% damage on average", allyMark: "Hunter's Mark: the target takes +{v}% damage", pets: "Pets and demons", kills: "Death explosions", procs: "Triggered effects", procNote: "including {v} free casts per second", amuletUps: "amulet upgraded {v} times", amuletNoUp: "amulet not upgraded",
  },
};
const SM = (k, vars) => {
  let s = (SIM_STR[lang()] || SIM_STR.en)[k];
  if (s === undefined) s = SIM_STR.en[k] || k;
  for (const [a, b] of Object.entries(vars || {})) s = s.split("{" + a + "}").join(b);
  return s;
};

let SIMDATA = null;
const SIMS = { a: null, b: null, compare: false };
const UP_BASE = { damage: [18, 25, 34, 46, 65], cooldown: [7, 10, 13, 17, 23], area: [12, 18, 25, 35, 50], duration: [15, 22, 30, 40, 58], targets: [1, 1, 1, 2, 2] };
const KIND_CD = { single: 6, multi: 6, missiles: 5, chain: 6, nova: 6, cone: 6, ground: 10, dot: 8, totem: 20, buff: 30, mark: 15, special: 8 };
const RACE_FX = {
  human: { dmg: 0.05, xp: 1.05 }, orc: { dmg: 0.105 }, dwarf: { dmg: 0.06 }, nightelf: {}, scourge: {}, tauren: {},
  gnome: { cdMul: 0.92, luck: 20 }, troll: { cdr: 0.086, crit: 3 },
};
const CAPSTONES = {
  bladestorm: { extra: { whirlwind: 3 } }, killing_spree: { extra: { sinister_strike: 3 }, targets: { sinister_strike: 1 } },
  elemental_mastery: { extra: { chain_lightning: 3 } }, lights_grace: { extra: { holy_wrath: 14 } }, wyvern_sting: { extra: { explosive_trap: 5 } },
  totemic_call: { extra: { searing_totem: 14 } }, rain_of_chaos: { extra: { rain_of_fire: 13 } }, water_elemental: { extra: { frost_nova: 8 }, pet: true },
  arcane_power: { echo: 20 }, kill_shot: { spellCd: { aimed_shot: 15 } }, divine_storm: { splash: { exorcism: 0.5 } }, chastise: { targets: { smite: 1 }, critProc: { spell: "holy_nova", from: "smite", perCast: true, every: 1, max: 99 } },
  bestial_wrath: { pet: true }, force_of_nature: { pet: true }, enh_stormbound_echoes: { proc: true }, butcher: { pet: true }, pact_of_the_annihilan: { pet: true },
  penance: { proc: true }, mortal_wounds: { proc: true }, pyroclasm: { kills: { school: "Fire", r: 6, scale: 0.3 } }, seed_of_corruption: { kills: { dots: true, pct: 20, r: 6, scale: 0.6 } }, toxic_bloom: { kills: { dots: true, r: 7 } }, shadowform: { kills: { spells: ["sw_pain"], pct: 20, r: 6, scale: 2 } },
  shadow_dance: { splash: { backstab: 0.5, eviscerate: 0.5 } }, titan: { proc: true }, hammer_righteous: { proc: true }, tree_of_life: {}, leader_of_pack: { extra: { swipe: 3 } }, cat_form: { dmg: 10, crit: 10, spellCd: { shred: 20 } },
};
const MILESTONES = {
  sweeping_strikes: { splash: { cleave: 1.4, mortal_strike: 1.4, execute: 1.4 } }, flurry: { mult: { whirlwind: 1.4, bloodthirst: 1.4 } }, rampage: { proc: true },
  deep_wounds: { critBleed: 0.8 }, ignite: { critBleed: 0.8 }, blood_frenzy: { critBleed: 1 }, hot_streak: { critProc: { spell: "pyroblast", school: "Fire", every: 4, max: 2 } }, splitting_ice: { splash: { frostbolt: 2 } },
  arcane_concentration: { proc: true }, presence_of_mind: { mult: { arcane_missiles: 1.4 } }, lightning_overload: { mult: { lightning_bolt: 1.4, chain_lightning: 1.4 } },
  elemental_fury: { chainJumps: 3 }, enh_unleashed_weapons: { mult: { rockbiter: 1.1, stormstrike: 1.1, fire_nova: 1.1, flame_shock: 1.1, frost_shock: 1, chain_lightning: 1.1, lightning_bolt: 1.1 } },
  // Valeurs au rang 3 (notes 0.137) : 15 % par Croque-roc de 2,2 s, 30 % par Courroux de 8,5 s
  enh_flametongue_weapon: { extra: { fire_nova: 15 } }, enh_frostbrand_weapon: { extra: { frost_shock: 28 } },
  enh_windfury_weapon: { proc: true }, enh_flurry: { proc: true }, enh_ancestral_fortitude: { proc: true }, enh_resonant_shocks: { proc: true },
  blade_flurry_talent: { splash: { sinister_strike: 0.5, eviscerate: 0.5 } }, mutilate: { mult: { sinister_strike: 1.5, backstab: 1.5 } }, deadly_poison: { critBleed: 0.4 },
  piercing_shots: { mult: { auto_shot: 1.8 } }, rapid_fire: { proc: true }, frenzy_hunter: { pet: true }, tame_beast: { pet: true }, explosive_ammo: { kills: { spells: ["auto_shot", "multi_shot"], r: 6 } },
  seal_of_command: { splash: { judgement: 2 * 0.5 } }, art_of_war: { proc: true }, divine_favor: { proc: true }, daybreak: { proc: true }, hallowed_ground: { proc: true }, ardent_defender: { dmg: 10 },
  shadowburn: { splash: { shadow_bolt: 0.3 } }, conflagrate: { proc: true }, nightfall: { proc: true }, contagion: { proc: true }, omen_of_clarity: { proc: true }, starfall: { proc: true },
  holy_nova_talent: { proc: true }, holy_fire_talent: { critBleed: 0.3 }, divine_aegis: { proc: true }, rapture: { proc: true }, shadow_weaving: { proc: true }, shadowy_apparitions: { proc: true },
  twin_totems: { mult: { searing_totem: 2, magma_totem: 2 } }, frostbite: {}, rake: { critBleed: 0.3 }, tranquility: { proc: true }, legion_gate: { pet: true }, soul_devourer: { pet: true }, soul_link: { pet: true },
  shockwave: { splash: { shield_slam: 1.6 } }, fortified: { dmg: 20 }, preparation: { proc: true }, cheat_death: {}, adrenaline: { proc: true }, entrapment: {}, swiftmend: {}, reincarnation: {},
};

const KILL_SHARE = 0.5;
const KILLS_PER_DENSITY = 1020;
const LEVEL_DMG = 3.8;
const JEWEL_UP = [1, 1.8, 2.5, 3.4, 4.2, 4.9, 5.7, 6.5, 7.2, 7.8, 8.4];
const AMULET_UP = [1, 1.2, 1.38, 1.54, 1.69, 1.82, 1.94, 2.04, 2.14, 2.23, 2.31];

function simLoad() {
  if (SIMDATA) return Promise.resolve(SIMDATA);
  return Promise.all([fetch("simdata.json").then((r) => r.json()), fetch("gamedb.json").then((r) => r.json()).catch(() => null), fetch("jewelups.json").then((r) => r.json()).catch(() => null), fetch("gear.json").then((r) => r.json()).catch(() => null), fetch("simcal.json").then((r) => r.json()).catch(() => null)]).then(([d, g, j, s, c]) => { SIMDATA = g ? withGameDb(d, g) : d; SIMDATA.jewelUps = j || {}; SIMDATA.gear = s; SIMDATA.cal = c; return SIMDATA; });
}

function withGameDb(d, g) {
  const ratios = [];
  for (const [k, v] of Object.entries(d.spells)) {
    const a = g.abilities[k];
    if (a && a.dmg && v.dmg && /single|multi|missiles|nova|cone|chain/.test(v.kind)) ratios.push(v.dmg / a.dmg);
  }
  ratios.sort((x, y) => x - y);
  const scale = ratios.length ? ratios[Math.floor(ratios.length / 2)] : 2.5;
  for (const [k, a] of Object.entries(g.abilities)) {
    const v = d.spells[k];
    if (v) {
      if (!v.cd && a.cd) v.cd = a.cd;
      if (a.dmg && v.dmg && /single|multi|missiles|nova|cone|chain|ground|dot/.test(v.kind)) {
        const f = (a.dmg * scale) / v.dmg;
        v.dmg *= f;
        if (v.tick) v.tick *= f;
      }
      continue;
    }
    if (!a.dmg) continue;
    const dmg = Math.round(a.dmg * scale);
    let e;
    if (a.radius && a.dur && a.ticks) e = { kind: "ground", radius: a.radius, dur: a.dur, every: a.dur / a.ticks, tick: dmg / a.ticks, dmg };
    else if (a.dur && a.ticks) e = { kind: "dot", targets: Math.max(1, a.targets), dur: a.dur, dmg };
    else if (a.radius && !a.range) e = { kind: "nova", radius: a.radius, dmg };
    else e = { kind: a.targets > 1 ? "multi" : "single", targets: Math.max(1, a.targets), range: a.range, dmg };
    d.spells[k] = Object.assign(e, { cd: a.cd, fromGame: true, text: "" });
  }
  for (const [k, a] of Object.entries(g.abilities)) {
    if (d.spells[k]) d.spells[k].school = ["Physical", "Holy", "Fire", "Nature", "Frost", "Shadow", "Arcane"][a.flags & 255];
  }
  d.scale = scale;
  return d;
}

// Stuff complet d'un palier : 8 pieces et armes a n etoiles, bonus 4 pieces (1 etoile ou plus)
function gearFromSet(classKey, tier, stars, pieces = 8) {
  const s = SIMDATA.gear.classes[classKey].sets[tier];
  const set4 = stars >= 1 && pieces >= 4 ? SIMDATA.gear.tiers[tier].set4 : {};
  const k = (x) => ((s.totals[stars][x] || 0) * pieces) / 8 + (s.totalsWeapons[stars][x] || 0) + (set4[x] || 0);
  const pct = (x) => +(k(x) * 100).toFixed(1);
  return { dmg: pct("dmg"), crit: pct("crit"), critDmg: pct("critDmg"), cdr: pct("cdr"), echo: pct("echo"), area: pct("area"), targets: k("targets") };
}

function simFromBuild(b) {
  const c = cls(b.class);
  const list = (b.spells.length ? b.spells : c.spells.slice(0, 6).map((s) => ({ key: s.key, w: 3 }))).slice(0, 6);
  return {
    class: b.class, name: b.name, talents: Object.assign({}, b.talents),
    spells: list.map((s) => ({ key: s.key, w: s.w || 3, rank: Math.max(1, Math.min(10, 2 + (s.w || 3))) })),
    rings: (b.rings || []).filter((k) => DATA.rings.some((j) => j.key === k)).slice(0, 2),
    trinkets: (b.trinkets || []).filter((k) => DATA.trinkets.some((j) => j.key === k)).slice(0, 2),
    amulet: (b.amulets || [])[0] || "", amuletUps: 0,
    race: b.race || "human", rarity: 1.5, density: 6, boss: 25, allies: [], gear: { dmg: 46, crit: 10, critDmg: 15, cdr: 13, echo: 0, area: 19, targets: 0 },
  };
}

function talentFx(sc) {
  const c = cls(sc.class);
  const fx = { dmg: 0, cdr: 0, cdMul: 1, crit: 0, critDmg: 0, echo: 0, luck: 0, dot: 0, boss: 0, low: 0, pet: 0, area: 0, school: {}, spellDmg: {}, spellCd: {}, spellTargets: {}, extra: {}, mult: {}, splash: {}, critBleed: 0, chainJumps: 0, notes: { pets: false, kills: false, procs: [] }, killFx: [] };
  const names = {};
  for (const s of c.spells) names[s.name.en] = s.key;
  const keysIn = (txt) => txt.split(/, | and /).map((n) => names[n.trim()]).filter(Boolean);
  for (const tree of c.trees)
    for (const t of tree.talents) {
      const r = sc.talents[t.key] || 0;
      if (!r) continue;
      const v = t.v !== undefined ? +(t.v * r).toFixed(2) : null;
      const d = (t.desc.en || "").split("{v}").join(v);
      let m;
      if ((m = d.match(/Increases all damage and your critical strike chance by ([\d.]+)%/))) { fx.dmg += +m[1]; fx.crit += +m[1]; }
      else if ((m = d.match(/Increases all damage and your demons' critical strike chance by ([\d.]+)%/))) fx.dmg += +m[1];
      else if ((m = d.match(/Increases all damage by ([\d.]+)%/))) fx.dmg += +m[1];
      if ((m = d.match(/Increases your(?: and your pets')? critical strike chance by ([\d.]+)%/))) fx.crit += +m[1];
      if ((m = d.match(/critical strike damage by ([\d.]+)%/))) fx.critDmg += +m[1];
      if ((m = d.match(/Your cooldowns recover ([\d.]+)% faster/))) fx.cdr += +m[1];
      if ((m = d.match(/([\d.]+)% chance for any spell to strike twice/))) fx.echo += +m[1];
      if ((m = d.match(/Increases your luck by ([\d.]+)%/))) fx.luck += +m[1];
      if ((m = d.match(/Your damage-over-time effects deal ([\d.]+)% more damage/))) fx.dot += +m[1];
      if ((m = d.match(/You deal ([\d.]+)% more damage to elites and bosses/))) fx.boss += +m[1];
      if ((m = d.match(/You deal ([\d.]+)% more damage to enemies below 30% health/))) fx.low += +m[1];
      if ((m = d.match(/Your (?:pets|demons) deal ([\d.]+)% more damage/))) fx.pet += +m[1];
      if ((m = d.match(/^(\w+) spells deal ([\d.]+)% more damage/))) fx.school[m[1]] = (fx.school[m[1]] || 0) + +m[2];
      if ((m = d.match(/^(?:Arcane and Nature) spells deal ([\d.]+)% more damage/))) { fx.school.Arcane = (fx.school.Arcane || 0) + +m[1]; fx.school.Nature = (fx.school.Nature || 0) + +m[1]; }
      if ((m = d.match(/^(.+?) deals? ([\d.]+)% more damage/)) && !/spells|effects/.test(m[1])) for (const k of keysIn(m[1])) fx.spellDmg[k] = (fx.spellDmg[k] || 0) + +m[2];
      if ((m = d.match(/^(.+?)(?:'s cooldown is| cooldowns are) ([\d.]+)% shorter/))) for (const k of keysIn(m[1].replace(/'s$/, ""))) fx.spellCd[k] = (fx.spellCd[k] || 0) + +m[2];
      if ((m = d.match(/^(.+?) fires at (\d+) more targets/))) for (const k of keysIn(m[1])) fx.spellTargets[k] = (fx.spellTargets[k] || 0) + +m[2];
      if ((m = d.match(/(?:cover|reaches?) ([\d.]+)% (?:more ground|farther)/))) fx.area += +m[1];
      const special = (t.row === 6 ? CAPSTONES : MILESTONES)[t.key];
      if (!special) continue;
      for (const [k, sec] of Object.entries(special.extra || {})) fx.extra[k] = (fx.extra[k] || 0) + 1 / sec;
      for (const [k, x] of Object.entries(special.mult || {})) fx.mult[k] = (fx.mult[k] || 1) * x;
      for (const [k, x] of Object.entries(special.splash || {})) fx.splash[k] = (fx.splash[k] || 0) + x;
      for (const [k, x] of Object.entries(special.targets || {})) fx.spellTargets[k] = (fx.spellTargets[k] || 0) + x;
      for (const [k, x] of Object.entries(special.spellCd || {})) fx.spellCd[k] = (fx.spellCd[k] || 0) + x;
      if (special.echo) fx.echo += special.echo;
      if (special.dmg) fx.dmg += special.dmg;
      if (special.crit) fx.crit += special.crit;
      if (special.critBleed) fx.critBleed = Math.max(fx.critBleed, special.critBleed);
      if (special.chainJumps) fx.chainJumps += special.chainJumps;
      if (special.pet) fx.notes.pets = true;
      if (special.kills) { fx.notes.kills = true; fx.killFx.push(Object.assign({}, special.kills, { pct: special.kills.pct || v || 15 })); }
      if (special.proc) fx.notes.procs.push(L(t.name));
      if (special.critProc) fx.critProc = special.critProc;
    }
  // Bonus 8 pieces : 3 etoiles ou plus, renforce a 5. Seuls les degats et cibles se lisent dans le texte, le reste part en note.
  const set = sc.gearSet && SIMDATA && SIMDATA.gear && sc.gearSet.stars >= 3 && (sc.gearSet.pieces || 8) === 8 ? SIMDATA.gear.classes[sc.class].sets[sc.gearSet.tier].set8 : null;
  if (set) {
    const txt = (sc.gearSet.stars >= 5 ? set.empowered : set).text.en;
    const key = names[set.abilityName.en];
    const dmg = txt.match(/deals? (\d+)% more damage/), more = txt.match(/(?:strikes|jumps|leaps to|pierces to|splits, striking) (\d+) more/);
    if (dmg) fx.spellDmg[key] = (fx.spellDmg[key] || 0) + +dmg[1];
    if (more) fx.spellTargets[key] = (fx.spellTargets[key] || 0) + +more[1];
    if (!dmg && !more) fx.notes.procs.push(set.abilityName[lang()] || set.abilityName.en);
  }
  return fx;
}

function jewelFx(sc, fx) {
  const c = cls(sc.class);
  const add = (lines, mul) => {
    for (const raw of lines) {
      const ln = mul && mul !== 1 ? raw.replace(/[\d.]+(?=%)/g, (v) => String(+(v * mul).toFixed(2))) : raw;
      let m;
      if ((m = ln.match(/^\+([\d.]+)% damage$/))) fx.dmg += +m[1];
      if ((m = ln.match(/^-([\d.]+)% cooldowns$/))) fx.cdMul *= 1 - m[1] / 100;
      if ((m = ln.match(/^\+([\d.]+)% critical strike chance$|^\+([\d.]+)% critical strike$/))) fx.crit += +(m[1] || m[2]);
      if ((m = ln.match(/^\+([\d.]+)% critical strike damage$/))) fx.critDmg += +m[1];
      if ((m = ln.match(/^([\d.]+)% chance for a spell to cast twice$/))) fx.echo += +m[1];
      if ((m = ln.match(/^\+([\d.]+)% area of effect$/))) fx.area += +m[1];
      if ((m = ln.match(/^\+([\d.]+)% luck$/))) fx.luck += +m[1];
      if ((m = ln.match(/^\+(\d+) target$/))) fx.allTargets = (fx.allTargets || 0) + +m[1];
      if ((m = ln.match(/tick ([\d.]+)% faster/))) fx.dot += +m[1];
      if ((m = ln.match(/^Your hits leap to 1 more enemy for ([\d.]+)%/))) fx.leap = (fx.leap || 0) + m[1] / 100;
      if ((m = ln.match(/^Your hits splash ([\d.]+)%/))) fx.leap = (fx.leap || 0) + m[1] / 100;
      if ((m = ln.match(/burn and bleed for ([\d.]+)% more over/))) fx.critBleed = Math.max(fx.critBleed, 0);
      if (/explode for/.test(ln)) fx.notes.kills = true;
    }
  };
  const ups = (k) => {
    const n = (sc.jewelUps || {})[k] || 0;
    if (!n) return 1;
    const t = (SIMDATA.jewelUps || {})[k];
    const rank = n + 1;
    if (t) { const known = Object.keys(t).map(Number).filter((x) => x <= rank); const top = Math.max(...known); return t[top] * Math.pow(1.06, rank - top); }
    return JEWEL_UP[Math.min(JEWEL_UP.length - 1, n)];
  };
  for (const k of sc.rings) { const j = DATA.rings.find((x) => x.key === k); if (j) add(j.desc.en, ups(k)); }
  for (const k of sc.trinkets) { const j = DATA.trinkets.find((x) => x.key === k); if (j) add(j.desc.en, ups(k)); }
  fx.leg = null;
  if (sc.amulet.startsWith("leg:")) {
    const key = sc.amulet.slice(4);
    const l = DATA.legendaries[key];
    const sp = spellOf(c, key);
    if (l && sp) {
      const g = { key, dmg: 0, targets: 0, area: 0, dur: 0, cd: 0, mult: 1 };
      for (const ln of l.lines.en) {
        let m;
        const t = ln.replace(sp.name.en + ": ", "").replace(sp.name.en + "'s ", "");
        if ((m = t.match(/^\+([\d.]+)% damage/))) g.dmg += +m[1];
        if ((m = t.match(/^\+(\d+) targets?/))) g.targets += +m[1];
        if ((m = t.match(/^\+([\d.]+)% area/))) g.area += +m[1];
        if ((m = t.match(/^\+([\d.]+)% duration/))) g.dur += +m[1];
        if ((m = t.match(/^-([\d.]+)% cooldown/))) g.cd += +m[1];
        if ((m = t.match(/leap to (\d+) more enemies for ([\d.]+)%/))) g.mult *= 1 + (m[1] * m[2]) / 100;
        if ((m = t.match(/([\d.]+)% chance .*strike again for ([\d.]+)%/))) g.mult *= 1 + (m[1] * m[2]) / 10000;
        if ((m = t.match(/burn and bleed for ([\d.]+)% more/))) g.mult *= 1 + m[1] / 100;
        if ((m = t.match(/explode for ([\d.]+)% of their max health/))) { fx.notes.kills = true; fx.killFx.push({ spells: [key], pct: +m[1], r: 6, leg: true }); }
      }
      const up = AMULET_UP[Math.min(AMULET_UP.length - 1, sc.amuletUps || 0)];
      for (const f of ["dmg", "area", "dur", "cd"]) g[f] *= up;
      g.mult = 1 + (g.mult - 1) * up;
      for (const k of fx.killFx) if (k.leg) k.pct *= up;
      fx.leg = g;
    }
  } else if (sc.amulet) {
    const j = DATA.amulets.find((x) => x.key === sc.amulet);
    if (j) add(j.desc.en);
  }
  return fx;
}

function upgradeSum(type, ranks, rarity) {
  let s = 0;
  const lo = Math.floor(rarity), hi = Math.min(4, lo + 1), f = rarity - lo;
  for (let r = 2; r <= ranks; r++) {
    const decay = type === "targets" ? 1 : r <= 3 ? 1 : r <= 6 ? 0.67 : r <= 10 ? 0.5 : 0.35;
    const v = UP_BASE[type][lo] * (1 - f) + UP_BASE[type][hi] * f;
    s += type === "targets" ? (r % 3 === 0 ? Math.round(v) : 0) : v * decay;
  }
  return s;
}

// Sorts "special" : chiffres lus dans le texte du jeu, renvoie { pack, single } par seconde avant calage
function specialSpell(key, base, o) {
  const t = base.text || "";
  const num = (re) => { const m = t.match(re); return m ? +m[1] : 0; };
  const dmg = num(/dealing ([\d.]+)/) || num(/for ([\d.]+) \w+ damage/) || num(/take ([\d.]+) damage/);
  const D = dmg * o.mult;
  const out = (pack, single, note) => ({ pack, single, rate: 0, hits: 0, note: note || "", kind: "special" });
  // coups de mêlée encaissés par seconde : la plupart des héros gardent leurs distances
  const melee = { pack: Math.min(4, o.density * 0.25), single: 0.7 };
  switch (key) {
    case "redemption": {
      // 11 % des morts explosent, une explosion peut en relancer une : +30 %, plafond 2 par seconde
      const rate = Math.min(2 / o.cdk, o.kps * (num(/([\d.]+)% chance/) / 100) * 1.3);
      return out(D * rate * o.n(num(/within ([\d.]+) yd/), o.area), 0);
    }
    case "holy_shield": case "lightning_shield": case "thorns": {
      // relancé dès qu'il expire : présent presque tout le temps
      return out(D * melee.pack, D * melee.single);
    }
    case "lightwell": {
      const every = num(/Every ([\d.]+) sec/) * o.cdk, dur = num(/For ([\d.]+) sec/) * o.durMul;
      const r = D * Math.min(1, dur / every);
      return out(r * (1 + o.extraT), r);
    }
    case "bloodrage": {
      const r = num(/within ([\d.]+) yd/) || 10;
      const per = (k) => (h) => D * (k === "pack" ? o.n(r, o.area) : 1) / Math.max(8 * o.cdk, 100 / Math.min(12, 2 * h));
      return { kind: "special", note: "", late: (x) => ({ pack: per("pack")(x.hitRate("pack")), single: per("single")(x.hitRate("single")) }) };
    }
    case "seal_fate": {
      const cap = num(/at most ([\d.]+) a second/);
      // un point par sort lancé, deux sur critique ; double dégâts sous 30 % : x1,3 en moyenne
      const rate = (x) => Math.min(cap, x.casts * (1 + x.crit)) / 5;
      return { kind: "special", note: "", late: (x) => ({ pack: D * 1.3 * (1 + o.extraT) * rate(x), single: D * 1.3 * rate(x) }) };
    }
    case "soul_fire": {
      // une âme par mort, au plus une par seconde ; sur un boss seul il reste les adds
      const every = 5 / Math.min(1 / o.cdk, o.kps);
      return out(D * (1 + o.extraT) / every, D / (5 / Math.min(1 / o.cdk, o.kps * 0.4)));
    }
    case "polymorph": {
      // 12 % des coups, au plus un mouton toutes les 3 s, éclat plafonné (les mobs ont plus de vie que le plafond)
      const capDmg = num(/up to ([\d.]+)/) * o.mult, pct = num(/([\d.]+)% chance/) / 100;
      return { kind: "special", note: "", late: (x) => ({ pack: capDmg * o.n(num(/within ([\d.]+) yd/), o.area) * Math.min(1 / 3, x.hitRate("pack") * pct), single: 0 }) };
    }
    case "faerie_fire": {
      // la marque reçoit surtout les sorts à cible unique ; l'arc touche 2 voisins (+cibles), au plus 4 fois par seconde
      const pct = num(/arc ([\d.]+)%/) / 100, capDmg = num(/up to ([\d.]+)/) * o.mult;
      const voisins = Math.min(2 + o.extraT, Math.max(0, o.n(num(/within ([\d.]+) yd/) || 8.8, o.area) - 1));
      return { kind: "special", note: "", late: (x) => { const r = Math.min(4, x.casts); const hit = x.casts ? x.single / x.casts : 0; return { pack: r * Math.min(capDmg, hit * pct * (1 + o.up("damage") / 100)) * voisins, single: 0 }; } };
    }
  }
  return null;
}

function simulate(sc) {
  const c = cls(sc.class);
  const fx = jewelFx(sc, talentFx(sc));
  const g = sc.gear || {};
  fx.dmg += g.dmg || 0;
  fx.crit += g.crit || 0;
  fx.critDmg += g.critDmg || 0;
  fx.cdMul *= 1 - (g.cdr || 0) / 100;
  fx.echo += g.echo || 0;
  fx.area += g.area || 0;
  fx.allTargets = (fx.allTargets || 0) + (g.targets || 0);
  const race = RACE_FX[sc.race] || {};
  fx.dmg += (race.dmg || 0) * 100;
  fx.cdr += (race.cdr || 0) * 100;
  if (race.cdMul) fx.cdMul *= race.cdMul;
  fx.crit += race.crit || 0;
  fx.luck += race.luck || 0;
  fx.dmg += LEVEL_DMG * ((sc.level || 1) - 1);
  if (sc.real) {
    fx.dmg = (sc.real.dmg - 1) * 100;
    fx.crit = sc.real.crit * 100 - 5;
    fx.critDmg = (sc.real.cm / 2 - 1) * 100;
    fx.cdr = 0;
    fx.cdMul = sc.real.cd;
    fx.echo = sc.real.echo * 100;
    fx.area = (sc.real.area - 1) * 100;
  }
  const crit = Math.min(100, 5 + fx.crit) / 100;
  const critMul = 2 * (1 + fx.critDmg / 100);
  const critFactor = 1 + crit * (critMul - 1) + crit * fx.critBleed;
  const echo = 1 + fx.echo / 100;
  const n = (radius, areaPct) => Math.min(Math.max(30, sc.density * 1.5), Math.max(1, sc.density * Math.pow(radius / 10, 2) * (1 + areaPct / 100)));
  let buffDmg = 0, buffCdr = 0, bossTaken = 0;
  const allyNotes = [];
  for (const a of sc.allies || []) {
    if (a === "warrior" && SIMDATA.spells.battle_shout) {
      const b = SIMDATA.spells.battle_shout;
      const up = Math.min(1, b.dur / ((b.cd || KIND_CD.buff) * 0.8));
      buffDmg += b.value * up;
      allyNotes.push(SM("allyShout", { v: Math.round(b.value * up * 100) }));
    }
    if (a === "hunter" && SIMDATA.spells.hunters_mark) {
      bossTaken += SIMDATA.spells.hunters_mark.value;
      allyNotes.push(SM("allyMark", { v: Math.round(SIMDATA.spells.hunters_mark.value * 100) }));
    }
  }
  const rows = [], late = [];
  const pre = sc.spells.map((s) => ({ s, base: SIMDATA.spells[s.key], def: spellOf(c, s.key) })).filter((x) => x.def);
  for (const { s, base, def } of pre) {
    if (!base || base.kind !== "buff") continue;
    const ups = def.upgrades || [];
    const per = Math.max(1, ups.length);
    const k = (t) => (ups.includes(t) ? Math.ceil((s.rank - 1) / per) + 1 : 1);
    const dur = base.dur * (1 + upgradeSum("duration", k("duration"), sc.rarity) / 100);
    const cd = (base.cd || KIND_CD.buff) * (1 - upgradeSum("cooldown", k("cooldown"), sc.rarity) / 100) / (1 + fx.cdr / 100) * fx.cdMul;
    if (base.stat === "dmg") buffDmg += base.value * Math.min(1, dur / cd);
    if (base.stat === "cdr") buffCdr += base.value * 100 * Math.min(1, dur / cd);
  }
  for (const { s, base, def } of pre) {
    const row = { key: s.key, name: L(def.name), icon: def.icon, rank: s.rank, pack: 0, single: 0, note: "" };
    rows.push(row);
    if (!base) { row.note = SM("noData"); continue; }
    if (base.kind === "defense" || base.kind === "buff") { row.note = base.kind === "buff" ? "+" + Math.round(base.value * 100) + "% " + (base.stat === "dmg" ? SM("dmg").toLowerCase() : base.stat) : ""; row.utility = true; continue; }
    const ups = (def.upgrades || []).filter((u) => UP_BASE[u]);
    const per = Math.max(1, ups.length);
    const U = s.ups || null;
    const up = (t) => (U ? U[t] || 0 : upgradeSum(t, ranksFor(t), sc.rarity));
    const ranksFor = (t) => (ups.includes(t) ? Math.floor((s.rank - 1) / per) + (ups.indexOf(t) < (s.rank - 1) % per ? 1 : 0) + 1 : 1);
    const leg = fx.leg && fx.leg.key === s.key ? fx.leg : { dmg: 0, targets: 0, area: 0, dur: 0, cd: 0, mult: 1 };
    const school = base.school || ((base.text || "").match(/(Fire|Frost|Arcane|Nature|Shadow|Holy|Physical) damage/) || [])[1];
    let mult = (1 + fx.dmg / 100 + buffDmg) * (1 + (fx.school[school] || 0) / 100) * (1 + (fx.spellDmg[s.key] || 0) / 100) * (1 + up("damage") / 100) * (1 + leg.dmg / 100) * leg.mult * (fx.mult[s.key] || 1);
    if (base.kind === "dot" || base.kind === "ground") mult *= 1 + fx.dot / 100;
    const cdBase = base.cd || KIND_CD[base.kind] || 6;
    row.estCd = !base.cd;
    let cd = cdBase * (1 - up("cooldown") / 100) * (1 - (fx.spellCd[s.key] || 0) / 100) * (1 - leg.cd / 100) / (1 + (fx.cdr + buffCdr) / 100) * fx.cdMul;
    cd = Math.max(0.3, cd);
    const area = fx.area + up("area") + leg.area;
    const extraT = up("targets") + (fx.spellTargets[s.key] || 0) + leg.targets + (fx.allTargets || 0);
    const durMul = 1 + (up("duration") + leg.dur) / 100;
    if (base.kind === "special") {
      const sp = specialSpell(s.key, base, { up, mult: mult * critFactor, area, extraT, durMul, cdk: (1 - up("cooldown") / 100) / (1 + (fx.cdr + buffCdr) / 100) * fx.cdMul, n, kps: sc.density * KILLS_PER_DENSITY / 1200, density: sc.density });
      if (!sp) { row.note = SM("notSim"); continue; }
      if (sp.late) late.push({ row, sp }); else Object.assign(row, sp);
      row.school = school;
      continue;
    }
    let hitsPack = 1, hitsBoss = 1, dmg = base.dmg || 0;
    switch (base.kind) {
      case "single": hitsPack = 1 + extraT; hitsBoss = 1; break;
      case "multi": hitsPack = base.targets + extraT; hitsBoss = 1; break;
      case "missiles": hitsPack = hitsBoss = base.hits + extraT; break;
      case "chain": {
        const jumps = base.jumps + fx.chainJumps + extraT;
        const decay = fx.chainJumps ? 0 : base.decay;
        let t = 0;
        for (let i = 0; i <= jumps; i++) t += Math.pow(1 - decay, i);
        hitsPack = Math.min(t, n(base.range || 28, 0)); hitsBoss = 1; break;
      }
      case "nova": hitsPack = n(base.radius, area); break;
      case "cone": hitsPack = Math.max(1, n(base.radius, area) / 6); break;
      case "ground": dmg = base.dmg * durMul; hitsPack = n(base.radius, area); break;
      case "dot": dmg = base.dmg * durMul; hitsPack = base.targets + extraT; hitsBoss = 1; break;
      case "totem": dmg = base.tick * (base.dur * durMul / base.every); hitsPack = base.aoe ? n(base.radius, area) : 1; break;
      case "mark": dmg = base.dmg; hitsPack = n(base.radius, area) * 0.5; hitsBoss = 0; break;
    }
    if (base.execute) mult *= 1.3;
    mult *= 1 + fx.low / 100 * 0.3;
    const splash = fx.splash[s.key] || 0;
    const leap = 1 + (fx.leap || 0);
    const rate = 1 / cd + (fx.extra[s.key] || 0);
    row.pack = dmg * mult * critFactor * echo * hitsPack * (1 + splash) * leap * rate;
    row.single = dmg * mult * critFactor * echo * hitsBoss * (1 + fx.boss / 100) * (1 + bossTaken) * rate;
    row.cd = cd;
    row.hits = hitsPack;
    row.school = school;
    row.rate = rate * echo;
    row.hitsBoss = hitsBoss;
    row.kind = base.kind;
    row.ticks = base.kind === "ground" ? Math.max(1, (base.dur * durMul) / (base.every || 1)) : base.kind === "totem" ? Math.max(1, (base.dur * durMul) / base.every) : base.kind === "dot" ? Math.max(1, (base.dur * durMul) / 1) : 1;
  }
  const cp = fx.critProc;
  const procRow = cp && rows.find((r) => r.key === cp.spell && r.rate);
  if (procRow) {
    const fed = (k) => rows.filter((r) => (cp.from ? r.key === cp.from : r.school === cp.school) && r.rate).reduce((a, r) => a + r.rate * (cp.perCast ? 1 : r.ticks * (k === "pack" ? r.hits : r.hitsBoss)), 0) * crit;
    for (const k of ["pack", "single"]) {
      const per = procRow[k] / procRow.rate;
      const procs = Math.min(cp.max, fed(k) / cp.every);
      procRow[k] += per * procs;
    }
    procRow.note = SM("procNote", { v: Math.round(Math.min(cp.max, fed("pack") / cp.every) * 10) / 10 });
  }
  // Sorts nourris par les coups des autres sorts (rage, points de combo, moutons, marque)
  const hitRate = (k) => rows.filter((r) => r.rate && !r.utility).reduce((a, r) => a + r.rate * r.ticks * (k === "pack" ? r.hits : r.hitsBoss), 0);
  const casts = rows.filter((r) => r.rate && !r.utility && r.kind !== "dot" && r.kind !== "ground" && r.kind !== "totem").reduce((a, r) => a + r.rate, 0);
  const single = rows.reduce((a, r) => a + (r.single || 0), 0);
  for (const { row, sp } of late) Object.assign(row, sp.late({ hitRate, casts, single, crit }));
  let expl = 0;
  for (const k of fx.killFx || []) {
    const trig = rows.filter((x) => x.pack && (k.spells ? k.spells.includes(x.key) : k.school ? x.school === k.school : k.dots ? x.kind === "dot" || x.kind === "ground" : false)).reduce((a, x) => a + x.pack, 0);
    expl += (k.pct / 100) * n(k.r, fx.area) * trig * KILL_SHARE * (k.scale || 1);
  }
  if (expl > 0) rows.push({ key: "explosions", name: SM("kills"), icon: "Spell_Shadow_CorpseExplode", rank: 0, pack: expl, single: 0, note: "" });
  // Calage sur les parties partagees (tools/sim-tune.js) : facteur par sort, procs des talents en part du reste
  const cal = SIMDATA.cal;
  if (cal) {
    for (const r of rows) { const k = cal.spells[r.key]; if (k) { r.pack *= k; r.single *= k; } }
    let share = 0;
    for (const tree of c.trees) for (const t of tree.talents) if (cal.talents[t.key] && sc.talents[t.key]) share += cal.talents[t.key] * sc.talents[t.key] / t.max;
    if (share > 0) rows.push({ key: "procs", name: SM("procs"), icon: "Spell_Nature_WispSplode", rank: 0, pack: rows.reduce((a, r) => a + r.pack, 0) * share, single: rows.reduce((a, r) => a + r.single, 0) * share, note: "" });
  }
  const bossShare = sc.boss / 100;
  for (const r of rows) r.mix = r.pack * (1 - bossShare) + r.single * bossShare;
  const total = rows.reduce((a, r) => a + r.mix, 0);
  return { rows, total, pack: rows.reduce((a, r) => a + r.pack, 0), single: rows.reduce((a, r) => a + r.single, 0), fx, crit, critMul, echo, allyNotes };
}

function simSuggestions(sc) {
  const c = cls(sc.class);
  const base = simulate(sc).total;
  const out = [];
  const names = (k) => { const s = spellOf(c, k); return s ? L(s.name) : k; };
  sc.spells.forEach((s, i) => {
    for (const alt of c.spells) {
      if (sc.spells.some((x) => x.key === alt.key)) continue;
      const t = JSON.parse(JSON.stringify(sc));
      t.spells[i] = { key: alt.key, rank: s.rank };
      const v = simulate(t).total;
      if (v > base * 1.01) out.push({ gain: v / base - 1, text: SM("replace", { a: names(s.key), b: names(alt.key) }) });
    }
  });
  for (const cat of ["rings", "trinkets"])
    sc[cat].forEach((k, i) => {
      for (const alt of DATA[cat]) {
        if (sc[cat].includes(alt.key)) continue;
        const t = JSON.parse(JSON.stringify(sc));
        t[cat][i] = alt.key;
        const v = simulate(t).total;
        const cur = DATA[cat].find((x) => x.key === k);
        if (v > base * 1.01) out.push({ gain: v / base - 1, text: SM("replace", { a: cur ? L(cur.name) : k, b: L(alt.name) }) });
      }
    });
  const amulets = DATA.amulets.map((a) => a.key).concat(sc.spells.filter((s) => DATA.legendaries[s.key]).map((s) => "leg:" + s.key));
  for (const a of amulets) {
    if (a === sc.amulet) continue;
    const t = JSON.parse(JSON.stringify(sc));
    t.amulet = a;
    const v = simulate(t).total;
    const nm = a.startsWith("leg:") ? DATA.legendaries[a.slice(4)].family[lang()] + " (" + names(a.slice(4)) + ")" : L(DATA.amulets.find((x) => x.key === a).name);
    const cur = sc.amulet.startsWith("leg:") ? DATA.legendaries[sc.amulet.slice(4)].family[lang()] : sc.amulet ? L(DATA.amulets.find((x) => x.key === sc.amulet).name) : SM("none");
    if (v > base * 1.01) out.push({ gain: v / base - 1, text: SM("replace", { a: cur, b: nm }) });
  }
  return out.sort((x, y) => y.gain - x.gain).slice(0, 8);
}

function simSelect(options, value, onChange) {
  const s = el("select");
  for (const [v, l] of options) { const o = el("option", "", esc(l)); o.value = v; if (v === value) o.selected = true; s.appendChild(o); }
  s.onchange = () => onChange(s.value);
  return s;
}

function simPanel(sc, which) {
  const box = el("div", "simcol");
  const c = cls(sc.class);
  const head = el("div", "simhead");
  const classSel = simSelect(DATA.classes.map((x) => [x.key, L(x.name)]), sc.class, (v) => { SIMS[which] = simFromBuild(builds(v)[0] || PRESETS.find((p) => p.class === v) && decodePreset(v) || { class: v, name: "", talents: {}, spells: [], rings: [], trinkets: [], amulets: [] }); renderSim(); });
  head.appendChild(classSel);
  const sources = builds(sc.class).map((b) => ["b" + b.id, b.name]).concat(PRESETS.filter((p) => p.class === sc.class).map((p, i) => ["p" + i, p.name + " ★"]));
  head.appendChild(simSelect([["", SM("fromBuild") + "…"]].concat(sources), "", (v) => {
    if (!v) return;
    if (v[0] === "b") SIMS[which] = simFromBuild(STATE.builds.find((b) => b.id === +v.slice(1)));
    else { const p = PRESETS.filter((x) => x.class === sc.class)[+v.slice(1)]; const b = decode(p.code); STATE.builds.pop(); b.race = p.race; SIMS[which] = simFromBuild(b); }
    renderSim();
  }));
  box.appendChild(head);
  box.appendChild(el("div", "simname", esc(sc.name || "")));

  const opts = el("div", "simopts");
  const field = (label, input) => { const f = el("label", "simfield"); f.appendChild(el("span", "", esc(label))); f.appendChild(input); opts.appendChild(f); };
  field(SM("race"), simSelect(Object.keys(RACES).map((k) => [k, L(RACES[k].name)]), sc.race, (v) => { sc.race = v; renderSim(); }));
  const range = (min, max, step, get, set, fmt) => {
    const w = el("div", "simrange");
    const i = el("input"); i.type = "range"; i.min = min; i.max = max; i.step = step; i.value = get();
    const o = el("span", "", fmt(get()));
    i.oninput = () => { set(+i.value); o.textContent = fmt(+i.value); renderSimResults(); };
    w.appendChild(i); w.appendChild(o);
    return w;
  };
  field(SM("rarity"), range(0, 4, 0.25, () => sc.rarity, (v) => (sc.rarity = v), (v) => SM("rarities")[Math.round(v)]));
  // Densite 6 = mediane reelle, environ 6 100 kills en 20 min
  field(SM("killsRun"), range(2000, 60000, 1000, () => Math.round(sc.density * KILLS_PER_DENSITY / 1000) * 1000, (v) => (sc.density = v / KILLS_PER_DENSITY), (v) => v.toLocaleString()));
  field(SM("boss"), range(0, 100, 5, () => sc.boss, (v) => (sc.boss = v), (v) => v + " %"));
  if (SIMDATA && SIMDATA.cal && SIMDATA.cal.zones) field(SM("zone"), simSelect([["", SM("zoneAny")]].concat(Object.keys(SIMDATA.cal.zones).map((z) => [z, z])), sc.zone || "", (v) => { sc.zone = v; renderSim(); }));
  box.appendChild(opts);
  box.appendChild(el("h3", "", esc(SM("gear"))));
  if (SIMDATA && SIMDATA.gear) {
    const pick = sc.gearSet || { tier: -1, stars: 3, pieces: 8 };
    const apply = () => { if (pick.tier >= 0) { sc.gearSet = pick; sc.gear = gearFromSet(sc.class, pick.tier, pick.stars, pick.pieces); } else delete sc.gearSet; renderSim(); };
    const sets = SIMDATA.gear.classes[sc.class].sets.map((s, i) => [String(i), SM("rarities")[i] ? SM("rarities")[i] + " " + (L(s.name) || "") : L(s.name) || "PvP"]);
    field(SM("gearSet"), simSelect([["-1", SM("gearManual")]].concat(sets), String(pick.tier), (v) => { pick.tier = +v; apply(); }));
    field(SM("gearStars"), simSelect([0, 1, 2, 3, 4, 5].map((n) => [String(n), String(n)]), String(pick.stars), (v) => { pick.stars = +v; apply(); }));
    field(SM("gearPieces"), simSelect([1, 2, 3, 4, 5, 6, 7, 8].map((n) => [String(n), String(n)]), String(pick.pieces || 8), (v) => { pick.pieces = +v; apply(); }));
    box.appendChild(el("small", "", esc(SM("gearHint"))));
  }
  const gear = el("div", "simgear");
  sc.gear = sc.gear || {};
  for (const [k, lbl] of [["dmg", SM("dmg")], ["crit", SM("crit")], ["critDmg", SM("critDmg")], ["cdr", SM("cdr")], ["echo", SM("echo")], ["area", SM("area")], ["targets", SM("targets")]]) {
    const f = el("label", "simgearf");
    f.appendChild(el("span", "", esc(lbl)));
    const i = el("input"); i.type = "number"; i.step = k === "targets" ? 1 : 1; i.value = sc.gear[k] || 0;
    i.oninput = () => { sc.gear[k] = +i.value || 0; delete sc.gearSet; renderSimResults(); };
    f.appendChild(i);
    f.appendChild(el("small", "", k === "targets" ? "" : "%"));
    gear.appendChild(f);
  }
  box.appendChild(gear);
  box.appendChild(el("h3", "", esc(SM("group"))));
  const grp = el("div", "simspells");
  sc.allies = sc.allies || [];
  for (let i = 0; i < 4; i++) grp.appendChild(simSelect([["", SM("noAlly")]].concat(DATA.classes.map((x) => [x.key, L(x.name)])), sc.allies[i] || "", (v) => { sc.allies[i] = v; sc.allies = sc.allies.filter((x, j) => x || j < i); renderSimResults(); }));
  box.appendChild(grp);

  box.appendChild(el("h3", "", esc(SM("spells"))));
  const sp = el("div", "simspells");
  sc.spells.forEach((s, i) => {
    const row = el("div", "simspell");
    row.appendChild(simSelect(c.spells.map((x) => [x.key, L(x.name)]), s.key, (v) => { s.key = v; renderSim(); }));
    const rk = el("input"); rk.type = "number"; rk.min = 1; rk.max = 15; rk.value = s.rank; rk.title = SM("rank");
    rk.oninput = () => { s.rank = Math.max(1, Math.min(15, +rk.value || 1)); renderSimResults(); };
    row.appendChild(rk);
    sp.appendChild(row);
  });
  box.appendChild(sp);

  box.appendChild(el("h3", "", esc(SM("jewels"))));
  const jw = el("div", "simspells");
  const jsel = (cat, i, list) => simSelect([["", SM("none")]].concat(list.map((j) => [j.key, L(j.name)])), sc[cat][i] || "", (v) => { if (v) sc[cat][i] = v; else sc[cat].splice(i, 1); renderSimResults(); });
  for (let i = 0; i < 2; i++) jw.appendChild(jsel("rings", i, DATA.rings));
  for (let i = 0; i < 2; i++) jw.appendChild(jsel("trinkets", i, DATA.trinkets));
  const legs = c.spells.filter((s) => DATA.legendaries[s.key]).map((s) => ({ key: "leg:" + s.key, name: { fr: DATA.legendaries[s.key].family.fr + " (" + s.name.fr + ")", en: DATA.legendaries[s.key].family.en + " (" + s.name.en + ")" } }));
  jw.appendChild(simSelect([["", SM("none")]].concat(DATA.amulets.concat(legs).map((j) => [j.key, L(j.name)])), sc.amulet, (v) => { sc.amulet = v; renderSimResults(); }));
  jw.appendChild(simSelect(AMULET_UP.map((_, i) => [String(i), i ? SM("amuletUps", { v: i }) : SM("amuletNoUp")]), String(sc.amuletUps || 0), (v) => { sc.amuletUps = +v; renderSimResults(); }));
  box.appendChild(jw);
  const exp = el("button", "primary", esc(SM("toBuild")));
  exp.onclick = () => simToBuild(sc);
  box.appendChild(exp);
  const res = el("div", "simres");
  res.id = "simres-" + which;
  box.appendChild(res);
  return box;
}

function simToBuild(sc) {
  const r = simulate(sc);
  const total = r.total || 1;
  const b = newBuild(sc.class, (sc.name || L(cls(sc.class).name)) + " (sim)");
  b.talents = Object.assign({}, sc.talents);
  b.spells = sc.spells.map((s) => {
    const row = r.rows.find((x) => x.key === s.key);
    const share = row ? row.mix / total : 0;
    return { key: s.key, w: row && row.utility ? 3 : Math.max(1, Math.min(5, Math.round(1 + share * 10))) };
  }).sort((x, y) => y.w - x.w);
  b.rings = sc.rings.slice();
  b.trinkets = sc.trinkets.slice();
  b.amulets = sc.amulet ? [sc.amulet] : [];
  b.race = sc.race;
  CLASS = sc.class;
  STATE.lastClass = CLASS;
  PAGE = "builds";
  changed();
}

function decodePreset(classKey) {
  const p = PRESETS.find((x) => x.class === classKey);
  const b = decode(p.code);
  STATE.builds.pop();
  b.race = p.race;
  return b;
}

const fmtN = (v) => (v >= 10000 ? Math.round(v / 1000) + " k" : v >= 1000 ? (v / 1000).toFixed(1) + " k" : String(Math.round(v)));

function renderSimResults() {
  for (const which of ["a", "b"]) {
    const sc = SIMS[which];
    const box = $("simres-" + which);
    if (!sc || !box) continue;
    const r = simulate(sc);
    box.innerHTML = "";
    const tiles = el("div", "simtiles");
    const other = which === "b" && SIMS.a ? simulate(SIMS.a).total : null;
    const delta = other ? ` <small class="${r.total >= other ? "good" : "bad"}">${r.total >= other ? "+" : ""}${Math.round((r.total / other - 1) * 100)} %</small>` : "";
    tiles.appendChild(el("div", "simtile big", `<span>${esc(SM("total"))}</span><b>${fmtN(r.total)}${delta}</b>`));
    tiles.appendChild(el("div", "simtile", `<span>${esc(SM("pack"))}</span><b>${fmtN(r.pack)}</b>`));
    tiles.appendChild(el("div", "simtile", `<span>${esc(SM("single"))}</span><b>${fmtN(r.single)}</b>`));
    box.appendChild(tiles);
    const max = Math.max(...r.rows.map((x) => x.mix), 1);
    const bars = el("div", "simbars");
    for (const row of r.rows.slice().sort((a, b) => b.mix - a.mix)) {
      const b = el("div", "simbar");
      const pct = r.total ? Math.round((100 * row.mix) / r.total) : 0;
      b.appendChild(iconNode(row.icon));
      const mid = el("div", "simbarmid");
      mid.appendChild(el("div", "simbartop", `<span>${esc(row.name)} <small>${esc(SM("rank"))} ${row.rank}</small></span><span>${row.mix ? fmtN(row.mix) + " · " + pct + " %" : ""}</span>`));
      const track = el("div", "simtrack");
      const fill = el("div", "simfill");
      fill.style.width = (100 * row.mix) / max + "%";
      track.appendChild(fill);
      mid.appendChild(track);
      const info = row.note ? row.note : row.cd ? SM("every", { v: row.cd.toFixed(1) }) + (row.estCd ? " (" + SM("estCd") + ")" : "") + (row.hits > 1.05 ? " · ×" + row.hits.toFixed(1) : "") : "";
      mid.appendChild(el("div", "hint", esc(info)));
      b.appendChild(mid);
      bars.appendChild(b);
    }
    box.appendChild(bars);
    const fx = r.fx;
    const st = el("div", "simstats");
    st.appendChild(el("div", "", `<span>${esc(SM("dmg"))}</span><b>+${Math.round(fx.dmg)} %</b>`));
    st.appendChild(el("div", "", `<span>${esc(SM("cdr"))}</span><b>${Math.round((1 - fx.cdMul / (1 + fx.cdr / 100)) * 100)} %</b>`));
    st.appendChild(el("div", "", `<span>${esc(SM("crit"))}</span><b>${Math.round(r.crit * 100)} % · ×${r.critMul.toFixed(2)}</b>`));
    st.appendChild(el("div", "", `<span>${esc(SM("echo"))}</span><b>${Math.round(fx.echo)} %</b>`));
    st.appendChild(el("div", "", `<span>${esc(SM("luck"))}</span><b>+${Math.round(fx.luck)} %</b>`));
    st.appendChild(el("div", "", `<span>${esc(SM("area"))}</span><b>+${Math.round(fx.area)} %</b>`));
    box.appendChild(st);
    if (r.allyNotes.length) box.appendChild(el("div", "hint", esc(SM("group") + " : " + r.allyNotes.join(" · "))));
    const notes = [];
    if (fx.notes.pets) notes.push(SM("pets"));
    if (fx.notes.kills) notes.push(SM("kills"));
    if (fx.notes.procs.length) notes.push(SM("procs") + " (" + fx.notes.procs.join(", ") + ")");
    if (notes.length) box.appendChild(el("div", "hint simnotes", esc(SM("notSim") + " : " + notes.join(" · "))));
    const sug = simSuggestions(sc);
    if (sug.length) {
      const sg = el("div", "simsug");
      sg.appendChild(el("h3", "", esc(SM("optimize"))));
      sg.appendChild(el("div", "hint", esc(SM("optimizeHelp"))));
      for (const s of sug) sg.appendChild(el("div", "simsugrow", `<span>${esc(s.text)}</span><b class="good">+${Math.round(s.gain * 100)} %</b>`));
      box.appendChild(sg);
    }
  }
}

function renderSim(sec) {
  sec = sec || $("page-sim");
  if (!SIMDATA) { sec.innerHTML = ""; simLoad().then(() => { if (PAGE === "sim") renderSim(sec); }); return; }
  if (!SIMS.a) { const b = active() || builds(CLASS)[0]; SIMS.a = b ? simFromBuild(b) : simFromBuild(decodePreset(CLASS)); }
  sec.innerHTML = "";
  const top = el("div", "simtop");
  top.appendChild(el("div", "warnline", esc(SM("experimental"))));
  top.appendChild(el("div", "hint", esc(SM("intro"))));
  const cmp = el("label", "simcmp");
  const cb = el("input"); cb.type = "checkbox"; cb.checked = SIMS.compare;
  cb.onchange = () => { SIMS.compare = cb.checked; if (cb.checked && !SIMS.b) SIMS.b = JSON.parse(JSON.stringify(SIMS.a)); renderSim(); };
  cmp.appendChild(cb);
  cmp.appendChild(el("span", "", esc(SM("compare"))));
  top.appendChild(cmp);
  sec.appendChild(top);
  const grid = el("div", "simgrid" + (SIMS.compare ? " two" : ""));
  grid.appendChild(simPanel(SIMS.a, "a"));
  if (SIMS.compare) grid.appendChild(simPanel(SIMS.b, "b"));
  sec.appendChild(grid);
  const mc = el("div", "simmc");
  mc.id = "simmc";
  sec.appendChild(mc);
  renderSimResults();
  mcRender();
}

const MC_LEVEL = [[1, 0], [6, 60], [11, 120], [15, 180], [20, 300], [29, 480], [33, 600], [38, 720], [44, 900], [51, 1080], [55, 1200], [70, 1800]];
const MC_YIELD = [[0, 0.2], [1, 0.23], [2, 0.25], [3, 0.33], [4, 0.41], [5, 0.5], [6, 0.64], [8, 0.86], [10, 1.13], [12, 1.56], [14, 2.09], [16, 2.42], [18, 2.63]];
const MC_RARITY = [[0, [52, 26.1, 13.2, 6.7, 2]], [60, [38, 25.5, 17.6, 13.2, 5.7]], [105, [26.6, 17.9, 22.4, 19.6, 13.5]], [150, [17.5, 14.3, 23.8, 30.2, 14.3]]];
const MC_START = { warrior: ["cleave"], paladin: ["consecration"], hunter: ["auto_shot"], rogue: ["sinister_strike"], priest: ["smite"], shaman: ["lightning_bolt"], mage: ["fireball"], warlock: ["shadow_bolt"], druid: ["wrath"] };
const MC_JEWEL_RATE = 1.92;

function mcLevelAt(t) {
  for (let i = 1; i < MC_LEVEL.length; i++) {
    const [l1, t1] = MC_LEVEL[i - 1], [l2, t2] = MC_LEVEL[i];
    if (t <= t2) return l1 + ((t - t1) / (t2 - t1)) * (l2 - l1);
  }
  return MC_LEVEL[MC_LEVEL.length - 1][0];
}
function mcYield(minute) {
  for (let i = 1; i < MC_YIELD.length; i++) {
    const [m1, y1] = MC_YIELD[i - 1], [m2, y2] = MC_YIELD[i];
    if (minute <= m2) return y1 + ((minute - m1) / (m2 - m1)) * (y2 - y1);
  }
  return MC_YIELD[MC_YIELD.length - 1][1];
}
function mcRarityTable(luck) {
  for (let i = 1; i < MC_RARITY.length; i++) {
    const [a, pa] = MC_RARITY[i - 1], [b, pb] = MC_RARITY[i];
    if (luck <= b) { const f = Math.max(0, (luck - a) / (b - a)); return pa.map((v, j) => v * (1 - f) + pb[j] * f); }
  }
  return MC_RARITY[MC_RARITY.length - 1][1];
}
function mcRoll(table) {
  let x = Math.random() * 100;
  for (let i = 0; i < 5; i++) { x -= table[i]; if (x <= 0) return i; }
  return 4;
}
function mcStartSpells(sc) {
  const c = cls(sc.class);
  const out = new Set(MC_START[sc.class] || []);
  for (const tree of c.trees)
    for (const t of tree.talents) {
      if (!sc.talents[t.key]) continue;
      const m = (t.desc.en || "").match(/[Ss]tart (?:every|each) run with ([A-Z][\w' ]+?)(?: instead of ([A-Z][\w' ]+?))?(?:[,;.]| and )/);
      if (!m) continue;
      const add = c.spells.find((x) => x.name.en === m[1]);
      const drop = m[2] && c.spells.find((x) => x.name.en === m[2]);
      if (drop) out.delete(drop.key);
      if (add) out.add(add.key);
    }
  if (sc.talents.enh_stormbound_echoes) out.add("stormstrike");
  return [...out];
}

function monteCarlo(sc, iters, minutes) {
  const c = cls(sc.class);
  const weights = {};
  sc.spells.forEach((s, i) => (weights[s.key] = s.w || Math.max(1, 6 - i)));
  const res = { dps: [], dmg: [], level: 0, ranks: {}, share: {}, have: {}, curve: new Array(minutes).fill(0), track: [] };
  const fxBase = jewelFx(sc, talentFx(sc));
  const luck = fxBase.luck + ((RACE_FX[sc.race] || {}).luck || 0) + ((sc.gear && sc.gear.luck) || 0);
  const table = mcRarityTable(luck);
  const pool = c.spells.map((x) => x.key).filter((k) => k !== "rockbiter" || sc.talents.rockbiter_initiation);
  const end = minutes * 60;
  for (let it = 0; it < iters; it++) {
    const owned = {};
    for (const k of mcStartSpells(sc)) owned[k] = { key: k, rank: 1, ups: { damage: 0, cooldown: 0, area: 0, targets: 0, duration: 0 }, n: 0 };
    const jew = { rings: [], trinkets: [], amulet: "", ups: 0, jewelUps: {} };
    let level = 1, total = 0, nextJewel = (-Math.log(Math.random()) / MC_JEWEL_RATE) * 60;
    const levelUps = [];
    const xpMul = (RACE_FX[sc.race] || {}).xp || 1;
    for (let t = 0; t < end; t += 1) { const l = Math.floor(mcLevelAt(t * xpMul)); while (level < l) { level++; levelUps.push(t); } }
    let li = 0;
    for (let minute = 0; minute < minutes; minute++) {
      const tEnd = (minute + 1) * 60;
      while (li < levelUps.length && levelUps[li] < tEnd) {
        li++;
        const cards = [];
        for (let k = 0; k < 3; k++) {
          const rar = mcRoll(table);
          const ownedKeys = Object.keys(owned);
          if (ownedKeys.length < 6 && Math.random() < 0.42) {
            const free = pool.filter((p) => !owned[p]);
            cards.push({ type: "new", key: free[Math.floor(Math.random() * free.length)], rar });
          } else cards.push({ type: "up", key: ownedKeys[Math.floor(Math.random() * ownedKeys.length)], rar });
        }
        let best = null, bestScore = 0;
        for (const cd of cards) {
          const w = weights[cd.key] || (owned[cd.key] ? 1.25 : 0);
          const score = w * (1 + 0.5 * cd.rar);
          if (score > bestScore) { bestScore = score; best = cd; }
        }
        if (!best) continue;
        if (best.type === "new") owned[best.key] = { key: best.key, rank: 1, ups: { damage: 0, cooldown: 0, area: 0, targets: 0, duration: 0 }, n: 0 };
        else {
          const o = owned[best.key];
          const def = spellOf(c, o.key);
          const types = (def.upgrades || []).filter((u) => UP_BASE[u]);
          if (!types.length) { o.rank++; continue; }
          const type = types[o.n % types.length];
          o.n++;
          o.rank++;
          const decay = type === "targets" ? 1 : o.rank <= 3 ? 1 : o.rank <= 6 ? 0.67 : o.rank <= 10 ? 0.5 : 0.35;
          o.ups[type] += type === "targets" ? UP_BASE.targets[best.rar] / 3 : UP_BASE[type][best.rar] * decay;
        }
      }
      while (nextJewel < tEnd) {
        nextJewel += (-Math.log(Math.random()) / MC_JEWEL_RATE) * 60;
        for (let k = 0; k < 3; k++) {
          const cat = ["rings", "trinkets", "amulets"][Math.floor(Math.random() * 3)];
          const worn = jew.rings.concat(jew.trinkets);
          if (worn.length && Math.random() < 0.55) { const w = worn[Math.floor(Math.random() * worn.length)]; jew.jewelUps[w] = (jew.jewelUps[w] || 0) + 1; break; }
          if (cat === "amulets" && jew.amulet && Math.random() < 0.45) { jew.ups++; break; }
          if (cat === "amulets") {
            if (!jew.amulet && sc.amulet && Math.random() < 1 / (DATA.amulets.length + 6)) { jew.amulet = sc.amulet; break; }
          } else if (jew[cat].length < 2) {
            const want = sc[cat].filter((x) => !jew[cat].includes(x));
            if (want.length && Math.random() < want.length / DATA[cat].length) { jew[cat].push(want[0]); break; }
          }
        }
      }
      const state = Object.assign({}, sc, { spells: Object.values(owned).map((o) => ({ key: o.key, rank: o.rank, ups: o.ups })), rings: jew.rings, trinkets: jew.trinkets, amulet: jew.amulet, amuletUps: jew.ups, jewelUps: jew.jewelUps, level: li + 1 });
      const r = simulate(state);
      const dps = r.total * mcYield(minute + 1) * ((SIMDATA.cal && SIMDATA.cal.zones && SIMDATA.cal.zones[sc.zone]) || 1);
      total += dps * 60;
      res.curve[minute] += dps / iters;
      const tr = (res.track[minute] = res.track[minute] || { dmg: 0, crit: 0, cd: 0, echo: 0, ranks: 0 });
      tr.dmg += (1 + r.fx.dmg / 100) / iters;
      tr.crit += r.crit / iters;
      tr.cd += r.fx.cdMul / (1 + r.fx.cdr / 100) / iters;
      tr.echo += r.fx.echo / 100 / iters;
      tr.ranks += Object.values(owned).reduce((a, o) => a + o.rank, 0) / iters;
      if (minute === minutes - 1) for (const row of r.rows) res.share[row.key] = (res.share[row.key] || 0) + row.mix / (r.total || 1);
    }
    res.dmg.push(total);
    res.dps.push(total / end);
    res.level += level;
    for (const o of Object.values(owned)) { res.ranks[o.key] = (res.ranks[o.key] || 0) + o.rank; res.have[o.key] = (res.have[o.key] || 0) + 1; }
  }
  const sorted = res.dps.slice().sort((a, b) => a - b);
  const q = (p) => sorted[Math.min(sorted.length - 1, Math.floor(p * sorted.length))];
  return {
    iters, minutes, luck,
    mean: res.dps.reduce((a, b) => a + b, 0) / iters, p10: q(0.1), p50: q(0.5), p90: q(0.9), curve: res.curve, track: res.track,
    hist: sorted, level: res.level / iters,
    spells: [...new Set(Object.keys(res.have).concat(Object.keys(res.share)))].map((k) => ({ key: k, have: (res.have[k] || 0) / iters, rank: res.have[k] ? res.ranks[k] / res.have[k] : 0, share: (res.share[k] || 0) / iters })).sort((a, b) => b.share - a.share),
  };
}

const MC = { iters: 500, minutes: 15, res: {} };

function mcRender() {
  const box = $("simmc");
  if (!box) return;
  box.innerHTML = "";
  const bar = el("div", "simmcbar");
  bar.appendChild(el("b", "", esc(SM("mcTitle"))));
  bar.appendChild(simSelect([100, 500, 2000, 5000].map((v) => [String(v), v + " " + SM("runs")]), String(MC.iters), (v) => (MC.iters = +v)));
  bar.appendChild(simSelect([5, 10, 15, 20, 25, 30].map((v) => [String(v), v + " min"]), String(MC.minutes), (v) => (MC.minutes = +v)));
  const go = el("button", "primary", esc(SM("simulate")));
  go.onclick = () => {
    go.disabled = true;
    go.textContent = SM("running");
    setTimeout(() => {
      const t0 = performance.now();
      MC.res.a = monteCarlo(SIMS.a, MC.iters, MC.minutes);
      MC.res.b = SIMS.compare && SIMS.b ? monteCarlo(SIMS.b, MC.iters, MC.minutes) : null;
      MC.ms = performance.now() - t0;
      mcRender();
    }, 30);
  };
  bar.appendChild(go);
  bar.appendChild(el("span", "hint", esc(SM("mcHelp"))));
  box.appendChild(bar);
  if (!MC.res.a) return;
  const cols = el("div", "simgrid" + (MC.res.b ? " two" : ""));
  for (const which of ["a", "b"]) {
    const r = MC.res[which];
    if (!r) continue;
    const c = cls((which === "a" ? SIMS.a : SIMS.b).class);
    const col = el("div", "simcol mc");
    const tiles = el("div", "simtiles");
    const other = which === "b" ? MC.res.a.mean : null;
    const delta = other ? ' <small class="' + (r.mean >= other ? "good" : "bad") + '">' + (r.mean >= other ? "+" : "") + Math.round((r.mean / other - 1) * 100) + " %</small>" : "";
    tiles.appendChild(el("div", "simtile big", "<span>" + esc(SM("mcMean")) + "</span><b>" + fmtN(r.mean) + delta + "</b>"));
    tiles.appendChild(el("div", "simtile", "<span>" + esc(SM("mcRange")) + "</span><b>" + fmtN(r.p10) + " – " + fmtN(r.p90) + "</b>"));
    tiles.appendChild(el("div", "simtile", "<span>" + esc(SM("mcLevel")) + "</span><b>" + r.level.toFixed(1) + "</b>"));
    col.appendChild(tiles);
    if (which === "b") {
      let win = 0;
      for (let i = 0; i < 2000; i++) if (MC.res.b.hist[Math.floor(Math.random() * MC.res.b.hist.length)] > MC.res.a.hist[Math.floor(Math.random() * MC.res.a.hist.length)]) win++;
      col.appendChild(el("div", "hint", esc(SM("mcWin", { v: Math.round(win / 20) }))));
    }
    const h = r.hist, lo = h[0], hi = h[h.length - 1] || 1, nb = 24, bins = new Array(nb).fill(0);
    for (const v of h) bins[Math.min(nb - 1, Math.floor(((v - lo) / (hi - lo || 1)) * nb))]++;
    const mx = Math.max(...bins);
    const rects = bins.map((b, i) => '<rect x="' + (i * 12 + 1) + '" y="' + (60 - (58 * b) / mx) + '" width="10" height="' + (58 * b) / mx + '" rx="2"></rect>').join("");
    col.appendChild(el("div", "simhistbox", '<svg viewBox="0 0 ' + nb * 12 + ' 60" class="simhist" preserveAspectRatio="none">' + rects + '</svg><div class="hint simhistax"><span>' + fmtN(lo) + "</span><span>" + esc(SM("mcDist")) + "</span><span>" + fmtN(hi) + "</span></div>"));
    const tbl = el("table", "simtbl");
    tbl.innerHTML = "<tr><th></th><th>" + esc(SM("mcHave")) + "</th><th>" + esc(SM("mcRank")) + "</th><th>" + esc(SM("share")) + "</th></tr>" + r.spells.map((x) => { const d = spellOf(c, x.key); return "<tr><td>" + esc(d ? L(d.name) : x.key === "explosions" ? SM("kills") : x.key) + "</td><td>" + Math.round(x.have * 100) + " %</td><td>" + x.rank.toFixed(1) + "</td><td>" + Math.round(x.share * 100) + " %</td></tr>"; }).join("");
    col.appendChild(tbl);
    cols.appendChild(col);
  }
  box.appendChild(cols);
  box.appendChild(el("div", "hint", esc(SM("mcDone", { n: MC.iters * (MC.res.b ? 2 : 1), ms: Math.round(MC.ms) }))));
}
