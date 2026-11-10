// Amulettes legendaires : execute la fonction du jeu qui construit le collier d'un sort (tools/emu.js) pour chaque
// sort de la table. Aucune adresse codee en dur : la fonction est celle qui reference les noms de colliers, les
// appels sont classes par leur forme (format_args, recherche de traduction, cales de l'allocateur, imports) et le
// reste est execute. Usage : node tools/legendary.js <exe> <sortie.json> [dossier loc]
const fs = require("fs");
const makeEmu = require("./emu.js");
const locate = require("./locate.js");
const [exe, outJson] = process.argv.slice(2);
const E = makeEmu(exe);
const P = E.P;
const L = locate(P);
const { Mnemonic, OpKind } = require("iced-x86");
const hex = (n) => "0x" + Number(n).toString(16);

// Fonction des colliers : seule fonction qui reference ces noms (0.119 a 0.143)
const FN = L.fnByStrings(["Amulet of the Inferno", "Heart of the Earthbreaker", "The Eternal Talisman"]);
const { end: FN_END } = L.fnAt(FN);
const ABIL = L.abilities();

// Gabarit format_args (Rust 1.9x) : octet n < 0x80 = n octets litteraux, 0xC0 = argument suivant, 0x00 = fin
const parseTpl = (va) => {
  const o = P.toOff(BigInt(va));
  if (o < 0) return null;
  const parts = [];
  for (let q = o; q < o + 200;) {
    const c = P.buf[q];
    if (c === 0) return parts.some((x) => x === null) ? parts : null;
    if (c === 0xc0) { parts.push(null); q++; continue; }
    if (c >= 0x80) return null;
    const s = P.buf.toString("latin1", q + 1, q + 1 + c);
    if (!/^[\x20-\x7e]+$/.test(s)) return null;
    parts.push(s); q += 1 + c;
  }
  return null;
};

// Classement des appels de la fonction par la forme du site d'appel
const insns = [];
for (let ip = FN; ip < FN_END;) { const i = E.decodeAt(ip); insns.push(i); ip += i.length; }
const fmtTargets = [], lookupTargets = [];
insns.forEach((ins, n) => {
  if (ins.mnemonic !== Mnemonic.Call || ins.op0Kind !== OpKind.NearBranch64) return;
  const t = Number(ins.nearBranch64);
  // format(out=rcx, gabarit=rdx, args=r8) : lea rdx,[gabarit] dans les 4 instructions precedentes
  if (insns.slice(Math.max(0, n - 4), n).some((p) => p.mnemonic === Mnemonic.Lea && p.isIpRelMemoryOperand && E.fmt.format(p).startsWith("lea rdx,") && parseTpl(p.ipRelMemoryAddress))) fmtTargets.push(t);
  // traduction(cle) -> Option<&str> : resultat teste juste apres (test rax,rax ; cmov)
  const nx = insns.slice(n + 1, n + 4).filter((p) => p.mnemonic !== Mnemonic.Nop);
  if (nx.length && E.fmt.format(nx[0]) === "test rax,rax" && nx[1] && /^cmov/.test(E.fmt.format(nx[1]))) lookupTargets.push(t);
});
const FMT = L.one(fmtTargets, "fonction de formatage");
const LOOKUP = L.one(lookupTargets, "recherche de traduction");
const SHIM = L.allocShims();
console.error("fonction", hex(FN), "sorts", hex(Number(P.toVA(ABIL.off))), ABIL.n, "format", hex(FMT), "traduction", hex(LOOKUP), "allocateur", hex(SHIM.alloc));

