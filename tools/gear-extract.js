// Extrait l'equipement de l'Armurerie (crates/wenilla-rogue/src/gear.rs) : sets, armes, etoiles.
// Usage : node tools/gear-extract.js <exe> [sortie] [dossier loc]
// Lecture statique uniquement : ni le jeu ni le compagnon ne sont lances. Les adresses ne sont
// pas codees en dur : chaque table est retrouvee par motif de code. Formules lues sur 0.135.1,
// outil execute sur 0.139.0 puis 0.141.0 (registres changes, Tier 0.5 et Scholomance ajoutes).
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

// cmp r,6 ; (2 mov) ; ja X ; mov eax,r ; lea rcx,[rip+table de saut] ; saut indexe. r12d en 0.139, edi en 0.141 :
// registre libre (mov eax,r sur 2 ou 3 octets), et le cmp r,6 doit preceder le ja.
const movLen = (o) => (b[o] === 0x89 && b[o + 1] >= 0xc0 && (b[o + 1] & 7) === 0 ? 2 : b[o] === 0x44 && b[o + 1] === 0x89 && b[o + 2] >= 0xc0 && (b[o + 2] & 7) === 0 ? 3 : 0);
const cmp6Before = (o, k) => { const r = (b[o + 6 + k - 1] >> 3) & 7; const w = b.subarray(o - 24, o); const c = Buffer.from(k === 3 ? [0x41, 0x83, 0xf8 + r, 0x06] : [0x83, 0xf8 + r, 0x06]); return w.indexOf(c) >= 0 && (k === 3 || w[w.indexOf(c) - 1] !== 0x41); };
const itemHits = find([0x0f, 0x87], (o) => { const k = movLen(o + 6); return k > 0 && same(o + 6 + k, [0x48, 0x8d, 0x0d]) && same(o + 13 + k, [0x48, 0x63, 0x04, 0x81, 0x48, 0x01, 0xc8, 0xff, 0xe0]) && cmp6Before(o, k); });
if (itemHits.length !== 1) die("fonction item : " + itemHits.length + " candidats");
const hit = itemHits[0];
const defaultBlock = toTextVA(hit + 6) + i32At(hit + 2);
const jumpTable = relAt(hit + 9 + movLen(hit + 6));
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
const iThemeIdx = idx(item, /^lea r1[0-5]d,\[([a-z0-9]+)\+\1\*2\]/); // 3*classe : lea r14d,[rdi+rdi*2] en 0.139, lea r15d,[rax+rax*2] en 0.141
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

// bonus du niveau legendaire : mov rax,0x10000000B (count 1, armes) ; mov r13,<echo> (armures ; r14 en 0.143)
// registre libre : deux imm64 consecutifs, un bonus count puis un bonus d'un autre tag
const immBonus = (x) => x.imm !== null && x.imm > 0xffffffffn && Number(x.imm & 0xffffffffn) < STATS.length;
const legHits = item.map((x, i) => i).filter((i) => i > iTheme && immBonus(item[i]) && immBonus(item[i - 1]) && Number(item[i - 1].imm & 0xffffffffn) === COUNT && Number(item[i].imm & 0xffffffffn) !== COUNT);
if (legHits.length !== 1) die("bonus legendaires : " + legHits.length + " candidats");
const iLeg = legHits[0];
const bonusFromImm = (q) => ({ t: Number(q & 0xffffffffn), v: (() => { const t = Buffer.alloc(8); t.writeBigUInt64LE(q); return Number(q & 0xffffffffn) === COUNT ? t.readUInt32LE(4) : t.readFloatLE(4); })() });
const LEG_ARMOR = bonusFromImm(item[iLeg].imm);
const LEG_WEAPON = bonusFromImm(item[iLeg - 1].imm);

