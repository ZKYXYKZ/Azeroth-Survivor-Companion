// Extrait l'equipement de l'Armurerie (crates/wenilla-rogue/src/gear.rs) : sets, armes, etoiles.
// Usage : node tools/gear-extract.js <exe> [sortie] [dossier loc]
// Lecture statique uniquement : ni le jeu ni le compagnon ne sont lances. Les adresses ne sont
// pas codees en dur : chaque table est retrouvee par motif de code. Formules lues sur 0.135.1,
// outil execute sur 0.139.0 (meme code, tables deplacees).
// Le dossier loc (sortie de tools/extract-loc.js) est optionnel : sans lui, pas de textes fr.
const fs = require("fs");
const path = require("path");
const Module = require("module");
const load = require("./pe.js");
const { Decoder, DecoderOptions, Formatter, FormatterSyntax, Mnemonic } = require("iced-x86");

const exe = process.argv[2] || "C:/Users/ludov/Downloads/AzerothSurvivors/AzerothSurvivors/AzerothSurvivors.exe";
const out = process.argv[3] || path.join(__dirname, "..", "AS-Companion", "web", "gear.json");
const locDir = process.argv[4] || null;
const P = load(exe);
const { buf: b } = P;
const text = P.sec(".text"), rdata = P.sec(".rdata"), pdata = P.sec(".pdata");
const ib = Number(P.ib);
const LOC_EN = locDir ? JSON.parse(fs.readFileSync(path.join(locDir, "loc-1.json"), "utf8")) : {};
const LOC_FR = locDir ? JSON.parse(fs.readFileSync(path.join(locDir, "loc-7.json"), "utf8")) : {};
const hex = (n) => "0x" + n.toString(16);
const die = (m) => { console.error("gear-extract : " + m); process.exit(1); };

const off = (va) => { const o = P.toOff(BigInt(va)); if (o < 0) die("adresse hors image " + hex(va)); return o; };
const f32 = (va) => b.readFloatLE(off(va));
const u32 = (va) => b.readUInt32LE(off(va));
const u64 = (va) => Number(b.readBigUInt64LE(off(va)));
const i32At = (o) => b.readInt32LE(o);
const f32s = (va, n) => Array.from({ length: n }, (_, i) => f32(va + i * 4));
const strAt = (va) => { const s = P.str(off(va), 400); if (s == null) die("chaine illisible " + hex(va)); return s; };
const clean = (x) => +x.toPrecision(6); // retire le bruit du flottant 32 bits (0.03500000014 -> 0.035)

// --- Decodage ---------------------------------------------------------------------------------
const fmt = new Formatter(FormatterSyntax.Nasm);
const decode = (va, size) => {
  const o = off(va);
  const d = new Decoder(64, b.subarray(o, o + size), DecoderOptions.None);
  d.ip = BigInt(va);
  const r = [];
  while (d.canDecode) {
    const i = d.decode();
    r.push({
      ip: Number(i.ip), t: fmt.format(i), mn: i.mnemonic,
      rip: i.isIpRelMemoryOperand ? Number(i.ipRelMemoryAddress) : null,
      br: i.mnemonic === Mnemonic.Call || i.mnemonic === Mnemonic.Jmp ? Number(i.nearBranch64 || 0) : null,
      imm: i.opCount > 1 && i.op1Kind !== 0 && i.op1Kind !== 1 ? (() => { try { return BigInt(i.immediate(1)); } catch (_) { return null; } })() : null,
    });
  }
  return r;
};
const fnAt = (va) => {
  const r = va - ib;
  for (let o = pdata.raw; o < pdata.raw + pdata.rs; o += 12) {
    const s = b.readUInt32LE(o), e = b.readUInt32LE(o + 4);
    if (r >= s && r < e) return { start: s + ib, end: e + ib };
  }
  die("fonction introuvable pour " + hex(va));
};
const decodeFn = (va) => { const f = fnAt(va); return decode(f.start, f.end - f.start); };
const toTextVA = (o) => o - text.raw + text.va + ib;
const find = (bytes, check) => { // cherche un motif dans .text ; check(o) valide le contexte
  const n = Buffer.from(bytes);
  const hits = [];
  for (let at = b.indexOf(n, text.raw); at >= 0 && at < text.raw + text.rs; at = b.indexOf(n, at + 1)) if (check(at)) hits.push(at);
  return hits;
};
const relAt = (o) => toTextVA(o) + 4 + i32At(o); // disp32 RIP lu a l'offset o
const same = (o, bytes) => bytes.every((x, i) => b[o + i] === x);
const nextCall = (list, from) => { for (let i = from; i < list.length; i++) if (list[i].mn === Mnemonic.Call) return i; die("appel attendu"); };
const idx = (list, re, from = 0) => { for (let i = from; i < list.length; i++) if (re.test(list[i].t)) return i; die("motif absent : " + re); };

