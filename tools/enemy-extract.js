// Montee en puissance des monstres (AzerothSurvivors 0.143) -> AS-Companion/web/enemies.json
// Lecture statique sans adresse codee en dur : chaque fonction est trouvee par l'empreinte de ses constantes
// flottantes (valeurs 0.139, la fonction .pdata qui en contient le plus, avec une marge nette sur la suivante),
// puis chaque constante par la forme des instructions qui l'utilisent (suite d'expressions sur le texte
// desassemble, operande rip-relatif note K). Motif absent ou ambigu : valeur null et entree dans "missing".
// Usage : node tools/enemy-extract.js [exe] [sortie]
const fs = require("fs");
const path = require("path");
const load = require("./pe.js");
const locate = require("./locate.js");
const { Decoder, DecoderOptions, Formatter, FormatterSyntax } = require("iced-x86");

const exe = process.argv[2] || "C:/Users/ludov/Downloads/AzerothSurvivors/AzerothSurvivors/AzerothSurvivors.exe";
const out = process.argv[3] || path.join(__dirname, "..", "AS-Companion", "web", "enemies.json");
const P = load(exe);
const L = locate(P);
const { buf, ib } = P;
const fmt = new Formatter(FormatterSyntax.Nasm);
fmt.ripRelativeAddresses = true;
fmt.hexPrefix = "0x";
fmt.hexSuffix = "";
const missing = [];
const r4 = (x) => +x.toPrecision(6);
const text = P.sec(".text"), pd = P.sec(".pdata");
const textVA = Number(ib) + text.va;

// ---------- outils ----------
// essai : en cas d'echec la valeur est null et le motif part dans "missing"
function tryGet(what, f) {
  try { return f(); } catch (e) { missing.push(what + " : " + e.message); return null; }
}
const fail = (m) => { throw new Error(m); };

// fonctions .pdata triees (recherche dichotomique)
const fns = [];
for (let o = pd.raw; o < pd.raw + pd.rs; o += 12) { const s = buf.readUInt32LE(o), e = buf.readUInt32LE(o + 4); if (s) fns.push([s + Number(ib), e + Number(ib)]); }
fns.sort((a, b) => a[0] - b[0]);
function fnOf(va) {
  let lo = 0, hi = fns.length - 1;
  while (lo <= hi) { const m = (lo + hi) >> 1; if (fns[m][0] > va) hi = m - 1; else if (fns[m][1] <= va) lo = m + 1; else return fns[m]; }
  return null;
}
// sites SSE scalaires rip-relatifs (movss/addss/mulss/subss/minss/divss/maxss), lus octet par octet
const sites = [];
{
  const OPS = new Set([0x10, 0x58, 0x59, 0x5c, 0x5d, 0x5e, 0x5f]);
  for (let i = text.raw; i < text.raw + text.rs - 8; i++) {
    if (buf[i] !== 0xf3) continue;
    let j = i + 1;
    if ((buf[j] & 0xf0) === 0x40) j++;
    if (buf[j] !== 0x0f || !OPS.has(buf[j + 1]) || (buf[j + 2] & 0xc7) !== 5) continue;
    const va = textVA + (j + 3 - text.raw), o = P.toOff(va + 4 + buf.readInt32LE(j + 3));
    if (o >= 0) sites.push([textVA + (i - text.raw), r4(buf.readFloatLE(o))]);
  }
}
// fonction qui contient le plus de ces valeurs (au moins 60 %, et 1,5 fois plus que la suivante)
function fnByValues(vals, what) {
  const set = new Set(vals), score = new Map();
  for (const [va, v] of sites) {
    if (!set.has(v)) continue;
    const f = fnOf(va);
    if (!f) continue;
    if (!score.has(f)) score.set(f, new Set());
    score.get(f).add(v);
  }
  const best = [...score].map(([f, s]) => [f, s.size]).sort((a, b) => b[1] - a[1]);
  if (!best.length || best[0][1] < Math.ceil(0.6 * set.size) || (best[1] && best[1][1] * 1.5 > best[0][1]))
    fail(what + " : empreinte ambigue (" + best.slice(0, 2).map((b) => b[1]).join(" / ") + " sur " + set.size + ")");
  return best[0][0];
}
// desassemblage : [{ip, t, ins}] ; t = texte Nasm, operande rip-relatif remplace par K
function dec(start, end) {
  const off = P.toOff(start), lst = [];
  const d = new Decoder(64, buf.subarray(off, off + (end - start)), DecoderOptions.None);
  d.ip = BigInt(start);
  while (d.canDecode) {
    const ins = d.decode();
    lst.push({ ip: Number(ins.ip), t: fmt.format(ins).replace(/\[rip[+-]0x[0-9A-F]+\]/, "K"), ins });
  }
  return lst;
}
function decFn(f) { return dec(f[0], f[1]); }
// fonction feuille sans .pdata : jusqu'au premier ret
function decLeaf(va) {
  const lst = dec(va, va + 0x200), k = lst.findIndex((x) => x.t === "ret");
  if (k < 0) fail("ret introuvable a 0x" + va.toString(16));
  return lst.slice(0, k + 1);
}
// suites d'instructions consecutives qui correspondent aux expressions ; renvoie toutes les occurrences
// une expression ecrite "=..." exige le meme registre de destination que l'instruction precedente
function scan(F, pats) {
  const res = [];
  for (let i = 0; i + pats.length <= F.length; i++) {
    let ok = true;
    for (let j = 0; j < pats.length && ok; j++) ok = pats[j].test(F[i + j].t) && (!pats[j].same || dst(F[i + j]) === dst(F[i + j - 1]));
    if (ok) res.push(F.slice(i, i + pats.length));
  }
  return res;
}
const dst = (e) => e.t.split(/[ ,]/)[1];
// occurrence unique (n occurrences attendues si n est donne)
function find(F, pats, what, n = 1) {
  const r = scan(F, pats);
  if (r.length !== n) fail(what + " : " + r.length + " occurrences (" + n + " attendue" + (n > 1 ? "s" : "") + ")");
  return n === 1 ? r[0] : r;
}
// toutes les occurrences doivent donner la meme valeur
function same(F, pats, what, get) {
  const r = scan(F, pats);
  if (!r.length) fail(what + " : motif absent");
  const vs = r.map((m) => JSON.stringify(get(m)));
  if (new Set(vs).size !== 1) fail(what + " : valeurs differentes " + [...new Set(vs)].join(" / "));
  return get(r[0]);
}
// f32 a la cible rip-relative (+4*idx pour une table)
function kv(e, idx = 0) {
  if (!e.ins.isIpRelMemoryOperand) fail("pas d'operande rip-relatif : " + e.t);
  return r4(buf.readFloatLE(P.toOff(e.ins.ipRelMemoryAddress) + 4 * idx));
}
const ripVA = (e) => Number(e.ins.ipRelMemoryAddress);
// immediat en fin d'instruction (mov eax,0x32 / cmp esi,8 / cmp r15b,2)
function imm(e) { const m = e.t.match(/,(0x[0-9A-F]+|\d+)$/); if (!m) fail("pas d'immediat : " + e.t); return Number(m[1]); }
// deplacement d'un operande memoire [reg+0x...]
function disp(e) { const m = e.t.match(/\[\w+\+(0x[0-9A-F]+)\]/); if (!m) fail("pas de deplacement : " + e.t); return Number(m[1]); }
const hex = (x) => (x == null ? null : "0x" + x.toString(16).toUpperCase());
const branch = (e) => Number(e.t.match(/(0x[0-9A-F]+)$/)[1]);
const at = (F, va) => { const k = F.findIndex((x) => x.ip === va); if (k < 0) fail("cible 0x" + va.toString(16) + " hors fonction"); return k; };
const neg = (x) => (x == null ? null : -x);
const X = "xmm\\d+";
const R = (s) => { const same = s[0] === "=", r = new RegExp("^" + s.slice(same ? 1 : 0).replace(/X/g, X) + "$"); r.same = same; return r; };

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
if (!Object.keys(zones).length) missing.push("table des zones introuvable");

