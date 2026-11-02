const fs = require("fs");
const path = require("path");
const load = require("./pe.js");
const [exe, locDir, outJson] = process.argv.slice(2);
const P = load(exe);
const { buf, str, slice } = P;
const en = JSON.parse(fs.readFileSync(path.join(locDir, "loc-1.json"), "utf8"));
const fr = JSON.parse(fs.readFileSync(path.join(locDir, "loc-7.json"), "utf8"));
const tr = (k) => ({ en: en[k] || k, fr: fr[k] || en[k] || k });

const CLASSES = [
  ["warrior", ["Arms", "Fury", "Protection"], 11],
  ["paladin", ["Holy", "Protection", "Retribution"], 11],
  ["hunter", ["Beast Mastery", "Marksmanship", "Survival"], 11],
  ["rogue", ["Assassination", "Combat", "Subtlety"], 11],
  ["priest", ["Discipline", "Holy", "Shadow"], 11],
  ["shaman", ["Elemental", "Enhancement", "Restoration"], 12],
  ["mage", ["Arcane", "Fire", "Frost"], 13],
  ["warlock", ["Affliction", "Demonology", "Destruction"], 12],
  ["druid", ["Balance", "Feral Combat", "Restoration"], 12],
];

const findArrays = (stride, test, from, to) => {
  const hits = [];
  for (let o = from; o < to - stride; o += 8) if (test(o)) hits.push(o);
  const groups = [];
  for (const h of hits) {
    const g = groups[groups.length - 1];
    if (g && h === g.end) { g.items.push(h); g.end = h + stride; } else groups.push({ end: h + stride, items: [h] });
  }
  return groups;
};
const rd = P.sec(".rdata");

const isTalent = (o) => {
  const key = str(o, 40);
  if (!key || !/^[a-z0-9_]+$/.test(key)) return false;
  if (!str(o + 16, 60)) return false;
  const icon = str(o + 32, 60);
  if (!icon || !/^[A-Za-z0-9_]+$/.test(icon)) return false;
  const eff = slice(o + 48);
  if (eff.off < 0 || eff.len < 1 || eff.len > 8) return false;
  const desc = str(o + 64, 600);
  if (!desc || desc.length < 5) return false;
  return buf[o + 104] <= 8 && buf[o + 105] <= 4 && buf[o + 106] >= 1 && buf[o + 106] <= 5;
};
const TALENT_STRIDE = 176; // 160 en 0.119, passe a 176 en 0.135.1 (struct talent elargie)
const talentArrays = findArrays(TALENT_STRIDE, isTalent, rd.raw, rd.raw + rd.rs).filter((g) => g.items.length >= 12);
if (talentArrays.length !== 27) throw new Error("expected 27 talent trees, got " + talentArrays.length);

const floatsOf = (off) => {
  const out = [];
  for (let q = 4; q < 44; q += 4) {
    const u = buf.readUInt32LE(off + q);
    if (u > 0x30000000 && u < 0x48000000) out.push({ at: q, v: buf.readFloatLE(off + q) });
  }
  return out;
};
const perRank = (effOff, tag, desc) => {
  if (!/\{v\}/.test(desc)) return null;
  if (tag === 0x2f) return { v: buf.readFloatLE(effOff + 4), pct: /\{v\}%/.test(desc) };
  if (tag === 0x30) return { v: buf.readFloatLE(effOff + 32), pct: /\{v\}%/.test(desc) };
  if (tag === 0x2a) return null; // effet code en dur dans le jeu, valeur absente des donnees
  if (tag === 1 || /\{v\}(th|st|nd|rd)\b/.test(desc)) return { v: buf.readUInt32LE(effOff + 4), pct: false, flat: true };
  const fl = floatsOf(effOff);
  if (/\{v\}%/.test(desc)) {
    const f = fl.find((x) => x.v > 0 && x.v <= 5);
    return f ? { v: f.v, pct: true } : null;
  }
  if (/\{v\} sec/.test(desc)) {
    const f = fl.find((x) => x.v >= 1 && x.v <= 120);
    return f ? { v: f.v, pct: false } : null;
  }
  const f = fl[0];
  return f ? { v: f.v, pct: false } : null;
};