// --- Bonus : enum {tag u32, valeur f32 (u32 pour count)}, ordre du match de 0x145bdcdd0 (0.135.1)
const STATS = [
  ["dmg", "bonus.damage", "fraction"], ["cdr", "bonus.cooldown", "fraction"], ["hp", "bonus.hp", "flat"],
  ["crit", "bonus.crit", "fraction"], ["critDmg", "bonus.crit_damage", "fraction"], ["speed", "bonus.speed", "fraction"],
  ["armor", "bonus.armor", "fraction"], ["regen", "bonus.regen", "flat"], ["pickup", "bonus.pickup", "fraction"],
  ["gold", "bonus.gold", "fraction"], ["area", "bonus.area", "fraction"], ["targets", "bonus.count", "count"],
  ["echo", "bonus.echo", "fraction"], ["calmRegen", "bonus.calm_regen", "fraction"], ["crowdArmor", "bonus.crowd_armor", "fraction"],
];
const HP = 2, COUNT = 11;
const readBonuses = (va, n) => Array.from({ length: n }, (_, i) => {
  const t = u32(va + i * 8);
  if (t >= STATS.length) die("tag de bonus inconnu " + t + " a " + hex(va));
  return { t, v: t === COUNT ? u32(va + i * 8 + 4) : f32(va + i * 8 + 4) };
});
const roundf = (x) => Math.fround(Math.sign(x) * Math.floor(Math.abs(x) + 0.5));
const mul = (v, x, t) => (t === COUNT ? v : t === HP ? roundf(Math.fround(v * x)) : Math.fround(v * x));
const merge = (lists) => { // somme par tag, comme la fusion du jeu
  const m = new Map();
  for (const l of lists) for (const { t, v } of l) m.set(t, m.has(t) ? (t === COUNT ? m.get(t) + v : Math.fround(m.get(t) + v)) : v);
  return [...m].map(([t, v]) => ({ t, v }));
};
const asObj = (l) => { const o = {}; for (const { t, v } of l) o[STATS[t][0]] = clean(v); return o; };

// --- Tables de la fonction item(id) -----------------------------------------------------------
// INV_TYPES[8] (u32) puis SLOTS[8] (u8) : entete des tables d'armure dans .rdata
const pat = Buffer.alloc(40);
[1, 3, 5, 6, 7, 8, 9, 10].forEach((v, i) => pat.writeUInt32LE(v, i * 4));
[0, 2, 4, 5, 6, 7, 8, 9].forEach((v, i) => { pat[32 + i] = v; });
const atHeader = b.indexOf(pat, rdata.raw);
if (atHeader < 0) die("table des emplacements introuvable");
const SLOT_IDS = [...b.subarray(atHeader + 32, atHeader + 40)];

