const fs = require("fs");
const path = require("path");
const load = require("./pe.js");
const [exe, legJson, locDir, outJson, jewelJson] = process.argv.slice(2);
const P = load(exe);
const { buf, str } = P;
const leg = JSON.parse(fs.readFileSync(legJson, "utf8"));
const L = { en: JSON.parse(fs.readFileSync(path.join(locDir, "loc-1.json"), "utf8")), fr: JSON.parse(fs.readFileSync(path.join(locDir, "loc-7.json"), "utf8")) };
const LOC8 = require("./locate.js")(P);
const ABIL = LOC8.abilities(); // table des sorts trouvee par signature (115 en 0.141)
const abil = {};
const bySpellId = {};
for (let i = 0; i < ABIL.n; i++) {
  const o = ABIL.off + i * 120;
  const key = str(o, 40);
  abil[key] = { key, spell: buf.readUInt32LE(o + 64), kind: buf[o + 0x75], sub: buf.readUInt32LE(o + 0x68) };
  bySpellId[abil[key].spell] = key;
}
const pct = (x) => {
  const v = x * 100;
  return (Math.abs(v - Math.round(v)) < 0.05 ? String(Math.round(v)) : v.toFixed(1)) + "%";
};
const num = (x) => (Math.abs(x - Math.round(x)) < 0.01 ? String(Math.round(x)) : String(+x.toFixed(2)));
const spellName = (lang, key) => L[lang]["ability." + key + ".name"] || key;
const t = (lang, k, vars) => {
  let s = L[lang][k] || L.en[k] || k;
  for (const [a, b] of Object.entries(vars || {})) s = s.split("{" + a + "}").join(b);
  return s;
};
const keyAt = (b, o) => {
  const v = b.readBigUInt64LE(o);
  const len = Number(b.readBigUInt64LE(o + 8));
  const off = P.toOff(v);
  if (off < 0 || len <= 0 || len > 40) return null;
  return buf.toString("utf8", off, off + len);
};
const STATS = ["+{p} damage", "-{p} cooldowns", "+{p} max health", "+{p} critical strike", "+{p} critical strike damage", "+{p} damage reduction", "+{v} health per second", "+{p} movement speed", "+{p} area of effect", "+{p} pickup range", "+{p} experience", "+{p} gold", "+{p} luck", "{p} chance for a spell to cast twice", "Heals you for {p} of all damage dealt", "Each kill heals {v} health", "+{p} weapon damage", "+{p} pet damage", "+{p} damage to crowd-controlled enemies", "+{p} damage to elites and bosses", "+{p} damage to enemies below 30% health", "+{p} damage to afflicted enemies", "Melee attackers take {p} of the damage they deal", "+{p} buff power", "+{p} of max health per second"];
const cap = (s) => s.charAt(0).toUpperCase() + s.slice(1);