// ---------- Heroique : table de 5 lignes de 48 octets (2 &str + 4 f32) ----------
// accesseurs du niveau heroique lea eax,[rcx-6] ; cmp al,0FBh ; setb dl ; movzx eax,cl ; lea rcx,[rax+rax*2] ; shl ecx,4 ;
// lea rax,[table] (comme gear-extract.js) ; ligne h = base + 48*h - 48
const hBase = (() => {
  const pat = Buffer.from([0x8d, 0x41, 0xfa, 0x3c, 0xfb, 0x0f, 0x92, 0xc2, 0x0f, 0xb6, 0xc1, 0x48, 0x8d, 0x0c, 0x40, 0xc1, 0xe1, 0x04, 0x48, 0x8d, 0x05]);
  const set = new Set();
  for (let a = buf.indexOf(pat, text.raw); a >= 0 && a < text.raw + text.rs; a = buf.indexOf(pat, a + 1)) set.add(Number(P.toVA(a + pat.length)) + 4 + buf.readInt32LE(a + pat.length));
  if (set.size !== 1) { missing.push("table heroique : " + set.size + " candidats"); return null; }
  return [...set][0];
})();
const heroic = [];
if (hBase) for (let h = 1; h <= 5; h++) {
  const row = P.toOff(BigInt(hBase + 48 * h - 48));
  heroic.push({ level: h, affix1: P.str(row), affix2: P.str(row + 16), hp: r4(buf.readFloatLE(row + 32)), dmg: r4(buf.readFloatLE(row + 36)), marks: r4(buf.readFloatLE(row + 40)), rewardBonus: r4(buf.readFloatLE(row + 44)) });
}

// ---------- fonctions, par empreinte (valeurs 0.139) ----------
const FA = tryGet("fonction apparition d'un monstre", () => decFn(fnByValues([4.95, 4.8, 1.22, 1.096, 0.72, 0.8, 1.25, 0.07, 0.015, 0.0002, 26, 36, 20, 0.312, 50], "apparition")));
const FR = tryGet("fonction debit d'apparition", () => decFn(fnByValues([0.32, 0.9, 0.025, 0.6, 0.45, 0.3, 1.5, 0.1], "debit")));
const FC = tryGet("fonction tic des apparitions", () => decFn(fnByValues([-12, 12, 1.25, 0.001, 3, 0.312, 1.6, 4, 36, -2.5, 55, 25, -1.5, 60, 35, 2.5, 10, 0.8, 5, 1.5, 0.6, 0.45, 0.3], "tic")));
const FG = tryGet("fonction PV des gardiens", () => decFn(fnByValues([0.6, 0.12, 0.009, 2.5, 3, 1.22, 1.04, 0.8, 0.4, 0.001], "PV gardiens")));
const FGd = tryGet("fonction degats des gardiens", () => decFn(fnByValues([0.08, 0.004, 1.4, 1.096], "degats gardiens")));
const FB = tryGet("fonction apparition d'un boss", () => decFn(fnByValues([5.75, 1.04, 0.8, 1.22, 1.096, 24, 28], "boss")));
const no = (F) => F || fail("fonction non trouvee");

