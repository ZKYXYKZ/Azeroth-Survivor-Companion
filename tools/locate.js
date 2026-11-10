// Reperes de l'exe retrouves par motif (aucune adresse codee en dur) : table des sorts, fonctions par
// chaine referencee, cales de l'allocateur Rust, imports. Chaque recherche echoue bruyamment si elle est ambigue.
const fail = (m) => { throw new Error("locate : " + m); };

module.exports = function locate(P) {
  const { buf, ib } = P;
  const text = P.sec(".text"), rd = P.sec(".rdata"), pd = P.sec(".pdata");
  const textVA = Number(ib) + text.va;
  const one = (xs, what) => { const s = [...new Set(xs)]; if (s.length !== 1) fail(what + " : " + s.length + " candidats"); return s[0]; };

  // Table des sorts : entrees de 120 octets {cle, nom, icone, ameliorations, id du sort...}, meme test que extract-data.js
  const isAbility = (o) => {
    const k = P.str(o, 40);
    if (!k || !/^[a-z0-9_]+$/.test(k)) return false;
    const n = P.str(o + 16, 60);
    if (!n || /[{}]/.test(n)) return false;
    const ic = P.str(o + 32, 60);
    if (!ic || !/^[A-Za-z0-9_]+$/.test(ic) || !/_/.test(ic)) return false;
    const s = P.slice(o + 48);
    return s.off > 0 && s.len >= 1 && s.len <= 8 && buf.slice(s.off, s.off + s.len).every((x) => x < 16);
  };
  let abil = null;
  const abilities = () => {
    if (abil) return abil;
    const groups = [];
    for (let o = rd.raw; o < rd.raw + rd.rs - 120; o += 8) {
      if (!isAbility(o)) continue;
      const g = groups.find((x) => x.end === o);
      if (g) { g.items.push(o); g.end = o + 120; } else groups.push({ end: o + 120, items: [o] });
    }
    const big = groups.filter((g) => g.items.length > 100);
    if (big.length !== 1) fail("table des sorts : " + big.length + " candidats");
    abil = { off: big[0].items[0], n: big[0].items.length };
    return abil;
  };

  // Bornes de fonction (.pdata)
  const fnAt = (va) => {
    const r = Number(va) - Number(ib);
    for (let o = pd.raw; o < pd.raw + pd.rs; o += 12) {
      const s = buf.readUInt32LE(o), e = buf.readUInt32LE(o + 4);
      if (r >= s && r < e) return { start: s + Number(ib), end: e + Number(ib) };
    }
    fail("fonction introuvable pour 0x" + Number(va).toString(16));
  };

  // References RIP (disp32) du code vers des adresses de .rdata : Map adresse -> sites
  const refsTo = (vas) => {
    const set = new Set(vas.map(Number)), hits = new Map();
    for (let i = text.raw; i < text.raw + text.rs - 4; i++) {
      const t = textVA + (i - text.raw) + 4 + buf.readInt32LE(i);
      if (set.has(t)) { if (!hits.has(t)) hits.set(t, []); hits.get(t).push(textVA + (i - text.raw)); }
    }
    return hits;
  };
  const stringVAs = (s) => {
    const n = Buffer.from(s), out = [];
    for (let at = buf.indexOf(n, rd.raw); at >= 0 && at < rd.raw + rd.rs; at = buf.indexOf(n, at + 1)) out.push(Number(P.toVA(at)));
    return out;
  };
  // fonction unique qui reference toutes ces chaines (intersection)
  const fnByStrings = (strs) => {
    const vas = strs.map(stringVAs);
    const refs = refsTo(vas.flat());
    let common = null;
    strs.forEach((s, k) => {
      const fns = new Set(vas[k].flatMap((v) => refs.get(v) || []).map((r) => fnAt(r).start));
      if (!fns.size) fail("chaine non referencee : " + s);
      common = common ? new Set([...common].filter((f) => fns.has(f))) : fns;
    });
    return one([...common], "fonction commune a " + strs.join(" / "));
  };

  // Cales de l'allocateur Rust (__rust_alloc, __rust_dealloc, __rust_realloc, __rust_alloc_zeroed) : 4 jmp rel32
  // alignes sur 16 octets, bourrage int3, suivis d'un ret (__rust_no_alloc_shim_is_unstable). Ordre fixe du compilateur.
  const allocShims = () => {
    const hits = [];
    const isJmp = (o) => buf[o] === 0xe9 && buf.subarray(o + 5, o + 16).every((x) => x === 0xcc);
    for (let o = text.raw; o < text.raw + text.rs - 0x50; o += 16) {
      if (isJmp(o) && isJmp(o + 16) && isJmp(o + 32) && isJmp(o + 48) && buf[o + 64] === 0xc3 && !isJmp(o - 16)) hits.push(textVA + (o - text.raw));
    }
    const a = one(hits, "cales de l'allocateur");
    return { alloc: a, dealloc: a + 16, realloc: a + 32, allocZeroed: a + 48 };
  };

  // Imports : adresse de l'IAT -> nom ; thunk jmp [rip+IAT] -> nom
  let iat = null;
  const imports = () => {
    if (iat) return iat;
    iat = new Map();
    const pe = buf.readUInt32LE(0x3c), opt = pe + 24;
    const dir = buf.readUInt32LE(opt + 112 + 8);
    const at = (rva) => P.toOff(ib + BigInt(rva));
    for (let d = at(dir); buf.readUInt32LE(d + 12); d += 20) {
      const oft = buf.readUInt32LE(d), ft = buf.readUInt32LE(d + 16);
      for (let i = 0; ; i++) {
        const e = buf.readBigUInt64LE(at(oft || ft) + i * 8);
        if (!e) break;
        if (e >> 63n) continue; // par ordinal
        const no = at(Number(e)) + 2;
        iat.set(Number(ib) + ft + i * 8, buf.toString("latin1", no, buf.indexOf(0, no)));
      }
    }
    return iat;
  };
  const thunkName = (va) => {
    const o = P.toOff(BigInt(va));
    if (o < 0 || buf[o] !== 0xff || buf[o + 1] !== 0x25) return null;
    return imports().get(Number(va) + 6 + buf.readInt32LE(o + 2)) || null;
  };

  return { abilities, fnAt, refsTo, stringVAs, fnByStrings, allocShims, imports, thunkName, one };
};