// cmp r12d,6 ; (2 mov) ; ja X ; mov eax,r12d ; lea rcx,[rip+table de saut] ; saut indexe
const itemHits = find([0x0f, 0x87], (o) => same(o + 6, [0x44, 0x89, 0xe0, 0x48, 0x8d, 0x0d]) && same(o + 16, [0x48, 0x63, 0x04, 0x81, 0x48, 0x01, 0xc8, 0xff, 0xe0]) && b.subarray(o - 24, o).indexOf(Buffer.from([0x41, 0x83, 0xfc, 0x06])) >= 0);
if (itemHits.length !== 1) die("fonction item : " + itemHits.length + " candidats");
const hit = itemHits[0];
const defaultBlock = toTextVA(hit + 6) + i32At(hit + 2);
const jumpTable = relAt(hit + 12);
const baseList = (va) => { // bloc : mov eax,N ; lea rcx,[rip+T]
  const o = off(va);
  if (b[o] !== 0xb8 || !same(o + 5, [0x48, 0x8d, 0x0d])) die("bloc de base inattendu " + hex(va));
  return { n: b.readUInt32LE(o + 1), t: relAt(o + 8) };
};
const ARMOR_BASE = [];
for (let i = 0; i < 7; i++) { const l = baseList(jumpTable + i32At(off(jumpTable + i * 4))); ARMOR_BASE.push(readBonuses(l.t, l.n)); }
{ const l = baseList(defaultBlock); ARMOR_BASE.push(readBonuses(l.t, l.n)); }