// ---------- Mode Hyper ----------
// bloc commun (apparition, debit, tic, gardiens) : cap = boss[4].at * capK (repli capFallback sans boss final) ;
// t = temps/60 ; si drapeau : t = 2*min(t, cap) + max(0, t - cap) (horloge des monstres doublee jusqu'au boss final)
// ancre : cmp byte [drapeau],1 ; jne ; min(t, cap) (avec garde NaN) ; addss x,x (le 2) ; max(t - cap, 0) ; addss ;
// en remontant (12 instructions au plus) : divss t,K (60), movss t,[etat+temps], movss cap,K (repli), mulss cap,K <- movss cap,[boss+at]
const hyperPat = ["cmp byte \\[\\w+\\+0x[0-9A-F]+\\],1", "jne short 0x[0-9A-F]+", "movaps X,X", "minss X,X", "movaps X,X", "cmpunordss X,X", "movaps X,X", "andnps X,X",
  "andps X,X", "orps X,X", "addss (X),\\1", "subss X,X", "xorps X,X", "maxss X,X", "addss X,X"].map(R);
function hyperBlock(F, what) {
  return same(F, hyperPat, what + " : bloc Hyper", (m) => {
    const k = at(F, m[0].ip), back = F.slice(Math.max(0, k - 12), k).reverse();
    const g = (re) => { const i = back.findIndex((x) => re.test(x.t)); if (i < 0) fail(what + " : " + re + " absent avant le bloc Hyper"); return back[i]; };
    const mul = g(R("mulss X,K")), j = at(F, mul.ip);
    if (!/^movss xmm\d+,\[\w+\+0x[0-9A-F]+\]$/.test(F[j - 1].t)) fail(what + " : minute du boss final non lue avant " + mul.t);
    return { bossAtOff: disp(F[j - 1]), capK: kv(mul), capFallback: kv(g(R("movss X,K"))), timeOff: disp(g(R("movss X,\\[(?:rsi|r12)\\+0x[0-9A-F]+\\]"))), perMin: kv(g(R("divss X,K"))), flag: disp(m[0]), timeFactor: 2 };
  });
}
const hyperSites = {};
for (const [k, F] of [["apparition", FA], ["debit", FR], ["tic", FC], ["gardiensPV", FG], ["gardiensDegats", FGd]]) hyperSites[k] = tryGet("hyper " + k, () => hyperBlock(no(F), k));
const hyperRef = Object.values(hyperSites).find((x) => x);
for (const [k, h] of Object.entries(hyperSites)) if (h && hyperRef && JSON.stringify(h) !== JSON.stringify(hyperRef)) missing.push("hyper " + k + " : bloc different " + JSON.stringify(h));
const HF = hyperRef ? hyperRef.flag : null;
const hflag = HF == null ? "0x[0-9A-F]+" : "0x" + HF.toString(16).toUpperCase();
// boss : at * bossAtK si Hyper (tic des apparitions : movss X,[boss+0x50] ; cmp byte [etat+drapeau],0 ; je ; mulss X,K)
const hyperBossAtK = tryGet("hyper : minute des boss", () => same(no(FC), [R("movss X,\\[\\w+\\+0x50\\]"), R("cmp byte \\[\\w+\\+" + hflag + "\\],0"), R("je short 0x[0-9A-F]+"), R("mulss X,K")], "minute des boss", (m) => kv(m[3])));
// retour des boss en sans fin : cmp byte [drapeau],0 ; jne H ; movss xmm0,K (normal) ; jmp ; ... H: movss xmm0,K (Hyper) ; addss xmm0,[temps]
const endlessBoss = tryGet("hyper : retour des boss en sans fin", () => {
  const F = no(FC), m = find(F, [R("cmp byte \\[\\w+\\+" + hflag + "\\],0"), R("jne short 0x[0-9A-F]+"), R("movss xmm0,K"), R("jmp short 0x[0-9A-F]+")], "retour des boss");
  const h = F[at(F, branch(m[1]))];
  if (!/^movss xmm0,K$/.test(h.t) || !/^addss xmm0,\[\w+\+0x[0-9A-F]+\]$/.test(F[at(F, h.ip) + 1].t)) fail("branche Hyper inattendue : " + h.t);
  return { normal: kv(m[2]), hyper: kv(h) };
});
// repaires des gardiens : delai refill[heroique >= 2] (table), divise par un K si Hyper. Motif d'octets :
// setae dl ; lea r8,[table] ; movss xmm0,[r8+rdx*4] puis le test du drapeau Hyper et la branche (movss xmm1,K ; divss xmm0,xmm1)
const refill = tryGet("gardiens : delai des repaires", () => {
  const pat = Buffer.from([0x0f, 0x93, 0xc2, 0x4c, 0x8d, 0x05]), tail = Buffer.from([0xf3, 0x41, 0x0f, 0x10, 0x04, 0x90]), hits = [];
  for (let a = buf.indexOf(pat, text.raw); a >= 0 && a < text.raw + text.rs; a = buf.indexOf(pat, a + 1)) if (buf.subarray(a + 10, a + 16).equals(tail)) hits.push(Number(P.toVA(a)));
  const r = [];
  for (const va of hits) {
    // instruction precedente : cmp byte [etat+heroique],n de 7 a 9 octets
    const c = [7, 8, 9].map((n) => dec(va - n, va)).find((d) => d.length === 1 && /^cmp byte \[\w+\+0x[0-9A-F]+\],(0x[0-9A-F]+|\d+)$/.test(d[0].t));
    if (!c) continue;
    const F = [c[0], ...dec(va, va + 48)], k = 1;
    if (!new RegExp("^cmp byte \\[\\w+\\+" + hflag + "\\],0$").test(F[k + 3].t) || !/^jne near/.test(F[k + 4].t)) continue;
    const H = dec(branch(F[k + 4]), branch(F[k + 4]) + 16);
    if (!/^movss xmm1,K$/.test(H[0].t) || H[1].t !== "divss xmm0,xmm1") continue;
    r.push({ level: imm(F[k - 1]), table: [kv(F[k + 1], 0), kv(F[k + 1], 1)], hyperDiv: kv(H[0]) });
  }
  if (r.length !== 1) fail(r.length + " occurrences");
  return r[0];
});

