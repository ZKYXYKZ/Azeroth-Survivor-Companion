// Analyse en lecture seule : mesure la part "defensive" de chaque build suggere (reduction de
// degats subis, +PV max, auto-soin) et la croise avec le taux de victoire reel. Ne modifie rien.
// Usage: node tools/analyze-defense.js
const fs = require("fs");
const path = require("path");

const root = path.join(__dirname, "..");
const web = path.join(root, "AS-Companion", "web");
const DATA = JSON.parse(fs.readFileSync(path.join(web, "data.json"), "utf8"));
const DEFAULTS = JSON.parse(fs.readFileSync(path.join(web, "defaults.json"), "utf8"));
const STATS = JSON.parse(fs.readFileSync(path.join(__dirname, ".cache", "as-stats.json"), "utf8"));

function decodeTalents(code) {
  const f = code.split(";");
  const c = DATA.classes.find((x) => x.key === f[1]);
  if (!c) return null;
  const talents = {};
  f[3].split("/").forEach((s, ti) => { const tree = c.trees[ti]; if (tree) tree.talents.forEach((t, i) => { const v = +s[i]; if (v > 0) talents[t.key] = Math.min(v, t.max); }); });
  return { class: c, talents };
}

// Classe chaque talent choisi : reduction degats subis, +PV max, auto-soin, ou autre.
function defenseScore(c, talents) {
  let dmgReduction = 0, hpBonus = 0, selfHeal = 0, hasSafetyNet = false;
  const notes = [];
  for (const tree of c.trees)
    for (const t of tree.talents) {
      const r = talents[t.key] || 0;
      if (!r) continue;
      const desc = t.desc.en || "";
      const v = t.v !== undefined ? +(t.v * r).toFixed(2) : null;
      let m;
      if ((m = desc.match(/^Reduces all damage taken by \{v\}%/))) { dmgReduction += v; notes.push(`${t.key}=-${v}%dmg`); }
      else if ((m = desc.match(/^Increases your maximum health by \{v\}%/))) { hpBonus += v; notes.push(`${t.key}=+${v}%hp`); }
      else if ((m = desc.match(/\{v\}% of all the damage you deal heals you/))) { selfHeal += v; notes.push(`${t.key}=${v}%lifesteal`); }
      else if (/leaves you at 50%|instead of dying|immune|absorbs/i.test(desc.split("{v}").join(v || ""))) { hasSafetyNet = true; notes.push(`${t.key}=filet`); }
    }
  return { dmgReduction, hpBonus, selfHeal, hasSafetyNet, notes };
}

const real = {};
for (const g of STATS.groups) {
  const r = (real[g.spec] = real[g.spec] || { runs: 0, wins: 0 });
  r.runs += g.runs;
  r.wins += g.wins;
}

const bySpecIndex = {};
for (const b of DEFAULTS) (bySpecIndex[b.class] = bySpecIndex[b.class] || []).push(b);

const rows = [];
for (const [cls, builds] of Object.entries(bySpecIndex)) {
  builds.forEach((b, specIdx) => {
    const specKey = `${cls}-${specIdx}`;
    const dec = decodeTalents(b.code);
    const score = defenseScore(dec.class, dec.talents);
    const r = real[specKey] || { runs: 0, wins: 0 };
    rows.push({ cls, name: b.name, specKey, ...score, runs: r.runs, wins: r.wins, winRate: r.runs ? r.wins / r.runs : NaN });
  });
}

rows.sort((a, b) => (a.winRate ?? 2) - (b.winRate ?? 2));
const pct = (v) => (isNaN(v) ? "-" : (v * 100).toFixed(0) + "%");
console.log("Classe".padEnd(10), "Spec".padEnd(24), "Parties".padEnd(8), "Victoire".padEnd(9), "-Dmg%".padEnd(7), "+PV%".padEnd(6), "Lifesteal%".padEnd(11), "Filet".padEnd(6), "Detail talents defensifs");
for (const r of rows) {
  console.log(
    r.cls.padEnd(10), r.name.padEnd(24), String(r.runs).padEnd(8), pct(r.winRate).padEnd(9),
    String(r.dmgReduction).padEnd(7), String(r.hpBonus).padEnd(6), String(r.selfHeal).padEnd(11),
    (r.hasSafetyNet ? "oui" : "non").padEnd(6), r.notes.join(", ") || "(aucun)"
  );
}

module.exports = { rows };
