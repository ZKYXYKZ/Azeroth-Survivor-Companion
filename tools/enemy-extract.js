// Montee en puissance des monstres (AzerothSurvivors 0.139) -> AS-Companion/web/enemies.json
// Lecture statique : chaque constante est lue dans l'exe a partir de l'instruction qui l'utilise
// (adresse VA de l'instruction, operande rip-relatif ou immediat). Si une instruction ne correspond
// plus (autre build), la valeur passe a null et l'adresse est listee dans "missing".
// Usage : node tools/enemy-extract.js [exe] [sortie]
const fs = require("fs");
const path = require("path");
const load = require("./pe.js");
const { Decoder, DecoderOptions, Formatter, FormatterSyntax } = require("iced-x86");

const exe = process.argv[2] || "C:/Users/ludov/Downloads/AzerothSurvivors/AzerothSurvivors/AzerothSurvivors.exe";
const out = process.argv[3] || path.join(__dirname, "..", "AS-Companion", "web", "enemies.json");
const P = load(exe);
const { buf } = P;
const fmt = new Formatter(FormatterSyntax.Nasm);
const missing = [];

function insAt(va) {
  const off = P.toOff(BigInt(va));
  if (off < 0) return null;
  const d = new Decoder(64, buf.subarray(off, off + 16), DecoderOptions.None);
  d.ip = BigInt(va);
  return d.decode();
}
const r4 = (x) => +x.toPrecision(6);
// f32 lu a la cible rip-relative de l'instruction (+4*idx pour une table), mnemonique verifiee
function k(va, mn, idx = 0) {
  const ins = insAt(va);
  const txt = ins ? fmt.format(ins) : "";
  if (!ins || !ins.isIpRelMemoryOperand || (mn && !txt.startsWith(mn))) { missing.push(va.toString(16) + " " + (mn || "") + " / " + txt); return null; }
  const o = P.toOff(ins.ipRelMemoryAddress);
  return o < 0 ? null : r4(buf.readFloatLE(o + 4 * idx));
}
function target(va) {
  const ins = insAt(va);
  if (!ins || !ins.isIpRelMemoryOperand) { missing.push(va.toString(16) + " lea"); return null; }
  return Number(ins.ipRelMemoryAddress);
}
// immediat de l'instruction (mov eax,32h / cmp esi,8 / cmp r15b,2)
function imm(va, mn) {
  const ins = insAt(va);
  const txt = ins ? fmt.format(ins) : "";
  if (!ins || (mn && !txt.startsWith(mn))) { missing.push(va.toString(16) + " " + mn + " / " + txt); return null; }
  const m = txt.match(/,(?:0x)?([0-9A-F]+)h?$/i);
  return m ? parseInt(m[1], /h$/i.test(txt) ? 16 : 10) : null;
}
const neg = (x) => (x == null ? null : -x);

// ---------- zones (meme table que game-extract.js, champs supplementaires) ----------
const rd = P.sec(".rdata");
let zoneStart = -1;
for (let o = rd.raw; o < rd.raw + rd.rs - 256; o += 8) if (P.str(o, 20) === "elwynn" && P.str(o + 16, 40) === "Elwynn Forest") { zoneStart = o; break; }
const zones = {};
for (let z = zoneStart; z > 0; z += 240) {
  const key = P.str(z, 20);
  if (!key || !/^[a-z_]+$/.test(key)) break;
  const en = P.slice(z + 112), bo = P.slice(z + 128);
  const enemies = [];
  for (let i = 0; i < en.len; i++) {
    const o = en.off + i * 80;
    enemies.push({ id: buf.readUInt32LE(o + 32), weight: buf.readUInt32LE(o + 24), hp: r4(buf.readFloatLE(o + 48)), dmg: r4(buf.readFloatLE(o + 52)), speed: r4(buf.readFloatLE(o + 56)),
      cost: r4(buf.readFloatLE(o + 68)), at: r4(buf.readFloatLE(o + 72)), elite: buf[o + 76] === 1 });
  }
  const bosses = [];
  for (let i = 0; i < bo.len; i++) {
    const o = bo.off + i * 104;
    bosses.push({ id: buf.readUInt32LE(o + 64), name: P.str(o, 80), at: r4(buf.readFloatLE(o + 80)), hp: r4(buf.readFloatLE(o + 84)), dmg: r4(buf.readFloatLE(o + 88)), final: buf[o + 100] === 1 });
  }
  zones[key] = { index: Object.keys(zones).length, diff: r4(buf.readFloatLE(z + 216)), growth: r4(buf.readFloatLE(z + 220)), length: r4(buf.readFloatLE(z + 208)), enemies, bosses };
}