// ---------- horde : PV et degats a l'apparition ----------
const H = {};
tryGet("horde : plafond de vivants", () => {
  const F = no(FA), m = find(F, [R("mov eax,(0x[0-9A-F]+|\\d+)"), R("cmp byte \\[rsi\\+0x[0-9A-F]+\\],1"), R("jne near 0x[0-9A-F]+")], "plafond");
  H.aliveCap = imm(m[0]);
});
const coopChain = (F, last, what) => find(F, [R("lea rax,K"), R("mulss X,\\[rax\\+rcx\\*4\\]"), R("mulss X,K"), R("addss X,K"), R("mulss X,K"), R(last)], what);
tryGet("horde : coop du plafond", () => {
  const m = coopChain(no(FA), "call 0x[0-9A-F]+", "coop du plafond");
  H.coopZoneK = [kv(m[0], 0), kv(m[0], 1)];
  H.coopCap = kv(m[2]);
  if (kv(m[4]) !== H.aliveCap) fail("plafond flottant " + kv(m[4]) + " different de " + H.aliveCap);
});
tryGet("horde : coop des PV", () => { const m = coopChain(no(FA), "movss X,\\[\\w+\\+0x[0-9A-F]+\\]", "coop des PV"); H.coopHp = kv(m[2]); H.coopHpBase = kv(m[4]); });
tryGet("horde : rayon d'apparition", () => { const m = find(no(FA), [R("movss xmm2,K"), R("movss xmm3,K"), R("mov rdx,rsi"), R("call 0x[0-9A-F]+")], "rayon"); H.spawnRadius = [kv(m[0]), kv(m[1])]; });
let poly = null;
tryGet("horde : multiplicateurs normal/elite", () => {
  const m = find(no(FA), [R("movss X,K"), R("movss \\[rbp\\+0x[0-9A-F]+\\],X"), R("jne short 0x[0-9A-F]+"), R("movss X,K"), R("jmp short 0x[0-9A-F]+"), R("movss X,K"), R("lea rax,K"), R("lea rcx,K"), R("cmovne rcx,rax")], "multiplicateurs");
  H.dmgMulNormal = kv(m[0]); H.hpMulNormal = kv(m[3]); H.hpMulElite = kv(m[5]);
  poly = { elite: ripVA(m[6]), normal: ripVA(m[7]) };
});
// polynome des PV : fonctions feuilles (1 + T1*t + T2*t^2 + T3*t^3) * D, l'une pour les elites, l'autre pour les normaux
const polyPat = [R("movss xmm2,K"), R("mulss xmm2,xmm0"), R("addss xmm2,K"), R("movss xmm3,K"), R("mulss xmm3,xmm0"), R("mulss xmm3,xmm0"), R("addss xmm3,xmm2"),
  R("movss xmm2,K"), R("mulss xmm2,xmm0"), R("mulss xmm2,xmm0"), R("mulss xmm0,xmm2"), R("addss xmm0,xmm3"), R("mulss xmm0,xmm1"), R("ret")];