// accesseurs classe -> fiche (dec cl ; cmp cl,0Ah ; ja ; movzx eax,cl ; lea rcx,[T] ; mov rax,[rcx+rax*8] ; ret).
// Appeles par mov ecx,edi depuis item() jusqu'en 0.139 ; en 0.141 item() ne les appelle plus : on les cherche dans tout .text.
// Fiche de classe : octet +0x129 = id de classe (1 pour la 1re) ; fiche JcJ : deux noms en +0 et +0x10.
const accTables = [...new Set(find([0xfe, 0xc9, 0x80, 0xf9, 0x0a, 0x77], (o) => same(o + 7, [0x0f, 0xb6, 0xc1, 0x48, 0x8d, 0x0d]) && same(o + 17, [0x48, 0x8b, 0x04, 0xc1, 0xc3])).map((o) => relAt(o + 13)))];
const firstFiche = (T) => { const q = P.toOff(BigInt(T)); if (q < 0) return -1; const o = P.toOff(b.readBigUInt64LE(q)); return o; };
const classAccessors = [
  accTables.find((T) => { const o = firstFiche(T); return o >= 0 && b[o + 0x129] === 1 && P.str(o, 60) != null; }),
  accTables.find((T) => { const o = firstFiche(T); return o >= 0 && b[o + 0x129] !== 1 && P.str(o, 60) != null && P.str(o + 0x10, 60) != null && Number(b.readBigUInt64LE(o + 0x28)) <= 4; }),
].filter((x) => x);
if (classAccessors.length !== 2) die("accesseurs de classe introuvables");
const [CLASS_TABLE, PVP_TABLE] = classAccessors;
const CLASS_IDS = [1, 2, 3, 4, 5, 7, 8, 9, 11]; // Blizzard, voir le masque 0x5DF de 0x145be5e60 (0.135.1)

// --- Etoiles : lea rA,[T1] ; [movss x,[rA+i*4]] ; mulss ; jbe ; lea rB,[T2] ; [movss x,[rB+j*4]] ; addss ----------
// registres et forme libres (mulss xmm0,[mem] en 0.141 ; xmm2 et deux copies, l'une via movss, en 0.143). Les tables
// doivent etre les memes pour toutes les copies, et la fonction de remplissage (call apres cmp bl,4) aussi.
const scaled = /^(movss|mulss|addss) xmm\d+,\[(r[a-z0-9]+)\+r[a-z0-9]+\*4\]$/;
const starCand = find([0x76], (o) => (b[o + 2] === 0x48 || b[o + 2] === 0x4c) && b[o + 3] === 0x8d && (b[o + 4] & 0xc7) === 0x05 &&
  b.subarray(o - 16, o).indexOf(Buffer.from([0x0f, 0x59])) >= 0 && b.subarray(o + 9, o + 22).indexOf(Buffer.from([0x0f, 0x58])) >= 0);