// ---------- Heroique : table de 5 lignes de 48 octets (2 &str + 4 f32) ----------
// table trouvee par motif (0.143) : accesseurs du niveau heroique lea eax,[rcx-6] ; cmp al,0FBh ; setb dl ; movzx eax,cl ;
// lea rcx,[rax+rax*2] ; shl ecx,4 ; lea rax,[table] (comme gear-extract.js) ; ligne h = base + 48*h - 48
const hBase = (() => {
  const pat = Buffer.from([0x8d, 0x41, 0xfa, 0x3c, 0xfb, 0x0f, 0x92, 0xc2, 0x0f, 0xb6, 0xc1, 0x48, 0x8d, 0x0c, 0x40, 0xc1, 0xe1, 0x04, 0x48, 0x8d, 0x05]);
  const text = P.sec(".text"), set = new Set();
  for (let at = buf.indexOf(pat, text.raw); at >= 0 && at < text.raw + text.rs; at = buf.indexOf(pat, at + 1)) set.add(Number(P.toVA(at + pat.length)) + 4 + buf.readInt32LE(at + pat.length));
  if (set.size !== 1) { missing.push("table heroique : " + set.size + " candidats"); return null; }
  return [...set][0];
})();
const heroic = [];
if (hBase) for (let h = 1; h <= 5; h++) {
  const row = P.toOff(BigInt(hBase + 48 * h - 48));
  heroic.push({ level: h, affix1: P.str(row), affix2: P.str(row + 16), hp: r4(buf.readFloatLE(row + 32)), dmg: r4(buf.readFloatLE(row + 36)), marks: r4(buf.readFloatLE(row + 40)), rewardBonus: r4(buf.readFloatLE(row + 44)) });
}
const coopK = (va) => [k(va, "lea", 0), k(va, "lea", 1)]; // [zone index >= 3, zone index < 3]