tryGet("horde : polynome des PV", () => {
  if (!poly) fail("adresses des polynomes inconnues");
  const e = find(decLeaf(poly.elite), polyPat, "polynome elite"), n = find(decLeaf(poly.normal), polyPat, "polynome normal");
  if (kv(e[0]) !== kv(n[0]) || kv(e[3]) !== kv(n[3])) fail("termes t et t^2 differents entre elites et normaux");
  Object.assign(H, { hpT1: kv(n[0]), hpT2: kv(n[3]), hpT3Elite: kv(e[7]), hpT3Normal: kv(n[7]) });
});
tryGet("horde : rampe de croissance", () => { const m = find(no(FA), [R("call rcx"), R("mulss X,X"), R("movaps X,X"), R("divss X,K")], "rampe"); H.growthRampMin = kv(m[3]); });
tryGet("horde : PV sans fin", () => { const m = find(no(FA), [R("movss xmm0,K"), R("movaps xmm1,X"), R("call 0x[0-9A-F]+")], "PV sans fin"); H.endlessHpBase = kv(m[0]); });
tryGet("horde : degats sans fin", () => { const m = find(no(FA), [R("movss xmm0,K"), R("movss xmm1,\\[rbp\\+0x[0-9A-F]+\\]"), R("call 0x[0-9A-F]+")], "degats sans fin"); H.endlessDmgBase = kv(m[0]); });
tryGet("horde : polynome des degats", () => {
  const m = find(no(FA), [R("movss X,K"), R("mulss X,X"), R("addss X,K"), R("movss X,K"), R("mulss X,X"), R("mulss X,X"), R("addss X,X"), R("movss X,K"), R("mulss X,X"), R("mulss X,X"), R("mulss X,X"), R("addss X,X"), R("sqrtss X,X")], "polynome des degats");
  Object.assign(H, { dmgT1: kv(m[0]), dmgT2: kv(m[3]), dmgT3: kv(m[7]) });
});
// facteur d'etat S lu a cote de zone.diff (+0xE0 de la ligne de zone)
const SOff = tryGet("facteur d'etat S", () => same(no(FA), [R("movss X,\\[\\w+\\+0xE0\\]"), R("mulss X,\\[rsi\\+0x[0-9A-F]+\\]")], "S", (m) => disp(m[1])));

// ---------- debit d'apparition ----------
const S = {};
tryGet("debit : ralentissement par les boss", () => {
  const m = find(no(FR), [R("movss xmm3,K"), R("movss xmm0,K"), R("movss xmm4,K"), R("jmp 0x[0-9A-F]+")], "ralentissement");
  S.slowFinalBoss = kv(m[1]); S.slowBoss = kv(m[2]);
});
tryGet("debit : base", () => {
  const m = find(no(FR), [R("movss xmm3,K"), R("movss xmm4,K"), R("mulss xmm4,X"), R("addss xmm4,K"), R("movss xmm0,K"), R("mulss xmm0,X"), R("mulss xmm0,X"), R("addss xmm0,xmm4"), R("mulss xmm0,K")], "base");
  Object.assign(S, { rateMul: kv(m[8]), rateC0: kv(m[3]), rateT1: kv(m[1]), rateT2: kv(m[4]) });
});
tryGet("debit : sans fin", () => {
  const m = find(no(FR), [R("divss xmm1,K"), R("xorps X,X"), R("maxss xmm1,X"), R("mulss xmm1,K"), R("addss xmm1,K"), R("jmp short 0x[0-9A-F]+"), R("movss xmm1,K")], "sans fin");
  S.endlessRate0 = kv(m[4]); S.endlessRateT = kv(m[3]); S.endlessRateBeforeKill = kv(m[6]);
});
// ---------- tic des apparitions ----------
tryGet("tic : amortissement des morts", () => { const m = find(no(FC), [R("divss xmm0,K"), R("call 0x[0-9A-F]+"), R("movaps X,xmm0"), R("mulss X,\\[r12\\+0x[0-9A-F]+\\]")], "amortissement"); S.adaptTau = neg(kv(m[0])); });
tryGet("tic : adaptation", () => {
  const m = find(no(FC), [R("divss X,K"), R("mulss X,K"), R("mov rcx,r12"), R("call 0x[0-9A-F]+"), R("maxss xmm0,K")], "adaptation");
  if (kv(m[0]) !== S.adaptTau) fail("constante de temps " + kv(m[0]) + " different de " + S.adaptTau);
  S.adaptK = kv(m[1]);
  const b = find(no(FC), [R("movss X,K"), R("movaps xmm0,X"), R("maxss xmm0,X"), R("movss X,K"), R("movaps X,X"), R("minss X,xmm0")], "bornes d'adaptation");
  S.adaptMin = kv(b[0]); S.adaptMax = kv(b[3]);
});
tryGet("tic : coop du debit", () => { const m = find(no(FC), [R("lea rax,K"), R("mulss xmm0,\\[rax\\+rcx\\*4\\]"), R("mulss xmm0,K"), R("addss xmm0,K"), R("mulss X,xmm0")], "coop du debit"); S.coopRate = kv(m[2]); });
tryGet("tic : apparitions par frame", () => { const m = find(no(FC), [R("cmp esi,(0x[0-9A-F]+|\\d+)"), R("jae near 0x[0-9A-F]+"), R("movss xmm3,\\[rbp\\+0x[0-9A-F]+\\]")], "par frame"); S.maxPerFrame = imm(m[0]); });
S.aliveCap = H.aliveCap ?? null; S.coopCap = H.coopCap ?? null;
tryGet("tic : minimum de vivants", () => {
  const m = find(no(FC), [R("mulss xmm7,K"), R("addss xmm7,K"), R("mulss xmm7,X"), R("minss xmm7,K")], "minimum de vivants");
  Object.assign(S, { minAlive0: kv(m[1]), minAliveT: kv(m[0]), minAliveMax: kv(m[3]) });
  const c = find(no(FC), [R("lea rax,K"), R("mulss xmm0,\\[rax\\+rcx\\*4\\]"), R("mulss xmm0,K"), R("addss xmm0,K"), R("test r12,r12")], "coop du minimum");
  if (kv(c[2]) !== S.coopRate) fail("coop du minimum " + kv(c[2]) + " different du debit");
  S.topUpMax = imm(find(no(FC), [R("cmp r8,(0x[0-9A-F]+|\\d+)"), R("mov esi,(0x[0-9A-F]+|\\d+)"), R("cmovb rsi,r8")], "complement")[1]);
});
// intervalles : max(min, i0 + iT*t) ; 2 occurrences dans l'ordre elite puis vague
tryGet("tic : intervalles elite et vague", () => {
  const [e, w] = find(no(FC), [R("mulss X,K"), R("=addss X,K"), R("=maxss X,K"), R("=addss X,xmm0"), R("movss \\[r12\\+0x[0-9A-F]+\\],X")], "intervalles", 2);
  Object.assign(S, { eliteInterval0: kv(e[1]), eliteIntervalT: kv(e[0]), eliteIntervalMin: kv(e[2]), swarmInterval0: kv(w[1]), swarmIntervalT: kv(w[0]), swarmIntervalMin: kv(w[2]) });
});
tryGet("tic : taille des vagues", () => {
  const m = find(no(FC), [R("mulss X,K"), R("=addss X,K"), R("=mulss X,K"), R("mov r8,\\[rbp\\+0x[0-9A-F]+\\]")], "taille des vagues");
  S.swarmCoop = kv(m[0]); S.swarmMul = kv(m[2]);
  // motifs : (a*t + b) ; motif 2 en "addss x,x" (a = 2) ; motifs 1 et 3 dans l'ordre du code, motif 4 compare a une grille
  const ab = find(no(FC), [R("mulss xmm6,K"), R("addss xmm6,K"), R("mulss xmm6,xmm8")], "motifs a*t+b", 2);
  const p2 = same(no(FC), [R("addss xmm6,xmm6"), R("addss xmm6,K"), R("mulss xmm6,xmm8")], "motif 2t+b", (x) => kv(x[1]));
  const p4 = same(no(FC), [R("mulss xmm1,K"), R("addss xmm1,K"), R("ucomiss xmm2,xmm1")], "motif 4", (x) => [kv(x[0]), kv(x[1])]);
  S.swarmPatterns = [{ a: kv(ab[0][0]), b: kv(ab[0][1]) }, { a: 2, b: p2 }, { a: kv(ab[1][0]), b: kv(ab[1][1]) }, { a: p4[0], b: p4[1] }];
});