const starHits = [];
for (const o of starCand) {
  const L = decodeFn(toTextVA(o)), j = L.findIndex((i) => i.ip === toTextVA(o));
  if (j < 3 || !/^jbe /.test(L[j].t)) continue;
  const reg = (i) => (scaled.exec(L[i] ? L[i].t : "") || [])[2];
  const pre = [j - 1, j - 2].find((i) => reg(i) && /^lea /.test(L[i - 1].t) && L[i - 1].rip && L[i - 1].t.startsWith("lea " + reg(i) + ","));
  const post = [j + 2].find((i) => reg(i) && L[j + 1].t.startsWith("lea " + reg(i) + ",") && L[j + 1].rip);
  if (pre == null || post == null) continue;
  if (!L.slice(j - 3, j).some((i) => /^mulss /.test(i.t)) || !L.slice(j + 2, j + 4).some((i) => /^addss /.test(i.t))) continue;
  const iCap = L.findIndex((i, n) => n > j && /^cmp bl,4$/.test(i.t));
  starHits.push({ T1: L[pre - 1].rip, T2: L[j + 1].rip, fill: iCap > 0 ? L[nextCall(L, iCap)].br : null, L, j });
}
const uniq = (xs, what) => { const s = [...new Set(xs.filter((x) => x != null))]; if (s.length !== 1) die(what + " : " + s.length + " candidats"); return s[0]; };
const STAR1_VA = uniq(starHits.map((h) => h.T1), "table etoiles 1-4");
const STAR2_VA = uniq(starHits.map((h) => h.T2), "table 5e etoile");
const STAR_PER = f32s(STAR1_VA, 6), STAR_FIFTH = f32s(STAR2_VA, 6);
const fill = decodeFn(uniq(starHits.map((h) => h.fill), "fonction de la 5e etoile"));
// 5e etoile : complete avec les stats absentes de la piece, prises sur le legendaire amene a 5*
const iFrac = idx(fill, /^movss xmm0,\[r[a-z0-9]+\+r[a-z0-9]+\*4\]/); // [rdx+rcx*4] en 0.139, [rdx+rax*4] en 0.141
const FILL_FRAC = f32s(fill[iFrac - 1].rip, 6);
// multiplicateur du legendaire a 5* : mov dword [rbp+X],imm (0.141) ou movss xmmN,[k] juste avant un call (0.143)
const LEG_STAR5 = (() => {
  const iImm = fill.findIndex((i) => /^mov dword \[rbp\+[0-9A-F]+h\],3[EF][0-9A-F]{6}h/.test(i.t));
  if (iImm >= 0) { const t = Buffer.alloc(4); t.writeUInt32LE(Number(fill[iImm].imm)); return t.readFloatLE(0); }
  const ks = fill.filter((i, n) => /^movss xmm\d+,\[rel /.test(i.t) && fill[n + 1] && fill[n + 1].mn === Mnemonic.Call).map((i) => f32(i.rip)).filter((v) => v > 0 && v <= 1);
  return uniq(ks, "multiplicateur 5e etoile du legendaire");
})();

// --- Bonus 4 pieces : un seul par palier, communs a toutes les classes -------------------------
// 0.139 : cmp r8,5 ; ja ; tables longueurs / pointeurs. 0.141 : match par palier (8 paliers, Tier 0.5 = 7) :
// mov edx,1 ; cmp rcx,7 ; ja ; lea r8,[JT] ; saut indexe ; blocs [mov edx,N] lea rcx,[liste] | mov rcx,r11 | mov ecx,4 ; xor edx,edx
const SET4 = (() => {
  const old = find([0x49, 0x83, 0xf8, 0x05, 0x77], (o) => same(o + 6, [0x48, 0x8d, 0x05]) && same(o + 13, [0x4a, 0x8b, 0x14, 0xc0, 0x48, 0x8d, 0x05]) && same(o + 24, [0x4a, 0x8b, 0x04, 0xc0]));
  if (old.length) {
    const LEN = relAt(old[0] + 9), PTR = relAt(old[0] + 20);
    return Array.from({ length: 6 }, (_, i) => readBonuses(u64(PTR + i * 8), u64(LEN + i * 8)));
  }
  const hits = find([0x48, 0x83, 0xf9, 0x07, 0x77], (o) => same(o + 6, [0x4c, 0x8d, 0x05]) && same(o + 13, [0x49, 0x63, 0x0c, 0x88, 0x4c, 0x01, 0xc1, 0xff, 0xe1]) && same(o - 5, [0xba, 0x01, 0x00, 0x00, 0x00]));
  if (!hits.length) die("table des bonus 4 pieces introuvable"); // deux copies de la fonction en 0.141, meme table
  const JT = relAt(hits[0] + 9);
  const fn = decodeFn(toTextVA(hits[0]));
  const r11 = fn.find((i) => /^lea r11,\[/.test(i.t));
  return Array.from({ length: 8 }, (_, i) => {
    const blk = decode(JT + i32At(off(JT + i * 4)), 0x18);
    let n = 1, va = null;
    for (const x of blk) {
      if (/^mov edx,/.test(x.t)) n = Number(x.imm);
      else if (/^xor edx,edx/.test(x.t)) n = 0;
      else if (/^lea rcx,\[/.test(x.t)) va = x.rip;
      else if (x.t === "mov rcx,r11") { if (!r11) die("r11 des bonus 4 pieces introuvable"); va = r11.rip; }
      if (x.mn === Mnemonic.Jmp) break;
    }
    return n && va ? readBonuses(va, n) : [];
  });
})();

// --- Bonus 8 pieces : fonction par classe et palier, emulee -------------------------------------
// 0.139 : movaps xmm6,xmm3 juste apres le ja ; 0.141 : saut indexe par classe (lea rcx ; movsxd), Tier 0.5 (r8 = 7) traite avant
const fn8Hits = find([0x0f, 0xb6, 0xc2, 0xff, 0xc8, 0x83, 0xf8, 0x0a, 0x0f, 0x87], (o) => same(o + 14, [0x0f, 0x28, 0xf3]) || (same(o + 14, [0x48, 0x8d, 0x0d]) && same(o + 21, [0x48, 0x63, 0x04, 0x81]) && same(o + 30, [0x49, 0x83, 0xf8, 0x05])));
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
  for (const x of s.matchAll(/(?<![0-9A-Za-z.])0\.1[0-9]{2}\.[0-9]{1,2}(?![0-9.])/g)) { // pas dans un hash (…e0.143.29) ; 0.143.2 suivi de WOW_…
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

// --- Tier 0.5 (0.141, Scholomance, gear/t05.rs) : pieces fixes par classe, hors formule des paliers -----
// Fonction des etoiles : cmp rax,7 ; ... ; lea r8,[T] ; mov rcx,[r8+classe*8] -> fiche de 0x228 octets :
// 8 pieces de 0x40 {nom &str, bonus de base +0x10, 2e liste +0x20, objet u32 +0x30, affichage u32 +0x34, emplacement u8 +0x38},
// nom du set &str +0x200, armes +0x210/+0x218 (0x50 octets, meme debut). Les etoiles combinent les deux listes
// (0x14603b5c0, non emulee) : la 2e liste est donnee telle quelle (max). Pas de bonus 4 pieces (Tier 0.5 : liste vide) ;
// bonus 8 pieces : statique paresseux construit a l'execution (0x148ac2e00), non lu.
const t05 = (() => {
  // table trouvee par signature de donnees (le code qui la lit a deja change de fonction en 0.143) : 11 pointeurs,
  // nuls hors CLASS_IDS, fiches avec nom de set &str +0x200, 8 pieces nommees, emplacements <= 32 (robe : 20), armes <= 4
  const ptr = (o) => { const v = b.readBigUInt64LE(o); return v > P.ib && P.toOff(v) >= 0 ? P.toOff(v) : -1; };
  const isT05 = (o) => {
    for (let c = 1; c <= 11; c++) {
      const q = ptr(o + (c - 1) * 8);
      if (!CLASS_IDS.includes(c)) { if (b.readBigUInt64LE(o + (c - 1) * 8) !== 0n) return false; continue; }
      if (q < 0 || P.str(q + 0x200, 60) == null || b.readBigUInt64LE(q + 0x218) > 4n) return false;
      for (let i = 0; i < 8; i++) if (P.str(q + i * 0x40, 80) == null || b[q + i * 0x40 + 0x38] > 32) return false;
    }
    return true;
  };
  const t05Hits = [];
  for (let o = rdata.raw; o < rdata.raw + rdata.rs - 88; o += 8) if (ptr(o) >= 0 && b.readBigUInt64LE(o + 40) === 0n && isT05(o)) t05Hits.push(o);
  if (t05Hits.length > 1) die("table Tier 0.5 : " + t05Hits.length + " candidats");
  if (!t05Hits.length) return null;
  const T = Number(P.toVA(t05Hits[0]));
  const keyOf = Object.fromEntries(Object.entries(classes).map(([k, c]) => [c.id, k]));
  const item = (o) => {
    const id = u32(o + 0x30);
    return { itemId: id, name: tr("t05." + id, strAt(o)), base: asObj(readBonuses(u64(o + 0x10), u64(o + 0x18))), max: asObj(readBonuses(u64(o + 0x20), u64(o + 0x28))) };
  };
  const out = { tier: 7, rarity: tr("rarity.7"), set4: asObj(SET4[7] || []), set8: null, classes: {} };
  for (const cls of CLASS_IDS) {
    const p = u64(T + (cls - 1) * 8);
    if (!p) continue;
    const key = keyOf[cls];
    const pieces = Array.from({ length: 8 }, (_, i) => ({ idx: i, slot: b[off(p + i * 0x40 + 0x38)], ...item(p + i * 0x40) }));
    const weapons = Array.from({ length: u64(p + 0x218) }, (_, i) => item(u64(p + 0x210) + i * 0x50));
    out.classes[key] = { name: tr("set." + key + ".7", strAt(p + 0x200)), pieces, weapons, totalsBase: asObj(merge(pieces.map((x) => readBonuses(u64(p + x.idx * 0x40 + 0x10), u64(p + x.idx * 0x40 + 0x18))))) };
  }
  return out;
})();
// --- Butin des boss par zone (lu sur 0.139.0) -------------------------------------------------
// Table de butin d'un boss : fn(classe dl, zone r8, boss r9) commence par cmp r8,NZ ; setb al ; cmp r9,NB ; setb cl.
// Boss final (octet drapeau) : toutes les armes de la classe. Autres boss : les boss non finaux des zones de meme
// palier, dans l'ordre zone puis boss, se partagent les 8 pieces d'armure (piece i -> boss de rang i % n).
const lootHits = find([0x49, 0x83, 0xf8], (o) => b[o + 4] === 0x0f && b[o + 5] === 0x92 && b[o + 6] === 0xc0 && same(o + 7, [0x49, 0x83, 0xf9]) && same(o + 11, [0x0f, 0x92, 0xc1]));
const drops = (() => {
  if (lootHits.length !== 1) { console.error("gear-extract : table de butin : " + lootHits.length + " candidats, drops = null"); return null; }
  const NZ = b[lootHits[0] + 3], NB = b[lootHits[0] + 10];
  const L = decodeFn(toTextVA(lootHits[0]));
  // registres libres (imul rcx,r8 / imul rax,r8 en 0.141 ; mov rcx,[...+88h] / add r12,[...+88h])
  const iZ = idx(L, /^imul r[a-z0-9]+,r8,[0-9A-F]+h?$/);
  const hexImm = (t) => { const m = /,([0-9A-F]+)(h?)$/.exec(t); return parseInt(m[1], m[2] ? 16 : 10); };
  const negDisp = (t) => { const m = /-([0-9A-F]+)(h?)\]$/.exec(t); return parseInt(m[1], m[2] ? 16 : 10); };
  const ZSTRIDE = hexImm(L[iZ].t);
  const ZONES = L[idx(L, /^lea r[a-z0-9]+,\[rel /, iZ)].rip;
  const iBp = idx(L, /^(mov|add) r[a-z0-9]+,\[r[a-z0-9]+\+r[a-z0-9]+\+[0-9A-F]+h\]$/, iZ);
  const BOSS_PTR = parseInt(/\+([0-9A-F]+)h\]$/.exec(L[iBp].t)[1], 16);
  const iBs = idx(L, /^imul r[a-z0-9]+,r9,[0-9A-F]+h?$/, iZ);
  const BSTRIDE = hexImm(L[iBs].t);
  // palier de zone : table lea r11 (0.139) ; en 0.141, fonction zone -> palier (match sur la cle de zone), emulee
  const iTier = L.findIndex((i, n) => n > iBp && (/^lea r11,\[/.test(i.t) || i.mn === Mnemonic.Call));
  let zoneTier, CHANCE_VA, iFin;
  if (L[iTier].mn !== Mnemonic.Call) {
    const TIER_VA = L[iTier].rip;
    CHANCE_VA = L[idx(L, /^lea r11,\[/, iTier + 1)].rip;
    zoneTier = Array.from({ length: NZ }, (_, z) => u64(TIER_VA + z * 8));
    iFin = iTier;
  } else {
    const ZT = L[iTier].br;
    zoneTier = Array.from({ length: NZ }, (_, z) => {
      const r = E.run({ start: ZT, maxSteps: 2000, calls: emuCalls, regs: { RCX: BigInt(z) } });
      return Number(r.api.regs[r.api.Register.RAX]);
    });
    const iCh = L.findIndex((i, n) => n > iTier && /^lea r[a-z0-9]+,\[rel /.test(i.t) && /^movss xmm\d+,\[r[a-z0-9]+\+rax\*4\]$/.test(L[n + 1].t));
    CHANCE_VA = L[iCh].rip;
    iFin = iCh;
  }
  const FINAL = parseInt(/\+([0-9A-F]+)h\],0$/.exec(L[idx(L, /^cmp byte \[r[a-z0-9]+(\+r[a-z0-9]+)?\+[0-9A-F]+h\],0$/, iFin)].t)[1], 16);
  const NT = Math.max(...zoneTier) + 1;
  const chance = f32s(CHANCE_VA, NT).map(clean);
  // cle de zone : premiere chaine en minuscules du bloc
  let KEY = -1;
  for (let k = 0; k < 0x40 && KEY < 0; k += 8) { const s = P.str(off(ZONES + k), 40); if (s && /^[a-z_]+$/.test(s)) KEY = k; }
  if (KEY < 0) die("cle de zone introuvable");
  const zones = Array.from({ length: NZ }, (_, z) => {
    const zb = ZONES + z * ZSTRIDE;
    const key = strAt(zb + KEY);
    const bp = u64(zb + BOSS_PTR), bn = Math.min(u64(zb + BOSS_PTR + 8), NB);
    const bosses = Array.from({ length: bn }, (_, i) => ({ idx: i, raw: strAt(bp + i * BSTRIDE), id: u32(bp + i * BSTRIDE + 64), final: b[off(bp + i * BSTRIDE + FINAL)] !== 0 }));
    return { idx: z, key, tier: zoneTier[z], bosses };
  });
  for (let t = 0; t < NT; t++) { // repartition des pieces d'armure, comme la closure 0x145f99b80 (0.139.0)
    const list = [];
    for (const z of zones) if (z.tier === t) for (const bo of z.bosses) if (!bo.final) list.push(bo);
    list.forEach((bo, pos) => { bo.pieces = [...Array(8).keys()].filter((i) => i % list.length === pos); });
  }
  // Tier 0.5 (0.141, Scholomance) : cmp rax,7 ; ... ; call fn(classe, id du boss) -> 2 pieces fixes par boss,
  // fiches {id u32, piece +8, piece +0x10} chargees par lea rdi,[fiche]. Remplace la repartition generique.
  const iT05 = L.findIndex((i) => /^cmp rax,7$/.test(i.t));
  if (iT05 >= 0) {
    const F = decodeFn(L[nextCall(L, iT05)].br);
    const fixed = {};
    for (const i of F) if (/^lea rdi,\[rel /.test(i.t)) fixed[u32(i.rip)] = [u32(i.rip + 8), u32(i.rip + 0x10)];
    for (const z of zones) if (z.tier === 7) for (const bo of z.bosses) if (!bo.final && fixed[bo.id]) bo.pieces = fixed[bo.id];
  }
  // Tirage (0x145ee3370 sur 0.139.0) : (chance + bonus de la partie + echecs * k) * mult heroique > aleatoire.
  // movzx ecx,byte [rsi+niveau] ; lea edx,[rcx-6] ; cmp dl,0FBh ; setb r8b : niveaux 1..5 lus dans une table.
  const heroHits = find([0x8d, 0x51, 0xfa, 0x80, 0xfa, 0xfb, 0x41, 0x0f, 0x92, 0xc0], (o) => same(o + 10, [0x48, 0x8d, 0x14, 0x49, 0xc1, 0xe2, 0x04, 0x48, 0x8d, 0x0d]));
  let heroic = null, pity = null;
  if (heroHits.length === 1) {
    const H = decodeFn(toTextVA(heroHits[0]));
    const at = H.findIndex((i) => i.ip === toTextVA(heroHits[0]));
    const NH = 0x100 - b[heroHits[0] + 5];
    const stride = /^shl edx,4$/.test(H[at + 4].t) && /^lea rdx,\[rcx\+rcx\*2\]$/.test(H[at + 3].t) ? 48 : null;
    const HT = H[idx(H, /^lea rcx,\[/, at)].rip;
    const iXp = idx(H, /^movss xmm0,\[/, at);
    const XP_NORMAL = f32(H[iXp].rip);
    const xpOff = stride - negDisp(H[idx(H, /^movss xmm0,\[rcx-[0-9A-F]+h?\]$/, at)].t);
    const iLoot = idx(H, /^movss xmm7,\[/, at);
    const LOOT_NORMAL = f32(H[iLoot].rip);
    const lootOff = stride - negDisp(H[idx(H, /^movss xmm7,\[rcx-[0-9A-F]+h?\]$/, iLoot)].t);
    const iCall = H.findIndex((i, n) => n > iLoot && i.mn === Mnemonic.Call);
    pity = clean(f32(H[idx(H, /^movss xmm9,\[/, iCall)].rip));
    if (stride) heroic = {
      normal: { lootMult: clean(LOOT_NORMAL), xpMult: clean(XP_NORMAL) },
      levels: Array.from({ length: NH }, (_, h) => {
        const e = HT + h * stride;
        const aff = [P.str(off(e), 200), P.str(off(e + 16), 200)];
        return { level: h + 1, lootMult: clean(f32(e + lootOff)), xpMult: clean(f32(e + xpOff)), affixes: aff.map((s) => (s == null ? null : tr(s, s))) };
      }),
    };
  } else {
    // 0.141 : le tirage a change de forme ; on lit les accesseurs du niveau heroique (un par champ) :
    // lea eax,[rcx-6] ; cmp al,0FBh ; ... ; lea rax,[table] ; ... ; movss xmm0,[normal] ; ret ; movss xmm0,[rax-K] ; ret
    const getters = find([0x8d, 0x41, 0xfa, 0x3c, 0xfb, 0x0f, 0x92, 0xc2, 0x0f, 0xb6, 0xc1, 0x48, 0x8d, 0x0c, 0x40, 0xc1, 0xe1, 0x04, 0x48, 0x8d, 0x05], () => true).map((o) => {
      const G = decode(toTextVA(o), 0x38);
      const iN = idx(G, /^movss xmm0,\[rel /), iK = idx(G, /^movss xmm0,\[rax-[0-9A-F]+h?\]$/);
      return { HT: G[idx(G, /^lea rax,\[rel /)].rip, NH: 0x100 - b[o + 4], normal: f32(G[iN].rip), k: negDisp(G[iK].t) };
    });
    const g = (k) => getters.find((x) => x.k === k);
    const stride = 48, xp = g(8), loot = g(4); // xp +40, butin +44 dans la fiche de 48 octets (comme 0.139)
    if (xp && loot && xp.HT === loot.HT) heroic = {
      normal: { lootMult: clean(loot.normal), xpMult: clean(xp.normal) },
      levels: Array.from({ length: xp.NH }, (_, h) => {
        const e = xp.HT + h * stride;
        const aff = [P.str(off(e), 200), P.str(off(e + 16), 200)];
        return { level: h + 1, lootMult: clean(f32(e + stride - loot.k)), xpMult: clean(f32(e + stride - xp.k)), affixes: aff.map((s) => (s == null ? null : tr(s, s))) };
      }),
    };
    else console.error("gear-extract : table heroique : " + heroHits.length + " candidats, heroic = null");
    // tirage : appelant de la fonction de butin qui charge le mult. heroique ([r-4]) juste avant, puis movss xmm9,[k]
    const LF = fnAt(toTextVA(lootHits[0])).start;
    for (const o of find([0xe8], (q) => toTextVA(q) + 5 + i32At(q + 1) === LF)) {
      const C = decodeFn(toTextVA(o));
      const ic = C.findIndex((i) => i.ip === toTextVA(o));
      if (ic < 0 || !C.slice(Math.max(0, ic - 12), ic).some((i) => /^movss xmm\d+,\[r[a-z0-9]+-4\]$/.test(i.t))) continue;
      const ip = C.findIndex((i, n) => n > ic && /^movss xmm9,\[rel /.test(i.t));
      if (ip > 0) { pity = clean(f32(C[ip].rip)); break; }
    }
  }
  const bonusText = ["Bosses are 5% more likely to drop each piece.", "Bosses are 10% more likely to drop each piece."].filter((s) => b.indexOf(Buffer.from(s)) >= 0);
  return {
    source: "fonction de butin (cmp r8," + NZ + " ; cmp r9," + NB + ") et tirage du boss, lecture statique",
    rules: {
      perPiece: true, duplicateAddsNothing: true, chanceByTier: chance,
      formula: "(chance du palier + bonus de la partie + echecs * pityPerMiss) * lootMult heroique > aleatoire [0,1)",
      pityPerMiss: pity,
      runBonus: { values: null, texts: bonusText.map((s) => tr(s, s)), note: "bonus additif de la partie, source exacte non retrouvee" },
      finalBoss: "toutes les armes de la classe (weaponSlots)", otherBosses: "les 8 pieces d'armure du palier, partagees entre les boss non finaux des zones de ce palier",
    },
    heroic: heroic && { ...heroic, sameDrops: true, note: "le Heroique ne change ni le palier ni les pieces, seulement la chance (lootMult) ; il ouvre aussi les etoiles (armory.star_cap_none)" },
    zones: zones.map((z) => ({
      idx: z.idx, key: z.key, name: tr("zone." + z.key + ".name"), tier: z.tier, rarity: tr("rarity." + z.tier), chance: chance[z.tier],
      pieces: z.bosses.flatMap((bo) => bo.pieces || []).sort((x, y) => x - y), weapons: z.bosses.some((bo) => bo.final),
      bosses: z.bosses.map((bo) => ({ idx: bo.idx, id: bo.id, name: tr(LOC_EN["boss." + bo.id + ".name"] === bo.raw ? "boss." + bo.id + ".name" : bo.raw, bo.raw), final: bo.final, pieces: bo.final ? [] : bo.pieces, weapons: bo.final })),
    })),
  };
})();

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
  tiers, classes, t05, drops,
};
fs.writeFileSync(out, JSON.stringify(data));
console.log("ecrit", out, (fs.statSync(out).size / 1024).toFixed(0) + " Ko", "version", VER, Object.keys(classes).length, "classes");