function render(lang, hex, ownerKey) {
  const b = Buffer.from(hex, "hex");
  // 0.141 : etiquettes 0x0f a 0x3a = celles de 0.139 + 12, stats 0x48/0x49 (0x2f/0x30 en 0.139). Charges utiles
  // deplacees : cible des coups ({hits}) en +8 (sort en +0x10/+0x18), valeurs apres. Fonction de redaction 0x1460655f8.
  const tag = b[0];
  const f = (o) => b.readFloatLE(o);
  const u = (o) => b.readUInt32LE(o);
  const hitsAt = (o) => {
    if (b[o] === 1) {
      const k = keyAt(b, o + 8);
      if (k) return t(lang, "{spell}'s hits", { spell: spellName(lang, k) });
    }
    return t(lang, "your hits");
  };
  const who = (o) => spellName(lang, (b[o] === 1 && keyAt(b, o + 8)) || ownerKey);
  switch (tag) {
    case 0x49: { // 0x30 en 0.139, 0x2c en 0.135.1
      const k = b[8] === 1 ? keyAt(b, 0x10) : null;
      const who = k ? spellName(lang, k) : "";
      const v = f(0x20);
      const stat = b[0x24];
      if (stat === 0) {
        const a = k && abil[k];
        if (a && a.kind === 9 && a.sub === 6) return t(lang, "{who}: +{g} healing", { who, g: pct(Math.sqrt(1 + v) - 1) });
        if (a && a.kind === 9 && a.sub === 7) return t(lang, "{who}: +{g} absorb", { who, g: pct(Math.sqrt(1 + v) - 1) });
        return t(lang, "{who}: +{v} damage", { who, v: pct(v) });
      }
      if (stat === 1) return t(lang, "{who}: -{v} cooldown", { who, v: pct(v) });
      if (stat === 2 && !k) return t(lang, Math.round(v) === 1 ? "{who}: +{n} target" : "{who}: +{n} targets", { who, n: num(v) }).replace(/^\s*:\s*/, "");
      if (stat === 2) return t(lang, Math.round(v) === 1 ? "{who}: +{n} target" : "{who}: +{n} targets", { who, n: num(v) });
      if (stat === 3) return t(lang, "{who}: +{v} area", { who, v: pct(v) });
      if (stat === 4) return t(lang, "{who}: +{v} duration", { who, v: pct(v) });
      if (stat === 5) return t(lang, "{who}: +{v} of max health as damage", { who, v: pct(v) });
      if (stat === 6) return t(lang, "{who}: +{v} proc rate", { who, v: pct(v) });
      // 7 a 9 nouveaux en 0.141
      if (stat === 7) return t(lang, "{who}: +{g} healing", { who, g: pct(v) });
      if (stat === 8) return t(lang, "{who}: +{v} damage", { who, v: pct(v) });
      if (stat === 9) return t(lang, "{who}: +{v} absorb cap", { who, v: pct(v) });
      return null;
    }
    case 0x37: // 0x2b en 0.139
      return t(lang, "{spell}'s primary hit unleashes a seismic shockwave, dealing {p} damage to enemies within {r} yd.", { spell: spellName(lang, ownerKey), p: pct(f(4)), r: num(f(8)) });
    case 0x38:
      return t(lang, "{spell}: {p} chance to cast a free {cast}", { spell: spellName(lang, ownerKey), p: pct(f(4)), cast: spellName(lang, "chain_lightning") });
    case 0x39:
      return t(lang, "{spell}'s free {cast} deals {p} damage", { spell: spellName(lang, ownerKey), p: pct(f(4)), cast: spellName(lang, "chain_lightning") });
    case 0x3a:
      return t(lang, "{spell} instantly deals {p} of your remaining {dot} damage to enemies hit, without removing {dot}.", { spell: spellName(lang, ownerKey), p: pct(f(4)), dot: spellName(lang, "flame_shock") });
    case 0x31: // 0x25 en 0.139
      return t(lang, "{spell} slows by {pct} for {secs} sec", { spell: spellName(lang, keyAt(b, 8) || ownerKey), pct: pct(f(0x18)), secs: num(f(0x1c)) });
    case 0x32:
      return t(lang, "{spell} deals {bonus} more damage to already chilled enemies", { spell: spellName(lang, keyAt(b, 8) || ownerKey), bonus: pct(f(0x18)) });
    case 0x33:
      return t(lang, "{spell} deals {bonus} more damage to enemies below {below} health", { spell: spellName(lang, keyAt(b, 8) || ownerKey), bonus: pct(f(0x18)), below: pct(f(0x1c)) });
    case 0x34:
      return t(lang, "A kill with {spell} cuts its remaining cooldown by {frac}", { spell: spellName(lang, keyAt(b, 8) || ownerKey), frac: pct(f(0x18)) });
    case 0x35:
      return t(lang, "Each tick of {spell} also hits {n} nearby enemies within {radius} yd for {frac} damage", { spell: spellName(lang, keyAt(b, 8) || ownerKey), n: String(u(0x18)), frac: pct(f(0x1c)), radius: num(f(0x20)) });
    case 0x3d: // collier du Chasseur (0.141, Heart of the Packlord)
      return t(lang, "Wolf: Howl makes {n} nearby enemies take {p} more damage from you", { n: String(u(8)), p: pct(f(4)) });
    case 0x3e:
      return t(lang, "Raptor: {spell} bleeds nearby enemies for {p} of its strike damage over {secs} sec", { spell: spellName(lang, "kill_command"), p: pct(f(4)), secs: num(f(0xc)) });
    case 0x3f:
      return t(lang, "Devilsaur Matriarch: {spell} unleashes a devastating shockwave", { spell: spellName(lang, "kill_command") });
    case 0x0f: // 3 en 0.139
      if (u(8) !== 10) return t(lang, "A hidden power");
      return t(lang, "A broken shield bursts for {frac} of what it absorbed on enemies within {radius} yd", { frac: pct(f(0x28)), radius: num(f(0x2c)) });
    case 0x10:
      return cap(t(lang, "{hits} splash {frac} on enemies within {radius} yd", { hits: hitsAt(0x10), frac: pct(f(0x28)), radius: num(f(0x2c)) }));
    case 0x12: {
      const n = u(0x28);
      const k = n === 1 ? "{hits} leap to 1 more enemy for {frac}" : "{hits} leap to {n} more enemies for {frac}";
      return cap(t(lang, k, { hits: hitsAt(0x10), n: String(n), frac: pct(f(0x2c)) }));
    }
    case 0x13:
      return cap(t(lang, "{chance} chance for {hits} to strike again for {frac}", { chance: pct(f(0x28)), hits: hitsAt(0x10), frac: pct(f(0x30)) }));
    case 0x14: {
      const kind = u(0x28) | 0;
      const hits = hitsAt(0x10);
      if (kind === 3) return cap(t(lang, "{hits} stun for {s} sec", { hits, s: num(f(0x2c)) }));
      if (kind === 2) return cap(t(lang, "{hits} root for {s} sec", { hits, s: num(f(0x2c)) }));
      if (kind === -1) return cap(t(lang, "{hits} leave enemies taking {v} more damage for {s} sec", { hits, v: pct(f(0x2c)), s: num(f(0x30)) }));
      return cap(t(lang, "{hits} hinder enemies", { hits }));
    }
    case 0x15:
      return cap(t(lang, "{hits} burn and bleed for {frac} more over {dur} sec", { hits: hitsAt(0x10), frac: pct(f(0x2c)), dur: num(f(0x30)) }));
    case 0x16:
      return t(lang, "A kill with {who} readies it again at once", { who: who(8) });
    case 0x17: {
      const frac = pct(f(0x20));
      if (b[8] === 1) {
        const spell = spellName(lang, keyAt(b, 0x10) || ownerKey);
        if (b[0x30] === 0) return t(lang, "Enemies {spell} kills explode for {frac} of their max health", { spell, frac });
        return t(lang, "Enemies that die with {spell} on them explode for {frac} of their max health", { spell, frac });
      }
      return t(lang, "Enemies you kill explode for {frac} of their max health", { frac });
    }
    case 0x18: {
      const k = bySpellId[u(4)] || ownerKey;
      return t(lang, "Enemies you kill during {spell} explode for {frac} of their max health", { spell: spellName(lang, k), frac: pct(f(8)) });
    }
    case 0x19:
      return t(lang, "{spell} explodes a second time for {frac} of its damage", { spell: spellName(lang, keyAt(b, 8) || ownerKey), frac: pct(f(0x18)) });
    case 0x1a:
      return t(lang, "{who} leaps to {n} enemies when its victim dies", { who: who(8), n: String(u(0x20)) });
    case 0x1b:
      if (u(8) !== 7 || b[0x34] !== 0x0e) return t(lang, "A hidden power");
      return t(lang, "While {spell} heals you, {p} of the damage you deal heals you too", { spell: spellName(lang, (b[0x10] === 1 && keyAt(b, 0x18)) || ownerKey), p: pct(f(0x28)) });
    case 0x1e:
      return t(lang, "{spell} also shields you for {frac} of your max health", { spell: spellName(lang, (b[0x10] === 1 && keyAt(b, 0x18)) || ownerKey), frac: pct(f(0x28)) });
    case 0x1f:
      return t(lang, "A killing blow leaves you at {heal} health instead, once every {cd} sec", { heal: pct(f(8)), cd: num(f(4)) });
    case 0x48: { // 0x2f en 0.139, 0x2b en 0.135.1
      const tpl = STATS[b[8]];
      if (!tpl) return t(lang, "A hidden power");
      const v = f(4);
      // collier de Courroux des tempetes (0.141) : la stat 19 est redigee au nom du sort (0x145e0b6e2)
      if (ownerKey === "stormstrike" && b[8] === 0x13) return t(lang, "{spell}: +{p} damage to bosses and elites", { spell: spellName(lang, ownerKey), p: pct(v) });
      return t(lang, tpl, { p: pct(v), v: num(v) });
    }
    case 0x22: // 22 en 0.139
      return t(lang, "Every totem pulse heals you {frac} of max health", { frac: pct(f(4)) });
    case 0x23:
      return t(lang, "Chains lose nothing on each jump");
    default:
      return t(lang, "A hidden power");
  }
}