const readStr = (api, ptr, len) => {
  if (len === 0n) return "";
  if (len > 4096n) throw new Error("chaine trop longue");
  return Buffer.from(api.rd(ptr, Number(len))).toString("utf8");
};
const writeString = (api, dest, s) => { // String Rust {cap, ptr, len}
  const bytes = Buffer.from(s, "utf8");
  const p = api.alloc(bytes.length || 1);
  if (bytes.length) api.wr(p, bytes);
  api.wrInt(dest, 8, BigInt(bytes.length));
  api.wrInt(dest + 8n, 8, p);
  api.wrInt(dest + 16n, 8, BigInt(bytes.length));
};
let fmtFn = null; // un seul formateur attendu (Display pour &str)
const copy = (api) => {
  const R = api.Register, n = Number(api.regs[R.R8]);
  if (n) api.wr(api.regs[R.RCX], Buffer.from(api.rd(api.regs[R.RDX], n)));
  api.regs[R.RAX] = api.regs[R.RCX];
};
const IMPORTS = {
  memcpy: copy, memmove: copy,
  memset: (api) => { const R = api.Register, n = Number(api.regs[R.R8]); if (n) api.wr(api.regs[R.RCX], Buffer.alloc(n, Number(api.regs[R.RDX] & 0xffn))); api.regs[R.RAX] = api.regs[R.RCX]; },
  memcmp: (api) => { const R = api.Register, n = Number(api.regs[R.R8]); api.regs[R.RAX] = BigInt.asUintN(64, BigInt(Buffer.compare(Buffer.from(api.rd(api.regs[R.RCX], n)), Buffer.from(api.rd(api.regs[R.RDX], n))))); },
};
const HANDLERS = {
  [FMT]: (api) => {
    const R = api.Register;
    const parts = parseTpl(api.regs[R.RDX]);
    if (!parts) throw new Error("gabarit illisible " + hex(api.regs[R.RDX]));
    let k = 0, s = "";
    for (const p of parts) {
      if (p !== null) { s += p; continue; }
      const a = api.regs[R.R8] + BigInt(k++ * 16);
      const v = api.rdInt(a, 8), f = api.rdInt(a + 8n, 8);
      if (fmtFn === null) fmtFn = f;
      if (f !== fmtFn) throw new Error("formateur inattendu " + hex(f));
      s += readStr(api, api.rdInt(v, 8), api.rdInt(v + 8n, 8));
    }
    writeString(api, api.regs[R.RCX], s);
  },
  // pas de traduction : le jeu retombe sur le texte anglais de la fiche
  [LOOKUP]: (api) => { api.regs[api.Register.RAX] = 0n; },
  [SHIM.alloc]: (api) => { api.regs[api.Register.RAX] = api.alloc(Number(api.regs[api.Register.RCX]) || 1); },
  [SHIM.allocZeroed]: (api) => { api.regs[api.Register.RAX] = api.alloc(Number(api.regs[api.Register.RCX]) || 1); },
  [SHIM.dealloc]: () => {},
  [SHIM.realloc]: (api) => { // (ptr, ancienne taille, alignement, nouvelle taille)
    const R = api.Register, old = Number(api.regs[R.RDX]), n = Number(api.regs[R.R9]);
    const p = api.alloc(n || 1);
    if (old) api.wr(p, Buffer.from(api.rd(api.regs[R.RCX], Math.min(old, n))));
    api.regs[R.RAX] = p;
  },
};
const onCall = (t) => {
  const name = L.thunkName(t);
  if (name) { if (IMPORTS[name]) return IMPORTS[name]; throw new Error("import non gere " + name); }
  return "follow";
};

const OUT = 0x100000000800n;
const results = [];
for (let i = 0; i < ABIL.n; i++) {
  const off = ABIL.off + i * 120;
  const key = P.str(off, 40);
  try {
    const r = E.run({ start: FN, maxSteps: 200000, regs: { RDX: P.toVA(off), RCX: OUT }, calls: HANDLERS, onCall });
    if (!r.ret) throw new Error("pas de retour");
    const a = r.api;
    // Sortie : +0x00 id String, +0x18 titre String "Famille: Sort", +0x30 Vec<Effet 64 o> {cap, ptr, len}, +0x48 icone &str
    const sAt = (o, l) => readStr(a, a.rdInt(OUT + BigInt(o), 8), a.rdInt(OUT + BigInt(l), 8));
    const id = sAt(0x08, 0x10), title = sAt(0x20, 0x28), icon = sAt(0x48, 0x50);
    const vptr = a.rdInt(OUT + 0x38n, 8), vlen = Number(a.rdInt(OUT + 0x40n, 8));
    if (vlen > 64) throw new Error("trop d'effets " + vlen);
    const effects = [];
    for (let k = 0; k < vlen; k++) effects.push(Buffer.from(a.rd(vptr + BigInt(k * 64), 64)).toString("hex"));
    const spell = P.str(off + 16, 60);
    const family = title.endsWith(": " + spell) ? title.slice(0, -spell.length - 2) : title.split(": ")[0];
    results.push({ i, key, id, family, icon, effects });
    console.log(i, key, "|", family, "|", icon, "|", effects.length, "effects");
  } catch (e) {
    console.log(i, key, "ERROR", e.message);
    results.push({ i, key, error: e.message });
  }
}
const errs = results.filter((r) => r.error).length;
fs.writeFileSync(outJson, JSON.stringify(results, null, 1));
if (errs) { console.error(errs + " erreurs"); process.exitCode = 1; }
