const fs = require("fs");
const path = require("path");
const load = require("./pe.js");
const [exe, legJson, locDir, outJson, jewelJson] = process.argv.slice(2);
const P = load(exe);
const { buf, str } = P;
const leg = JSON.parse(fs.readFileSync(legJson, "utf8"));
const L = { en: JSON.parse(fs.readFileSync(path.join(locDir, "loc-1.json"), "utf8")), fr: JSON.parse(fs.readFileSync(path.join(locDir, "loc-7.json"), "utf8")) };
const ABIL = 0x7105910; // 0x729e408 en 0.119
const abil = {};
const bySpellId = {};
for (let i = 0; i < 114; i++) {
  const o = ABIL + i * 120;
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
  switch (tag) {
    case 0x2c: { // 0x25 en 0.119
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
      return null;
    }
    case 0x2a: // Oeil de la tempete : valeur codee en dur par le jeu
      if (ownerKey === "stormstrike") return t(lang, "Every fourth Stormstrike strikes again for {p}% damage. At rank 5 and 10, the follow-up gains one additional target.", { p: "?" });
      return t(lang, "A hidden power");
    case 0x25:
      return t(lang, "{spell} slows by {pct} for {secs} sec", { spell: spellName(lang, keyAt(b, 0x10) || ownerKey), pct: pct(f(4)), secs: num(f(8)) });
    case 0x26:
      return t(lang, "{spell} deals {bonus} more damage to already chilled enemies", { spell: spellName(lang, keyAt(b, 8) || ownerKey), bonus: pct(f(4)) });
    case 0x27:
      return t(lang, "{spell} deals {bonus} more damage to enemies below {below} health", { spell: spellName(lang, keyAt(b, 0x10) || ownerKey), bonus: pct(f(4)), below: pct(f(8)) });
    case 0x28:
      return t(lang, "A kill with {spell} cuts its remaining cooldown by {frac}", { spell: spellName(lang, keyAt(b, 8) || ownerKey), frac: pct(f(4)) });
    case 0x29:
      return t(lang, "Each tick of {spell} also hits {n} nearby enemies within {radius} yd for {frac} damage", { spell: spellName(lang, keyAt(b, 0x10) || ownerKey), n: String(u(4)), radius: num(f(0xc)), frac: pct(f(8)) });
    case 3:
      if (u(0x10) !== 10) return t(lang, "A hidden power");
      return t(lang, "A broken shield bursts for {frac} of what it absorbed on enemies within {radius} yd", { frac: pct(f(4)), radius: num(f(8)) });
    case 4:
      return cap(t(lang, "{hits} splash {frac} on enemies within {radius} yd", { hits: hitsAt(0x20), frac: pct(f(4)), radius: num(f(8)) }));
    case 6: {
      const n = u(4);
      const k = n === 1 ? "{hits} leap to 1 more enemy for {frac}" : "{hits} leap to {n} more enemies for {frac}";
      return cap(t(lang, k, { hits: hitsAt(0x18), n: String(n), frac: pct(f(8)) }));
    }
    case 7:
      return cap(t(lang, "{chance} chance for {hits} to strike again for {frac}", { chance: pct(f(4)), hits: hitsAt(0x18), frac: pct(f(0xc)) }));
    case 8: {
      const kind = u(8) | 0;
      const hits = hitsAt(0x20);
      if (kind === 3) return cap(t(lang, "{hits} stun for {s} sec", { hits, s: num(f(0xc)) }));
      if (kind === 2) return cap(t(lang, "{hits} root for {s} sec", { hits, s: num(f(0xc)) }));
      if (kind === -1) return cap(t(lang, "{hits} leave enemies taking {v} more damage for {s} sec", { hits, v: pct(f(0xc)), s: num(f(0x10)) }));
      return cap(t(lang, "{hits} hinder enemies", { hits }));
    }
    case 9:
      return cap(t(lang, "{hits} burn and bleed for {frac} more over {dur} sec", { hits: hitsAt(0x18), frac: pct(f(8)), dur: num(f(0xc)) }));
    case 10: {
      const k = b[8] === 1 ? keyAt(b, 0x10) : ownerKey;
      return t(lang, "A kill with {who} readies it again at once", { who: spellName(lang, k || ownerKey) });
    }
    case 11: {
      const frac = pct(f(4));
      if (b[0x18] === 1) {
        const k = keyAt(b, 0x20) || ownerKey;
        const spell = spellName(lang, k);
        if (b[1] === 0) return t(lang, "Enemies {spell} kills explode for {frac} of their max health", { spell, frac });
        return t(lang, "Enemies that die with {spell} on them explode for {frac} of their max health", { spell, frac });
      }
      return t(lang, "Enemies you kill explode for {frac} of their max health", { frac });
    }
    case 12: {
      const k = bySpellId[u(4)] || ownerKey;
      return t(lang, "Enemies you kill during {spell} explode for {frac} of their max health", { spell: spellName(lang, k), frac: pct(f(8)) });
    }
    case 13: {
      const k = keyAt(b, 8) || ownerKey;
      return t(lang, "{spell} explodes a second time for {frac} of its damage", { spell: spellName(lang, k), frac: pct(f(4)) });
    }
    case 14: {
      const k = b[8] === 1 ? keyAt(b, 0x10) : ownerKey;
      return t(lang, "{who} leaps to {n} enemies when its victim dies", { who: spellName(lang, k || ownerKey), n: String(u(4)) });
    }
    case 15:
      if (u(0x10) !== 7 || b[1] !== 0x0e) return t(lang, "A hidden power");
      return t(lang, "While {spell} heals you, {p} of the damage you deal heals you too", { spell: spellName(lang, keyAt(b, 0x20) || ownerKey), p: pct(f(4)) });
    case 18:
      return t(lang, "{spell} also shields you for {frac} of your max health", { spell: spellName(lang, keyAt(b, 0x20) || ownerKey), frac: pct(f(4)) });
    case 19:
      return t(lang, "A killing blow leaves you at {heal} health instead, once every {cd} sec", { heal: pct(f(8)), cd: num(f(4)) });
    case 0x2b: { // 36 en 0.119
      const tpl = STATS[b[8]];
      if (!tpl) return t(lang, "A hidden power");
      const v = f(4);
      return t(lang, tpl, { p: pct(v), v: num(v) });
    }
    case 22:
      return t(lang, "Every totem pulse heals you {frac} of max health", { frac: pct(f(4)) });
    case 23:
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
for (const k of ["flamestrike", "hurricane", "cleave", "execute", "holy_shock", "pw_shield", "renew", "magma_totem", "chain_lightning", "rend", "divine_shield", "polymorph", "bloodthirst", "whirlwind"]) {
  const x = out[k];
  if (x) console.log(k, "|", x.family.fr, "\n   ", x.lines.fr.join("\n    "), "\n   ", x.lines.en.join(" || "));
}

if (jewelJson) {
  const rd = P.sec(".rdata");
  const find = (key, name) => { for (let p = rd.raw; p < rd.raw + rd.rs; p += 8) if (str(p, 40) === key && str(p + 16, 60) === name) return p; return -1; };
  const jw = { rings: {}, trinkets: {}, amulets: {} };
  const rb = find("accuria", "Band of Accuria");
  for (let i = 0; i < 23; i++) {
    const o = rb + i * 72;
    const v = buf.readFloatLE(o + 64);
    const tpl = str(o + 48, 200);
    const line = {};
    for (const lang of ["en", "fr"]) line[lang] = t(lang, tpl, { v: num(tpl.includes("{v}%") ? v * 100 : v), max: "" }).replace(/,? \+\{h\}[^,]*$/, "").replace(/ \{max\}% (at most|au maximum)\.?/, "");
    jw[i < 9 ? "rings" : "trinkets"][str(o, 40)] = line;
  }
  const ab = find("mark_of_fordring", "Mark of Fordring");
  for (let i = 0; i < 16; i++) {
    const o = ab + i * 80;
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