const out = {};
for (const r of leg) {
  if (!r.family) continue;
  const lines = { en: [], fr: [] };
  if (!r.effects.length) continue; // lightning_shield, healing_wave : plus de collier depuis 0.134
  for (const h of r.effects) for (const lang of ["en", "fr"]) { const s = render(lang, h, r.key); if (s) lines[lang].push(s); }
  out[r.key] = { family: { en: r.family, fr: L.fr[r.family] || r.family }, icon: r.icon, lines };
}
fs.writeFileSync(outJson, JSON.stringify(out, null, 1));
// garde-fou : une etiquette d'effet inconnue (enum decale par une mise a jour) donne "A hidden power"
const hidden = Object.entries(out).filter(([, x]) => x.lines.en.includes("A hidden power")).map(([k]) => k);
if (hidden.length) { console.error("etiquettes d'effet inconnues (enum decale ?) : " + hidden.join(", ")); process.exitCode = 1; }
for (const k of ["flamestrike", "hurricane", "cleave", "execute", "holy_shock", "pw_shield", "renew", "magma_totem", "chain_lightning", "rend", "divine_shield", "polymorph", "bloodthirst", "whirlwind"]) {
  const x = out[k];
  if (x) console.log(k, "|", x.family.fr, "\n   ", x.lines.fr.join("\n    "), "\n   ", x.lines.en.join(" || "));
}