const item = decodeFn(toTextVA(hit));
// fn map(iter) -> closure de mise a l'echelle : lea r12,[multiplicateurs] ; movss xmm6,[k]
const follow = (callVa) => {
  const first = decode(callVa, 0x60);
  const c = first[nextCall(first, 0)].br;
  const list = decode(c, 0x70);
  return { table: list[idx(list, /^lea r12,\[/)].rip, k: list[idx(list, /^movss xmm6,\[/)].rip };
};
const iArmorEnd = idx(item, /^lea rax,\[rcx\+rax\*8\]/);
const iWeaponEnd = idx(item, /^lea rcx,\[rax\+rcx\*8\]/);
const iThemeIdx = idx(item, /^lea r14d,\[rdi\+rdi\*2\]/);
const iTheme = idx(item, /^shl eax,4/, iThemeIdx);
const THEME_VA = item[iTheme + 1].rip;
if (!THEME_VA) die("table des themes introuvable");
const armorMap = follow(item[nextCall(item, iArmorEnd)].br);
const weaponMap = follow(item[nextCall(item, iWeaponEnd)].br);
const themeMap = follow(item[nextCall(item, iTheme)].br);
if (armorMap.table !== weaponMap.table) die("armes et armures n'ont plus le meme multiplicateur");
const BASE_MULT = f32s(armorMap.table, 6);
const THEME_MULT = f32s(themeMap.table, 6);
const K = f32(armorMap.k);
const THEMES = Array.from({ length: 8 }, (_, i) => readBonuses(THEME_VA + i * 16, 2));

// bonus du niveau legendaire : mov rax,0x10000000B (count 1, armes) ; mov r13,<echo> (armures)
const iLeg = idx(item, /^mov r13,[0-9A-F]+h/, iTheme);
const bonusFromImm = (q) => ({ t: Number(q & 0xffffffffn), v: (() => { const t = Buffer.alloc(8); t.writeBigUInt64LE(q); return Number(q & 0xffffffffn) === COUNT ? t.readUInt32LE(4) : t.readFloatLE(4); })() });
const LEG_ARMOR = bonusFromImm(item[iLeg].imm);
const LEG_WEAPON = bonusFromImm(item[iLeg - 1].imm);

// accesseurs classe -> fiche : mov ecx,edi ; call accesseur (dec cl ; cmp cl,0Ah ; ja ; movzx ; lea rcx,[T])
const classAccessors = [];
for (let i = 0; i < item.length - 1 && classAccessors.length < 2; i++) {
  if (item[i].t === "mov ecx,edi" && item[i + 1].mn === Mnemonic.Call) {
    const a = decode(item[i + 1].br, 0x18);
    classAccessors.push(a[idx(a, /^lea rcx,\[/)].rip);
  }
}
if (classAccessors.length !== 2) die("accesseurs de classe introuvables");
const [CLASS_TABLE, PVP_TABLE] = classAccessors;
const CLASS_IDS = [1, 2, 3, 4, 5, 7, 8, 9, 11]; // Blizzard, voir le masque 0x5DF de 0x145be5e60 (0.135.1)

// --- Etoiles : mulss xmm0,[rdx+rcx*4] ; jbe ; lea rcx,[T2] ; addss xmm0,[rcx+rax*4] -----------
const starHits = find([0xf3, 0x0f, 0x59, 0x04, 0x8a, 0x76], (o) => same(o + 7, [0x48, 0x8d, 0x0d]) && same(o + 14, [0xf3, 0x0f, 0x58, 0x04, 0x81]));
if (starHits.length !== 1) die("fonction des etoiles : " + starHits.length + " candidats");
const STAR2_VA = relAt(starHits[0] + 10);
const star = decodeFn(toTextVA(starHits[0]));
const iStar = idx(star, /^mulss xmm0,\[rdx\+rcx\*4\]/);
const STAR1_VA = star[iStar - 1].rip;
if (!STAR1_VA) die("table etoiles introuvable");
const STAR_PER = f32s(STAR1_VA, 6), STAR_FIFTH = f32s(STAR2_VA, 6);
const iCap = idx(star, /^cmp bl,4/, iStar);
const fill = decodeFn(star[nextCall(star, iCap)].br);
// 5e etoile : complete avec les stats absentes de la piece, prises sur le legendaire amene a 5*
const iFrac = idx(fill, /^movss xmm0,\[rdx\+rcx\*4\]/);
const FILL_FRAC = f32s(fill[iFrac - 1].rip, 6);
const fillImm = fill[idx(fill, /^mov dword \[rbp\+[0-9A-F]+h\],3[EF][0-9A-F]{6}h/)].imm;
const LEG_STAR5 = (() => { const t = Buffer.alloc(4); t.writeUInt32LE(Number(fillImm)); return t.readFloatLE(0); })();

// --- Bonus 4 pieces : un seul par palier, communs a toutes les classes -------------------------
const set4Hits = find([0x49, 0x83, 0xf8, 0x05, 0x77], (o) => same(o + 6, [0x48, 0x8d, 0x05]) && same(o + 13, [0x4a, 0x8b, 0x14, 0xc0, 0x48, 0x8d, 0x05]) && same(o + 24, [0x4a, 0x8b, 0x04, 0xc0]));
if (!set4Hits.length) die("table des bonus 4 pieces introuvable");
const SET4_LEN = relAt(set4Hits[0] + 9), SET4_PTR = relAt(set4Hits[0] + 20);
const SET4 = Array.from({ length: 6 }, (_, i) => readBonuses(u64(SET4_PTR + i * 8), u64(SET4_LEN + i * 8)));

// --- Bonus 8 pieces : fonction par classe et palier, emulee -------------------------------------
const fn8Hits = find([0x0f, 0xb6, 0xc2, 0xff, 0xc8, 0x83, 0xf8, 0x0a, 0x0f, 0x87], (o) => same(o + 14, [0x0f, 0x28, 0xf3]));
if (fn8Hits.length !== 1) die("fonction 8 pieces : " + fn8Hits.length + " candidats");
const FN8 = fnAt(toTextVA(fn8Hits[0])).start;
// Appelant : movss xmm3,[1.0] ; jmp ; movss xmm3,[1.5] ; ... ; call FN8. Juste avant : seuils.
const empHits = find([0xeb, 0x08, 0xf3, 0x0f, 0x10, 0x1d], (o) => {
  if (b.subarray(o - 40, o).indexOf(Buffer.from([0x80, 0xfa, 0x02])) < 0) return false; // cmp dl,2 : palier absent
  for (let k = 10; k < 40; k++) if (b[o + k] === 0xe8 && toTextVA(o + k) + 5 + i32At(o + k + 1) === FN8) return true;
  return false;
});
if (!empHits.length) die("multiplicateur renforce introuvable");
const EMPOWERED = f32(relAt(empHits[0] + 6));
const emp = decodeFn(toTextVA(empHits[0]));
const iEmp = emp.findIndex((i) => i.ip === toTextVA(empHits[0]));
let iThr = iEmp;
while (iThr >= 0 && emp[iThr].mn !== Mnemonic.Call) iThr--; // l'appel qui rend (palier, renforce)
if (iThr < 0) die("fonction des seuils introuvable");
const thr = decodeFn(emp[iThr].br);
const thrImm = (re) => [...new Set(thr.filter((i) => re.test(i.t)).map((i) => Number(i.imm)))];
const PIECES8 = thrImm(/^cmp qword \[.*\],[0-9A-F]+h?$/).filter((x) => x === 8)[0] || null;
const clImm = thrImm(/^cmp cl,[0-9A-F]+h?$/);
const STARS8 = clImm.length === 2 ? Math.min(...clImm) : null, STARS_EMP = clImm.length === 2 ? Math.max(...clImm) : null;

// emu.js ne gere ni cvttss2si, ni movlps, ni mulps, ni movsldup, ni un xmm initial : on compile une copie completee en
// memoire, sans toucher au fichier d'origine.
const loadEmu = () => {
  const p = path.join(__dirname, "emu.js");
  let src = fs.readFileSync(p, "utf8");
  const put = (anchor, add) => { if (!src.includes(anchor)) die("emu.js a change : " + anchor); src = src.replace(anchor, add + anchor); };
  put("case Mnemonic.Cvtss2sd: {", `case Mnemonic.Cvttss2si: {
          const y = opKind(ins, 1) === OpKind.Register ? getReg(ins.opRegister(1)).readFloatLE(0) : rd(ea(ins), 4).readFloatLE(0);
          writeOp(ins, 0, BigInt.asUintN(bits, BigInt(Math.trunc(y)))); break;
        }
        case Mnemonic.Movlps: wr(ea(ins), Buffer.from(getReg(ins.opRegister(1))).subarray(0, 8)); break;
        case Mnemonic.Mulps: {
          const x = Buffer.from(getReg(ins.opRegister(0)));
          const y = opKind(ins, 1) === OpKind.Register ? getReg(ins.opRegister(1)) : rd(ea(ins), 16);
          for (let i = 0; i < 4; i++) x.writeFloatLE(Math.fround(x.readFloatLE(i * 4) * y.readFloatLE(i * 4)), i * 4);
          setReg(ins.opRegister(0), x); break;
        }
        case Mnemonic.Movsldup: { const y = Buffer.from(getReg(ins.opRegister(1))); y.copy(y, 4, 0, 4); y.copy(y, 12, 8, 12); setReg(ins.opRegister(0), y); break; }
        `);
  put("    let ip = opts.start;", "    if (opts.init) opts.init(api);\n");
  const m = new Module(p, module);
  m.filename = p;
  m.paths = module.paths;
  m._compile(src, p);
  return m.exports(exe);
};
const E = loadEmu();
const OUT = 0x100000000800n;
const emuCalls = new Proxy({}, {
  get: (_, k) => {
    const t = Number(k);
    if (Number.isNaN(t)) return undefined;
    const o = off(t);
    if (b[o] === 0xff && b[o + 1] === 0x25) { // thunk de roundf importe
      return (api) => {
        const x = Buffer.from(api.xmm[api.Register.XMM0]);
        x.writeFloatLE(roundf(x.readFloatLE(0)), 0);
        api.xmm[api.Register.XMM0] = x;
      };
    }
    return (api) => { api.regs[api.Register.RAX] = api.alloc(Number(api.regs[api.Register.RCX] & 0xffffn)); };
  },
});
const set8 = (cls, tier, m) => {
  const r = E.run({
    start: FN8, maxSteps: 3000, calls: emuCalls,
    regs: { RCX: OUT, RDX: BigInt(cls), R8: BigInt(tier) },
    init: (api) => { const x = Buffer.alloc(16); x.writeFloatLE(m, 0); api.xmm[api.Register.XMM3] = x; },
  });
  const a = r.api;
  if (a.rdInt(OUT, 8) === 0xffffffffffffffffn) return null;
  const s = (po, lo) => {
    const n = Number(a.rdInt(OUT + BigInt(lo), 8));
    return b.toString("utf8", off(Number(a.rdInt(OUT + BigInt(po), 8))), off(Number(a.rdInt(OUT + BigInt(po), 8))) + n);
  };
  const fl = (o) => Buffer.from(a.rd(OUT + BigInt(o), 4)).readFloatLE(0);
  return { ability: s(0x18, 0x20), text: s(0x28, 0x30), v: clean(fl(0x38)), v2: clean(fl(0x3c)), effects: Number(a.rdInt(OUT + 0x10n, 8)) };
};

// --- Textes -------------------------------------------------------------------------------------
const tr = (key, en) => ({ en: LOC_EN[key] != null ? LOC_EN[key] : (en != null ? en : null), fr: LOC_FR[key] != null ? LOC_FR[key] : null });
const pctText = (x) => { const n = Math.round(x * 1000) / 10; return String(n); };
const bonusLabel = ({ t, v }) => {
  const [, key, unit] = STATS[t];
  const n = unit === "fraction" ? pctText(v) : String(clean(v));
  const f = (s) => (s == null ? null : s.replace("{n}", n));
  return { en: f(LOC_EN[key]), fr: f(LOC_FR[key]) };
};
const render = (s, x) => (s == null ? null : s.replace("{v2}", x.v2).replace("{v}", x.v));

// Regles lues dans les textes du jeu (armory.set_tip4/8) : les seuils y sont ecrits en chiffres
const tip4 = LOC_EN["armory.set_tip4"] || "";
const m4 = /Wear (\d+) armor pieces of this set at (\d+) star/.exec(tip4);

// --- Calcul d'une piece -------------------------------------------------------------------------
const pieceBonuses = (cls, slot, tier, weaponBase) => {
  const base = weaponBase || ARMOR_BASE[slot];
  const lists = [base.map(({ t, v }) => ({ t, v: mul(v, Math.fround(BASE_MULT[tier] * K), t) }))];
  if (tier > 0) { // theme : tourne avec classe et emplacement, (3*classe + emplacement) & 7
    const th = THEMES[(3 * cls + slot) & 7];
    lists.push(th.map(({ t, v }) => ({ t, v: mul(v, Math.fround(THEME_MULT[tier] * K), t) })));
  }
  if (tier === 4) lists.push([slot < 8 ? LEG_ARMOR : LEG_WEAPON]);
  return merge(lists);
};
const starMult = (tier, s) => {
  if (s === 0) return 0;
  let x = Math.fround(Math.min(s, 4) * STAR_PER[tier]);
  if (s > 4) x = Math.fround(x + STAR_FIFTH[tier]);
  return x;
};
const withStars = (cls, slot, tier, s, weaponBase) => {
  const own = pieceBonuses(cls, slot, tier, weaponBase);
  if (s === 0) return own;
  const x = starMult(tier, s);
  const lists = [own, own.filter((o) => o.t !== COUNT).map(({ t, v }) => ({ t, v: mul(v, x, t) }))];
  if (s > 4 && tier !== 4 && slot < 8) {
    const leg = pieceBonuses(cls, slot, 4);
    const full = merge([leg, leg.filter((o) => o.t !== COUNT).map(({ t, v }) => ({ t, v: mul(v, LEG_STAR5, t) }))]);
    const has = new Set(own.map((o) => o.t));
    lists.push(full.filter((o) => o.t !== COUNT && !has.has(o.t)).map(({ t, v }) => ({ t, v: mul(v, FILL_FRAC[tier], t) })));
  }
  return merge(lists);
};

// --- Fiches de classe ---------------------------------------------------------------------------
const VER = (() => {
  const s = b.toString("latin1", rdata.raw, rdata.raw + rdata.rs);
  let best = null;
  for (const x of s.matchAll(/(?<![0-9.])0\.1[0-9]{2}\.[0-9]{1,2}(?![0-9.])/g)) {
    const n = x[0].split(".").map(Number);
    if (!best || n[1] > best[1] || (n[1] === best[1] && n[2] > best[2])) best = n;
  }
  return best ? best.join(".") : null;
})();
const NOUNS = { 1: "cloth", 2: "leather", 3: "mail", 4: "plate" };
const classKey = (cls) => { // la table des cles de classe n'a pas d'entree simple : set.<classe>.0 vaut pour identifier
  const c = u64(CLASS_TABLE + (cls - 1) * 8);
  const first = strAt(c);
  const k = Object.keys(LOC_EN).find((x) => /^set\.[a-z]+\.0$/.test(x) && LOC_EN[x] === first);
  return k ? k.split(".")[1] : "class" + cls;
};
const FALLBACK_KEYS = { 1: "warrior", 2: "paladin", 3: "hunter", 4: "rogue", 5: "priest", 7: "shaman", 8: "mage", 9: "warlock", 11: "druid" };
const pieceName = (setName, style, noun) => {
  const tpl = style ? tr("item.name_of") : tr("item.name_prefix");
  const f = (l) => (tpl[l] == null || setName[l] == null || noun[l] == null ? null : tpl[l].replace("{set}", setName[l]).replace("{noun}", noun[l]));
  return { en: f("en"), fr: f("fr") };
};
const classes = {};
for (const cls of CLASS_IDS) {
  const c = u64(CLASS_TABLE + (cls - 1) * 8);
  if (!c) die("classe absente " + cls);
  const rawId = b[off(c + 0x129)], armor = b[off(c + 0x128)];
  if (rawId !== cls) die("fiche de classe inattendue " + cls + " / " + rawId);
  const key = locDir ? classKey(cls) : FALLBACK_KEYS[cls];
  const nounKind = NOUNS[armor];
  const wPtr = u64(c + 0x78), wN = u64(c + 0x80);
  const weapons = Array.from({ length: wN }, (_, i) => {
    const w = wPtr + i * 0x90;
    const bonuses = readBonuses(u64(w + 0x58), u64(w + 0x60));
    return {
      idx: 8 + i, slot: b[off(w + 0x8c)], slotName: tr("slot." + b[off(w + 0x8c)]),
      names: Array.from({ length: 5 }, (_, t) => strAt(w + 8 + t * 16)), base: asObj(bonuses), rawBase: bonuses,
    };
  });
  const pvp = u64(PVP_TABLE + (cls - 1) * 8);
  const pvpNames = pvp ? [strAt(pvp), strAt(pvp + 0x10)] : [null, null];
  const pvpWeapons = pvp ? Array.from({ length: u64(pvp + 0x28) }, (_, i) => {
    const w = u64(pvp + 0x20) + i * 48;
    return [strAt(w + 8), strAt(w + 24 + 8)];
  }) : [];
  const sets = [];
  for (let tier = 0; tier < 6; tier++) {
    let name, nameAlt = null, style;
    if (tier < 5) {
      const q = c + tier * 24;
      name = tr("set." + key + "." + tier, strAt(q));
      style = b[off(q + 0x10)];
    } else {
      name = tr("set.pvp." + pvpNames[0], pvpNames[0]);
      nameAlt = tr("set.pvp." + pvpNames[1], pvpNames[1]);
      style = 0;
    }
    const pieces = Array.from({ length: 8 }, (_, s) => {
      const noun = tr("noun." + nounKind + "." + s);
      return {
        idx: s, slot: SLOT_IDS[s], slotName: tr("slot." + SLOT_IDS[s]), name: pieceName(name, style, noun),
        stars: [0, 1, 2, 3, 4, 5].map((st) => asObj(withStars(cls, s, tier, st))),
      };
    });
    const wp = weapons.map((w, i) => ({
      idx: w.idx, slot: w.slot, slotName: w.slotName,
      name: tier < 5 ? tr("weapon." + key + "." + i + "." + tier, w.names[tier]) : (pvpWeapons[i] ? tr("weapon.pvp." + pvpWeapons[i][0], pvpWeapons[i][0]) : null),
      nameAlt: tier === 5 && pvpWeapons[i] ? tr("weapon.pvp." + pvpWeapons[i][1], pvpWeapons[i][1]) : null,
      stars: [0, 1, 2, 3, 4, 5].map((st) => asObj(withStars(cls, w.idx, tier, st, w.rawBase))),
    }));
    const s8 = set8(cls, tier, 1), s8e = set8(cls, tier, EMPOWERED);
    const set8Out = s8 ? {
      ability: s8.ability, abilityName: tr("ability." + s8.ability + ".name"), template: { en: s8.text, fr: LOC_FR[s8.text] != null ? LOC_FR[s8.text] : null },
      v: s8.v, v2: s8.v2, text: { en: render(s8.text, s8), fr: render(LOC_FR[s8.text], s8) },
      empowered: { v: s8e.v, v2: s8e.v2, text: { en: render(s8.text, s8e), fr: render(LOC_FR[s8.text], s8e) } }, effects: s8.effects,
    } : null;
    // totaux 8 pieces (et armes) a etoiles egales : ce que le simulateur consomme
    const totals = [0, 1, 2, 3, 4, 5].map((st) => asObj(merge(pieces.map((_, s) => withStars(cls, s, tier, st)))));
    const totalsWeapons = [0, 1, 2, 3, 4, 5].map((st) => asObj(merge(weapons.map((w) => withStars(cls, w.idx, tier, st, w.rawBase)))));
    sets.push({ tier, rarity: tr("rarity." + tier), key: tier < 5 ? "set." + key + "." + tier : "set.pvp", name, nameAlt, nameStyle: style ? "of" : "prefix", set8: set8Out, pieces, weapons: wp, totals, totalsWeapons });
  }
  classes[key] = {
    id: cls, name: tr("class." + key + ".name"), armor: nounKind,
    weaponSlots: weapons.map((w) => ({ idx: w.idx, slot: w.slot, slotName: w.slotName, base: w.base })),
    sets,
  };
}

const tiers = Array.from({ length: 6 }, (_, i) => ({
  tier: i, rarity: tr("rarity." + i), baseMult: clean(BASE_MULT[i]), themeMult: clean(THEME_MULT[i]),
  starPer: clean(STAR_PER[i]), starFifth: clean(STAR_FIFTH[i]), fillFrac: clean(FILL_FRAC[i]),
  starMult: [0, 1, 2, 3, 4, 5].map((s) => clean(1 + starMult(i, s))),
  set4: asObj(SET4[i]), set4Label: SET4[i].map(bonusLabel),
}));
const data = {
  meta: {
    gameVersion: VER, exeBytes: b.length, source: "tools/gear-extract.js (lecture statique de gear.rs)",
    units: "fraction : 0.05 = 5 % ; flat : points (hp) ou points par seconde (regen) ; count : entier",
    locLoaded: !!locDir,
  },
  stats: STATS.map(([key, loc, unit], tag) => ({ key, tag, loc, unit, label: tr(loc) })),
  rules: {
    scale: clean(K), themeFormula: "(3 * classId + pieceIdx) & 7", legendaryArmor: asObj([LEG_ARMOR]), legendaryWeapon: asObj([LEG_WEAPON]),
    legendaryFifthStar: clean(LEG_STAR5), set4: { pieces: m4 ? +m4[1] : null, minStars: m4 ? +m4[2] : null },
    set8: { pieces: PIECES8, minStars: STARS8 }, empowered: { minStars: STARS_EMP, mult: clean(EMPOWERED) },
  },
  armorSlots: ARMOR_BASE.map((l, i) => ({ idx: i, slot: SLOT_IDS[i], slotName: tr("slot." + SLOT_IDS[i]), base: asObj(l) })),
  themes: THEMES.map(asObj),
  tiers, classes,
};
fs.writeFileSync(out, JSON.stringify(data));
console.log("ecrit", out, (fs.statSync(out).size / 1024).toFixed(0) + " Ko", "version", VER, Object.keys(classes).length, "classes");