// ---------- gardiens ----------
const G = { count: 4 };
tryGet("gardiens : PV", () => {
  const m = find(no(FG), [R("mulss X,K"), R("mulss X,X"), R("mulss X,X"), R("movss X,K"), R("mulss X,X"), R("movss X,K"), R("addss X,X"), R("movss X,K"), R("mulss X,X"), R("mulss X,X"),
    R("addss X,X"), R("mulss X,X"), R("mulss X,X"), R("mulss X,K"), R("movaps X,X"), R("maxss X,X"), R("movaps X,X"), R("cmpunordss X,X"), R("movaps X,X"), R("andnps X,X"), R("andps X,X"),
    R("orps X,X"), R("mulss X,K"), R("mulss X,X"), R("xor eax,eax"), R("cmp r\\w+,(0x[0-9A-F]+|\\d+)"), R("setae al")], "PV des gardiens");
  Object.assign(G, { hpMul: kv(m[22]), aHp: kv(m[0]), bHp: kv(m[13]), bT1: kv(m[3]), bT2: kv(m[7]), wardensLevel: imm(m[25]) });
  const t = find(no(FG), [R("lea rcx,K"), R("mulss X,\\[rcx\\+rax\\*4\\]")], "table par gardien tue (PV)");
  G.perSlainHp = [kv(t[0], 0), kv(t[0], 1)];
  const e = find(no(FG), [R("movss X,K"), R("mulss X,X"), R("maxss xmm0,K"), R("divss X,xmm0"), R("addss X,K")], "avant le premier boss");
  G.earlyC0 = kv(e[4]); G.earlyT = kv(e[0]);
  G.endlessHpBase = kv(find(no(FG), [R("movss xmm0,K"), R("movaps xmm1,X"), R("call 0x[0-9A-F]+")], "PV sans fin")[0]);
  const c = find(no(FG), [R("lea rax,K"), R("mulss X,\\[rax\\+rcx\\*4\\]"), R("mulss X,K"), R("addss X,K"), R("mulss X,K")], "coop");
  G.coopHp = kv(c[2]); G.coopHpBase = kv(c[4]);
});
tryGet("gardiens : degats", () => {
  const m = find(no(FGd), [R("movss X,K"), R("mulss X,X"), R("addss X,X"), R("movss X,K"), R("mulss X,X"), R("mulss X,X"), R("addss X,X"), R("mulss X,X"), R("xorps X,X"), R("sqrtss X,X"),
    R("mulss X,X"), R("mulss X,X"), R("mulss X,K")], "degats des gardiens");
  Object.assign(G, { dT1: kv(m[0]), dT2: kv(m[3]), dMul: kv(m[12]) });
  G.endlessDmgBase = kv(find(no(FGd), [R("movss xmm0,K"), R("call 0x[0-9A-F]+")], "degats sans fin")[0]);
  const t = find(no(FGd), [R("lea rax,K"), R("mulss xmm0,\\[rax\\+rdx\\*4\\]")], "table par gardien tue (degats)");
  G.perSlainDmg = [kv(t[0], 0), kv(t[0], 1)];
});
if (refill) G.refill = refill.table;
G.damageTakenReduction = null;