if (jewelJson) {
  const rd = P.sec(".rdata");
  // tables trouvees par signature : suite la plus longue d'entrees {cle, nom, icone, ...} au pas donne, unique
  const run = (stride, ok) => {
    const runs = [];
    for (let p = rd.raw; p < rd.raw + rd.rs - stride; p += 8) {
      if (!ok(p) || ok(p - stride)) continue;
      let n = 0;
      while (ok(p + n * stride)) n++;
      if (n >= 10) runs.push({ p, n });
    }
    if (runs.length !== 1) throw new Error("table de bijoux au pas " + stride + " : " + runs.length + " candidats");
    return runs[0];
  };
  const named = (p) => { const k = str(p, 40), ic = str(p + 32, 60); return !!(k && /^[a-z0-9_]+$/.test(k) && str(p + 16, 60) && ic && /^[A-Za-z0-9_]+$/.test(ic)); };
  const jw = { rings: {}, trinkets: {}, amulets: {} };
  // anneaux et bijoux : 72 octets, gabarit +48, valeur f32 +64, stat +68, sorte +69 (0 anneau, 1 bijou)
  const RB = run(72, (p) => named(p) && /\{v\}/.test(str(p + 48, 200) || "") && buf[p + 69] <= 1);
  for (let i = 0; i < RB.n; i++) {
    const o = RB.p + i * 72;
    const v = buf.readFloatLE(o + 64);
    const tpl = str(o + 48, 200);
    const line = {};
    for (const lang of ["en", "fr"]) line[lang] = t(lang, tpl, { v: num(tpl.includes("{v}%") ? v * 100 : v), max: "" }).replace(/,? \+\{h\}[^,]*$/, "").replace(/ \{max\}% (at most|au maximum)\.?/, "");
    jw[buf[o + 69] === 0 ? "rings" : "trinkets"][str(o, 40)] = line;
  }
  // amulettes : 80 octets, effets {ptr, n} +48, paliers +64/+72
  const AB = run(80, (p) => { if (!named(p)) return false; const n = buf.readBigUInt64LE(p + 56); return n >= 1n && n <= 8n && P.toOff(buf.readBigUInt64LE(p + 48)) >= 0 && buf.readBigUInt64LE(p + 64) < 16n; });
  for (let i = 0; i < AB.n; i++) {
    const o = AB.p + i * 80;
    const ep = P.toOff(buf.readBigUInt64LE(o + 48));
    const n = Number(buf.readBigUInt64LE(o + 56));
    const lines = { en: [], fr: [] };
    for (let k = 0; k < n; k++) {
      const hex = buf.slice(ep + k * 64, ep + k * 64 + 64).toString("hex");
      for (const lang of ["en", "fr"]) { const s = render(lang, hex, null); if (s) lines[lang].push(s); }
    }
    jw.amulets[str(o, 40)] = { lines, tier: [Number(buf.readBigUInt64LE(o + 64)), Number(buf.readBigUInt64LE(o + 72))] };
  }
  fs.writeFileSync(jewelJson, JSON.stringify(jw, null, 1));
  for (const [k, x] of Object.entries(jw.amulets)) console.log(k, x.tier.join("-"), "|", x.lines.fr.join(" ; "), "|", x.lines.en.join(" ; "));
  for (const c of ["rings", "trinkets"]) for (const [k, x] of Object.entries(jw[c])) console.log(c, k, "|", x.fr, "|", x.en);
}