// Effets codes en dur dans le jeu (etiquette 0x2a) : valeurs par rang des notes de la 0.137
const HARD_V = { enh_earthen_bulwark: 3, enh_resonant_shocks: 1, enh_flametongue_weapon: 5, enh_frostbrand_weapon: 10, enh_flurry: 6 };
const classes = [];
let t = 0;
for (const [cls, trees, nSpells] of CLASSES) {
  const c = { key: cls, name: tr("class." + cls + ".name"), trees: [], spells: [] };
  for (const treeName of trees) {
    const g = talentArrays[t++];
    const tree = { name: tr(treeName), talents: [] };
    for (const o of g.items) {
      const key = str(o, 40);
      const name = str(o + 16, 60);
      const desc = str(o + 64, 600);
      const eff = slice(o + 48);
      const tag = buf.readUInt32LE(eff.off);
      const pre = str(o + 112, 60);
      const val = perRank(eff.off, tag, desc);
      const tal = {
        key, icon: str(o + 32, 60), row: buf[o + 104], col: buf[o + 105], max: buf[o + 106],
        name: tr(name), desc: tr(desc),
      };
      if (pre && /^[a-z0-9_]+$/.test(pre)) tal.req = pre;
      if (/^Milestone\./.test(desc)) tal.milestone = true;
      if (/^Capstone\./.test(desc)) tal.capstone = true;
      if (HARD_V[key] !== undefined) tal.v = HARD_V[key];
      for (const l of ["en", "fr"]) tal.desc[l] = tal.desc[l].split("{v2}").join("10/20/30");
      if (val) {
        let v = val.pct ? val.v * 100 : val.v;
        v = Math.round(v * 1000) / 1000;
        tal.v = v;
      }
      tree.talents.push(tal);
    }
    c.trees.push(tree);
  }
  classes.push(c);
}

const isAbility = (o) => {
  const k = str(o, 40);
  if (!k || !/^[a-z0-9_]+$/.test(k)) return false;
  const n = str(o + 16, 60);
  if (!n || /[{}]/.test(n)) return false;
  const ic = str(o + 32, 60);
  if (!ic || !/^[A-Za-z0-9_]+$/.test(ic) || !/_/.test(ic)) return false;
  const s = slice(o + 48);
  return s.off > 0 && s.len >= 1 && s.len <= 8 && buf.slice(s.off, s.off + s.len).every((b) => b < 16);
};
const abil = findArrays(120, isAbility, rd.raw, rd.raw + rd.rs).find((g) => g.items.length > 100);
const UPG = ["damage", "cooldown", "targets", "area", "duration", "5", "6", "7"];
const abilities = abil.items.map((o) => {
  const s = slice(o + 48);
  const key = str(o, 40);
  return {
    key, name: tr("ability." + key + ".name"), icon: str(o + 32, 60),
    spell: buf.readUInt32LE(o + 64), upgrades: [...buf.slice(s.off, s.off + s.len)].map((b) => UPG[b]),
  };
});
let a = 0;
for (const [i, [, , n]] of CLASSES.entries()) { classes[i].spells = abilities.slice(a, a + n); a += n; }
const racials = abilities.slice(a, a + 8);
const extra = abilities.slice(a + 8);

const isJewel = (stride) => (o) => {
  const k = str(o, 40);
  if (!k || !/^[a-z0-9_]+$/.test(k)) return false;
  const n = str(o + 16, 80);
  if (!n || !/^[A-Z]/.test(n)) return false;
  const ic = str(o + 32, 80);
  return !!ic && /^(INV|Spell|Ability|Racial)_/i.test(ic);
};
const ringsTrinkets = findArrays(72, isJewel(72), rd.raw, rd.raw + rd.rs).find((g) => g.items.length >= 20);
const amuletsArr = findArrays(80, isJewel(80), rd.raw, rd.raw + rd.rs).find((g) => g.items.length >= 14);
const jewel = (o, prefix) => {
  const key = str(o, 40);
  return { key, name: tr(prefix + key), icon: str(o + 32, 80), desc: str(o + 48, 400) };
};
const rt = ringsTrinkets.items.map((o) => jewel(o, "jewel."));
const data = {
  version: "0.139.0",
  rarity: [0, 1, 2, 3, 4].map((i) => tr("rarity." + i)),
  classes,
  racials,
  extraSpells: extra,
  rings: rt.slice(0, 9),
  trinkets: rt.slice(9),
  amulets: amuletsArr.items.map((o) => jewel(o, "amulet.")),
};
fs.writeFileSync(outJson, JSON.stringify(data, null, 1));
console.log("classes", classes.length, "talents", classes.reduce((s, c) => s + c.trees.reduce((x, tt) => x + tt.talents.length, 0), 0),
  "spells", classes.reduce((s, c) => s + c.spells.length, 0), "rings", data.rings.length, "trinkets", data.trinkets.length, "amulets", data.amulets.length);
for (const c of classes) console.log(c.key, c.trees.map((tt) => tt.name.fr + "(" + tt.talents.length + ")").join(" "), "|", c.spells.map((s) => s.key).join(","));