// ---------- boss ----------
const B = {};
tryGet("boss : PV", () => {
  const m = find(no(FB), [R("mulss X,K"), R("addss X,K"), R("mulss X,K"), R("mulss X,K"), R("mulss X,X")], "PV des boss");
  B.hpMul = kv(m[3]); B.coopHp = kv(m[0]); B.coopHpBase = kv(m[2]);
  const e = find(no(FB), [R("movss xmm0,K"), R("movaps xmm1,X"), R("call 0x[0-9A-F]+"), R("movaps xmm7,xmm0"), R("movss xmm0,K"), R("movaps xmm1,X"), R("call 0x[0-9A-F]+")], "boss sans fin");
  B.endlessDmgBase = kv(e[0]); B.endlessHpBase = kv(e[4]);
});
// boss rappele (Heroique V) : tirage d'un boss puis appel avec l'echelle en xmm2
tryGet("boss : conseil", () => { B.councilScale = kv(find(no(FC), [R("add rbx,rax"), R("movss xmm2,K"), R("mov rcx,r12"), R("mov rdx,rbx"), R("call 0x[0-9A-F]+")], "conseil")[1]); });

// ---------- sortie ----------
const pick = (o, ks) => Object.fromEntries(ks.map((k) => [k, o[k] ?? null]));
const st = (x) => (x == null ? "?" : hex(x));
const hy = hyperRef || {};
const db = {
  version: "0.143",
  notes: {
    units: `t = minutes de partie (state+${st(hy.timeOff)} / ${hy.perMin ?? 60}), horloge des monstres (voir hyper). m = minutes depuis la mort du boss final (mode sans fin choisi), jamais accelere. n = joueurs du lobby coop.`,
    D: `D = zone.diff * S, S = facteur d'etat (state+${st(SOff)}), 1 a la creation de la partie ; ecriture non retrouvee (sans doute le curseur Enemy health, dont le texte dit horde, elites, gardiens et boss : exactement les lecteurs de S).`,
    H: "H = heroic[h-1].hp ou .dmg, 1 hors heroique.",
    coopFactor: "coopFactor(a, b) = b * (1 + a * kZone * (n-1)), kZone = coopZoneK[index<3 ? 1 : 0] ; 1 hors coop.",
  },
  horde: {
    formula: {
      hp: "def.hp * (elite ? hpMulElite : hpMulNormal) * (1 + hpT1*t + hpT2*t^2 + (elite ? hpT3Elite : hpT3Normal)*t^3) * D * (1 + zone.growth * min(1, t/growthRampMin)^2) * endlessHpBase^m * H.hp * coopFactor(coopHp, coopHpBase)",
      dmg: "def.dmg * (elite ? 1 : dmgMulNormal) * sqrt(D) * (1 + dmgT1*t + dmgT2*t^2 + dmgT3*t^3) * endlessDmgBase^m * H.dmg",
      speed: "def.speed (aucune montee avec le temps trouvee)",
    },
    ...pick(H, ["hpMulNormal", "hpMulElite", "hpT1", "hpT2", "hpT3Elite", "hpT3Normal", "growthRampMin", "endlessHpBase", "coopHp", "coopHpBase", "dmgMulNormal", "dmgT1", "dmgT2", "dmgT3", "endlessDmgBase", "spawnRadius"]),
  },
  spawn: {
    formula: {
      budget: "chaque frame : budget += dt * rate ; tant que budget >= 1 et < maxPerFrame apparitions : on tire un monstre (poids, at <= t) et budget -= def.cost",
      rate: "rate = slow * base * endless * clamp(adaptK * (killed/adaptTau) / max(base*slow*endless, 0.001), adaptMin, adaptMax) * (coop ? 1 + coopRate*kZone*(n-1) : 1)",
      base: "base = rateMul * (rateC0 + rateT1*t + rateT2*t^2)",
      slow: "slow = 1 sans boss ; slowBoss tant qu'un boss est en vie ; slowFinalBoss pour le boss final",
      endless: "mode sans fin choisi : endlessRate0 + endlessRateT*m quand m court (meme condition que m), endlessRateBeforeKill sinon ; 1 hors sans fin",
      killed: "killed : somme des def.cost des monstres non elites tues, amortie exp(-dt/adaptTau)",
      cap: "aucune apparition si vivants >= aliveCap * (coop ? 1 + coopCap*kZone*(n-1) : 1)",
      minAlive: "si vivants < min(minAliveMax, (minAlive0 + minAliveT*t) * slow) * (coop ? 1 + coopRate*kZone*(n-1) : 1) : jusqu'a topUpMax apparitions immediates",
      elite: "un elite toutes les max(eliteIntervalMin, eliteInterval0 + eliteIntervalT*t) secondes (Heroique I : par paires)",
      swarm: "une vague toutes les max(swarmIntervalMin, swarmInterval0 + swarmIntervalT*t) s ; taille selon le motif = (a*t + b) * swarmMul * (coop ? 1 + swarmCoop*kZone*(n-1) : 1)",
    },
    ...pick(S, ["rateMul", "rateC0", "rateT1", "rateT2", "slowBoss", "slowFinalBoss", "endlessRate0", "endlessRateT", "endlessRateBeforeKill", "adaptTau", "adaptK", "adaptMin", "adaptMax", "coopRate", "maxPerFrame",
      "aliveCap", "coopCap", "minAlive0", "minAliveT", "minAliveMax", "topUpMax", "eliteInterval0", "eliteIntervalT", "eliteIntervalMin", "swarmInterval0", "swarmIntervalT", "swarmIntervalMin", "swarmMul", "swarmCoop", "swarmPatterns"]),
  },
  guardians: {
    count: 4,
    formula: {
      hp: "hpMul * max(curveA, curveB) * endlessHpBase^m * (1 + slain*perSlainHp[heroic>=wardensLevel]) * H.hp * coopFactor(coopHp, coopHpBase)",
      curveA: "aHp * bossCurve(t) * D ; bossCurve = interpolation lineaire (at, hp) des boss non finaux de la zone, prolongee apres le dernier ; avant le premier : (earlyC0 + earlyT*t/at0) * hp0",
      curveB: "bHp * def.hp * D * (1 + bT1*t + bT2*t^2) (def = monstre de la zone attribue au repaire)",
      dmg: "def.dmg * sqrt(D) * (1 + dT1*t + dT2*t^2) * dMul * endlessDmgBase^m * (1 + slain*perSlainDmg[heroic>=wardensLevel]) * H.dmg",
      refill: "un repaire vide se remplit apres refill[heroic>=wardensLevel] secondes (divise par hyper.lairRefillDiv en Hyper)",
      liveRescale: "a chaque gardien tue, les gardiens vivants sont recalcules en gardant leur fraction de PV",
    },
    ...pick(G, ["hpMul", "aHp", "earlyC0", "earlyT", "bHp", "bT1", "bT2", "endlessHpBase", "coopHp", "coopHpBase", "dT1", "dT2", "dMul", "endlessDmgBase", "wardensLevel", "perSlainHp", "perSlainDmg", "refill", "damageTakenReduction"]),
  },
  bosses: {
    formula: {
      hp: "scale * boss.hp * hpMul * D * endlessHpBase^m * H.hp * coopFactor(coopHp, coopHpBase) ; scale = 1, councilScale pour le boss rappele (Heroique V)",
      dmg: "boss.dmg * sqrt(D) * endlessDmgBase^m * H.dmg",
      timing: "boss.at en minutes (x hyper.bossAtFactor en Hyper) ; Scholomance : le boss suivant attend qu'aucun boss ne soit en vie ; mode sans fin : un des 5 boss toutes les hyper.endlessBossInterval secondes ; aucune montee pendant le combat trouvee",
    },
    ...pick(B, ["hpMul", "endlessHpBase", "endlessDmgBase", "coopHp", "coopHpBase", "councilScale"]),
  },
  hyper: {
    flag: hyperRef ? "state+" + hex(hyperRef.flag) : null,
    formula: {
      clock: "tHyper = timeFactor*min(t, cap) + max(0, t - cap), cap = zone.bosses[4].at * capFactor (capFallback sans boss final) : l'horloge des monstres va timeFactor fois plus vite jusqu'a la minute Hyper du boss final, puis garde son avance",
      clockUsedBy: "PV et degats de la horde et des gardiens (t des polynomes et de la rampe de croissance), debit d'apparition (base), minimum de vivants, monstres disponibles (at <= t), intervalles et taille des elites et des vagues ; pas m (sans fin)",
      bosses: "boss.at * bossAtFactor ; en sans fin, retour d'un boss toutes les endlessBossInterval[1] s au lieu de endlessBossInterval[0]",
      lairs: "delai des repaires de gardiens / lairRefillDiv",
    },
    timeFactor: hyperRef ? hyperRef.timeFactor : null,
    capFactor: hyperRef ? hyperRef.capK : null,
    capFallback: hyperRef ? hyperRef.capFallback : null,
    bossAtFactor: hyperBossAtK,
    endlessBossInterval: endlessBoss ? [endlessBoss.normal, endlessBoss.hyper] : null,
    lairRefillDiv: refill ? refill.hyperDiv : null,
  },
  coopZoneK: H.coopZoneK ?? null,
  heroic,
  runModifiers: { density: null, health: null, damage: null, speed: null, healthState: SOff == null ? null : "state+" + hex(SOff),
    note: "4 curseurs du menu Run Options (runmods.rs) : textes seulement dans les traductions (aucune reference code), valeurs non retrouvees. Les fonctions d'apparition, de debit et de tic ne lisent aucun autre facteur d'etat que S." },
  stateScale: SOff == null ? null : { offset: "state+" + hex(SOff), initial: 1 },
  zones,
  missing,
};

fs.writeFileSync(out, JSON.stringify(db, null, 1) + "\n");
console.log(`${Object.keys(zones).length} zones, ${heroic.length} niveaux heroiques, ${missing.length} manquants -> ${path.relative(process.cwd(), out)}`);
if (missing.length) console.log(missing.join("\n"));