const db = {
  version: "0.139",
  notes: {
    units: "t = minutes de partie (state+0xE88 / 60). m = minutes depuis la mort du boss final (mode sans fin choisi). n = joueurs du lobby coop (state+0xE50), coop = state+0xF46.",
    D: "D = zone.diff * S, S = facteur d'etat (state+0xF14) d'origine non retrouvee (lu partout a cote de zone.diff, sans doute 1 hors modificateurs).",
    H: "H = heroic[h-1].hp ou .dmg, 1 hors heroique (h = state+0x3F7).",
    coopFactor: "coopFactor(a, b) = b * (1 + a * kZone * (n-1)), kZone = coopZoneK[index<3 ? 1 : 0] ; 1 hors coop.",
  },
  horde: {
    formula: {
      hp: "def.hp * (elite ? hpMulElite : hpMulNormal) * (1 + hpT1*t + hpT2*t^2 + (elite ? hpT3Elite : hpT3Normal)*t^3) * D * (1 + zone.growth * min(1, t/growthRampMin)^2) * endlessHpBase^m * H.hp * coopFactor(coopHp, coopHpBase)",
      dmg: "def.dmg * (elite ? 1 : dmgMulNormal) * sqrt(D) * (1 + dmgT1*t + dmgT2*t^2 + dmgT3*t^3) * endlessDmgBase^m * H.dmg",
      speed: "def.speed (aucune montee avec le temps trouvee)",
    },
    hpMulNormal: k(0x145ee540a, "movss"), hpMulElite: k(0x145ee5415, "movss"),
    hpT1: k(0x145f614a0, "movss"), hpT2: k(0x145f614b4, "movss"), hpT3Elite: k(0x145f614c8, "movss"), hpT3Normal: k(0x145f61518, "movss"),
    growthRampMin: k(0x145ee5462, "divss"),
    endlessHpBase: k(0x145ee5495, "movss"),
    coopHp: k(0x145ee5541, "mulss"), coopHpBase: k(0x145ee5551, "mulss"),
    dmgMulNormal: k(0x145ee53ef, "movss"),
    dmgT1: k(0x145ee5723, "movss"), dmgT2: k(0x145ee5738, "movss"), dmgT3: k(0x145ee574e, "movss"),
    endlessDmgBase: k(0x145ee5778, "movss"),
    spawnRadius: [k(0x145ee538c, "movss"), k(0x145ee5394, "movss")],
  },
  spawn: {
    formula: {
      budget: "chaque frame : budget += dt * rate ; tant que budget >= 1 et < maxPerFrame apparitions : on tire un monstre (poids, at <= t) et budget -= def.cost",
      rate: "rate = slow * base * endless * clamp(adaptK * (killed/adaptTau) / max(base*slow*endless, 0.001), adaptMin, adaptMax) * (coop ? 1 + coopRate*kZone*(n-1) : 1)",
      base: "base = rateMul * (rateC0 + rateT1*t + rateT2*t^2)",
      slow: "slow = 1 sans boss ; slowBoss tant qu'un boss est en vie ; slowFinalBoss pour le boss final",
      endless: "endless = endlessRate0 + endlessRateT*m apres le boss final en mode sans fin, sinon 1",
      killed: "killed : somme des def.cost des monstres non elites tues, amortie exp(-dt/adaptTau) (state+0xEC8)",
      cap: "aucune apparition si vivants >= aliveCap * (coop ? 1 + coopCap*kZone*(n-1) : 1)",
      minAlive: "si vivants < min(minAliveMax, (minAlive0 + minAliveT*t) * slow) * (coop ? 1 + coopRate*kZone*(n-1) : 1) : jusqu'a topUpMax apparitions immediates",
      elite: "un elite toutes les max(eliteIntervalMin, eliteInterval0 + eliteIntervalT*t) secondes (Heroique I : par paires)",
      swarm: "une vague toutes les max(swarmIntervalMin, swarmInterval0 + swarmIntervalT*t) s ; taille selon le motif = (a*t + b) * swarmMul * (coop ? 1 + swarmCoop*kZone*(n-1) : 1)",
    },
    rateMul: k(0x145efe253, "mulss"), rateC0: k(0x145efe237, "addss"), rateT1: k(0x145efe22b, "movss"), rateT2: k(0x145efe23f, "movss"),
    slowBoss: k(0x145efe1dc, "movss"), slowFinalBoss: k(0x145efe1d4, "movss"),
    endlessRate0: k(0x145efe29d, "addss"), endlessRateT: k(0x145efe295, "mulss"),
    adaptTau: neg(k(0x145efe177, "divss")), adaptK: k(0x145efe362, "mulss"), adaptMin: k(0x145efe376, "movss"), adaptMax: k(0x145efe387, "movss"),
    coopRate: k(0x145efe403, "mulss"),
    maxPerFrame: imm(0x145efe4b0, "cmp esi"),
    aliveCap: imm(0x145ee5237, "mov eax"), coopCap: k(0x145ee5298, "mulss"),
    minAlive0: k(0x145efe73f, "addss"), minAliveT: k(0x145efe737, "mulss"), minAliveMax: k(0x145efe74b, "minss"), topUpMax: imm(0x145efe7a5, "mov esi"),
    eliteInterval0: k(0x145efebb2, "addss"), eliteIntervalT: k(0x145efebaa, "mulss"), eliteIntervalMin: k(0x145efebba, "maxss"),
    swarmInterval0: k(0x145f00478, "addss"), swarmIntervalT: k(0x145f00470, "mulss"), swarmIntervalMin: k(0x145f00480, "maxss"),
    swarmMul: k(0x145efed8b, "mulss"), swarmCoop: k(0x145efed79, "mulss"),
    // motif 2 : "addss xmm6,xmm6" = 2*t, pas de constante memoire pour le 2
    swarmPatterns: [{ a: k(0x145efef7e, "mulss"), b: k(0x145efef86, "addss") }, { a: 2, b: k(0x145efeff3, "addss") }, { a: k(0x145eff142, "mulss"), b: k(0x145eff14a, "addss") }, { a: k(0x145eff9f6, "mulss"), b: k(0x145eff9fe, "addss") }],
  },
  guardians: {
    count: 4,
    formula: {
      hp: "3 * max(curveA, curveB) * endlessHpBase^m * (1 + slain*perSlainHp[heroic>=wardensLevel]) * H.hp * coopFactor(coopHp, coopHpBase)",
      curveA: "aHp * bossCurve(t) * D ; bossCurve = interpolation lineaire (at, hp) des boss non finaux de la zone, prolongee apres le dernier ; avant le premier : (earlyC0 + earlyT*t/at0) * hp0",
      curveB: "bHp * def.hp * D * (1 + bT1*t + bT2*t^2) (def = monstre de la zone attribue au repaire)",
      dmg: "def.dmg * sqrt(D) * (1 + dT1*t + dT2*t^2) * dMul * endlessDmgBase^m * (1 + slain*perSlainDmg[heroic>=wardensLevel]) * H.dmg",
      refill: "un repaire vide se remplit apres refill[heroic>=wardensLevel] secondes",
      liveRescale: "a chaque gardien tue, les gardiens vivants sont recalcules en gardant leur fraction de PV",
    },
    hpMul: k(0x145f56595, "mulss"), aHp: k(0x145f56524, "mulss"), earlyC0: k(0x145f5662a, "addss"), earlyT: k(0x145f5660f, "movss"),
    bHp: k(0x145f56570, "mulss"), bT1: k(0x145f56537, "movss"), bT2: k(0x145f56550, "movss"),
    endlessHpBase: k(0x145f56446, "movss"), coopHp: k(0x145f564c6, "mulss"), coopHpBase: k(0x145f564d6, "mulss"),
    dT1: k(0x145f56869, "movss"), dT2: k(0x145f5687a, "movss"), dMul: k(0x145f568a5, "mulss"), endlessDmgBase: k(0x145f56815, "movss"),
    wardensLevel: imm(0x145f565a3, "cmp r15b"),
    perSlainHp: [k(0x145f565b5, "lea", 0), k(0x145f565b5, "lea", 1)],
    perSlainDmg: [k(0x145f568c3, "lea", 0), k(0x145f568c3, "lea", 1)],
    refill: [k(0x145ee9584, "lea", 0), k(0x145ee9584, "lea", 1)],
    damageTakenReduction: null,
  },
  bosses: {
    formula: {
      hp: "scale * boss.hp * hpMul * D * endlessHpBase^m * H.hp * coopFactor(coopHp, coopHpBase) ; scale = 1, councilScale pour le boss rappele (Heroique V)",
      dmg: "boss.dmg * sqrt(D) * endlessDmgBase^m * H.dmg",
      timing: "boss.at en minutes ; aucune montee pendant le combat trouvee",
    },
    hpMul: k(0x145efbf42, "mulss"), endlessHpBase: k(0x145efbd55, "movss"), endlessDmgBase: k(0x145efbd41, "movss"),
    coopHp: k(0x145efbf2a, "mulss"), coopHpBase: k(0x145efbf3a, "mulss"), councilScale: k(0x145f00587, "movss"),
  },
  coopZoneK: coopK(0x145ee528c),
  heroic,
  runModifiers: { density: null, health: null, damage: null, speed: null, note: "4 curseurs du menu Difficulte (runmods.rs) : valeurs non retrouvees" },
  stateScaleF14: null,
  zones,
  missing,
};

fs.writeFileSync(out, JSON.stringify(db, null, 1) + "\n");
console.log(`${Object.keys(zones).length} zones, ${heroic.length} niveaux heroiques, ${missing.length} constantes manquantes -> ${path.relative(process.cwd(), out)}`);
if (missing.length) console.log(missing.join("\n"));
