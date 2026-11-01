const fs = require("fs");
const path = require("path");

const root = path.join(__dirname, "..");
const data = JSON.parse(fs.readFileSync(path.join(root, "AS-Companion/web/data.json"), "utf8"));
const out = path.join(root, "AS-Companion/web/simdata.json");
const dirs = process.argv.slice(2).filter((d) => fs.existsSync(d) && fs.statSync(d).isDirectory());
const botFiles = process.argv.slice(2).filter((f) => /AZBot\.lua$/.test(f) && fs.existsSync(f));
// Dossier des cards-*.ndjson remontees par le serveur communautaire (POST /api/cards, voir
// community/server.js et Companion.cs/QueueShare) : un lot de cartes {name,kind,line,rarity,title}
// par envoi, une ligne par run cote joueur. Complete les captures "choices" locales de dist/research,
// qui ne couvrent qu'une classe a la fois.
const cardDirs = process.argv.slice(2).filter((d) => fs.existsSync(d) && fs.statSync(d).isDirectory() && fs.readdirSync(d).some((f) => /^cards-\d{4}-\d{2}\.ndjson$/.test(f)));

const keyOf = {};
for (const c of data.classes) for (const s of c.spells) keyOf[s.name.en] = keyOf[s.name.fr] = s.key;
for (const s of data.racials.concat(data.extraSpells)) keyOf[s.name.en] = keyOf[s.name.fr] = s.key;

const texts = {};
const upgrades = {};
const num = (s) => parseFloat(String(s).replace(",", "."));

function* localCards() {
  for (const dir of dirs)
    for (const f of fs.readdirSync(dir)) {
      if (!f.endsWith(".jsonl")) continue;
      for (const line of fs.readFileSync(path.join(dir, f), "utf8").split("\n")) {
        if (!line.includes('"choices"')) continue;
        let e;
        try { e = JSON.parse(line); } catch (x) { continue; }
        for (const c of e.data.choices || []) yield { name: c.name, kind: c.kind, lines: (c.lines || "").split("\n"), rarity: c.rarity, title: c.title };
      }
    }
}

function* communityCards() {
  for (const dir of cardDirs)
    for (const f of fs.readdirSync(dir)) {
      if (!/^cards-\d{4}-\d{2}\.ndjson$/.test(f)) continue;
      for (const line of fs.readFileSync(path.join(dir, f), "utf8").split("\n")) {
        if (!line) continue;
        let e;
        try { e = JSON.parse(line); } catch (x) { continue; }
        for (const c of e.cards || []) yield { name: c.name, kind: c.kind, lines: [c.line || ""], rarity: c.rarity, title: c.title };
      }
    }
}

for (const c of [...localCards(), ...communityCards()]) {
  const k = keyOf[c.name];
  if (!k) continue;
  const lines = c.lines;
  if (c.kind === "new" && /\b(yd|Strikes|Hits|Fires|Afflicts|Lands|Marks|Drops|Heals|Absorbs|Increases|Your|Every|For|Makes|Enemies)\b/.test(lines[0])) (texts[k] = texts[k] || []).push(lines[0]);
  if (c.kind !== "upgrade") continue;
  for (const ln of lines) {
    const m = ln.match(/^([-+][\d.,]+)\s*(%?)\s*(damage|cooldown|area|duration|targets|absorb|healing|proc rate)$/);
    if (!m) continue;
    const type = m[3];
    const rk = +(((c.title || "").match(/(?:rank|rang) (\d+)/) || [])[1] || 0);
    if (!rk) continue;
    const byR = ((upgrades[type] = upgrades[type] || {})[c.rarity] = upgrades[type][c.rarity] || {});
    (byR[rk] = byR[rk] || []).push(num(m[1]));
  }
}

function parse(t) {
  const r = { text: t };
  let m;
  const dmg = (s) => num(s);
  if ((m = t.match(/Fires (\d+) missiles at random enemies within ([\d.]+) yd for ([\d.]+) \w+ damage each/))) Object.assign(r, { kind: "missiles", hits: +m[1], range: num(m[2]), dmg: dmg(m[3]) });
  else if ((m = t.match(/Strikes the nearest enemy within ([\d.]+) yd for ([\d.]+) \w+ damage, then jumps to up to (\d+) more enemies within [\d.]+ yd of the last, (\d+)% weaker/))) Object.assign(r, { kind: "chain", range: num(m[1]), dmg: dmg(m[2]), jumps: +m[3], decay: +m[4] / 100 });
  else if ((m = t.match(/Strikes (?:the nearest enemy|an enemy|a random enemy) within ([\d.]+) yd for ([\d.]+) \w+ damage/))) Object.assign(r, { kind: "single", targets: 1, range: num(m[1]), dmg: dmg(m[2]) });
  else if ((m = t.match(/Strikes (?:the (\d+) nearest enemies|up to (\d+) enemies) within ([\d.]+) yd for ([\d.]+) \w+ damage/))) Object.assign(r, { kind: "multi", targets: +(m[1] || m[2]), range: num(m[3]), dmg: dmg(m[4]) });
  else if ((m = t.match(/Hits every enemy within ([\d.]+) yd of you for ([\d.]+) \w+ damage/))) Object.assign(r, { kind: "nova", radius: num(m[1]), dmg: dmg(m[2]) });
  else if ((m = t.match(/Hits every enemy in a ([\d.]+) yd cone in front of you for ([\d.]+) \w+ damage/))) Object.assign(r, { kind: "cone", radius: num(m[1]), dmg: dmg(m[2]) });
  else if ((m = t.match(/(?:Lands on|Marks the ground)[^:]*: every enemy within ([\d.]+) yd of that spot takes ([\d.]+) \w+ damage every ([\d.]+) sec for ([\d.]+) sec, ([\d.]+) in all/))) Object.assign(r, { kind: "ground", radius: num(m[1]), tick: dmg(m[2]), every: num(m[3]), dur: num(m[4]), dmg: dmg(m[5]) });
  else if ((m = t.match(/Afflicts the (\d+) [^:]*: ([\d.]+) \w+ damage over ([\d.]+) sec/))) Object.assign(r, { kind: "dot", targets: +m[1], dmg: dmg(m[2]), dur: num(m[3]) });
  else if ((m = t.match(/Drops a totem beside you for ([\d.]+) sec[^.]*\. Every ([\d.]+) sec it deals ([\d.]+) \w+ damage to every enemy within ([\d.]+) yd/))) Object.assign(r, { kind: "totem", dur: num(m[1]), every: num(m[2]), tick: dmg(m[3]), radius: num(m[4]), aoe: true });
  else if ((m = t.match(/Drops a totem beside you for ([\d.]+) sec[^.]*\. Every ([\d.]+) sec it shoots the nearest enemy within ([\d.]+) yd for ([\d.]+) \w+ damage/))) Object.assign(r, { kind: "totem", dur: num(m[1]), every: num(m[2]), range: num(m[3]), tick: dmg(m[4]), aoe: false });
  else if ((m = t.match(/Increases all your damage by ([\d.]+)% for ([\d.]+) sec/))) Object.assign(r, { kind: "buff", stat: "dmg", value: num(m[1]) / 100, dur: num(m[2]) });
  else if ((m = t.match(/Your cooldowns recover ([\d.]+)% faster for ([\d.]+) sec/))) Object.assign(r, { kind: "buff", stat: "cdr", value: num(m[1]) / 100, dur: num(m[2]) });
  else if ((m = t.match(/Your demons deal ([\d.]+)% more damage for ([\d.]+) sec/))) Object.assign(r, { kind: "buff", stat: "pet", value: num(m[1]) / 100, dur: num(m[2]) });
  else if ((m = t.match(/it takes ([\d.]+)% more damage from everything\. When it dies the mark explodes, dealing ([\d.]+) \w+ damage to every enemy within ([\d.]+) yd/))) Object.assign(r, { kind: "mark", value: num(m[1]) / 100, dmg: dmg(m[2]), radius: num(m[3]) });
  else if (/^(Heals|Absorbs|Makes you immune)/.test(t)) r.kind = "defense";
  else r.kind = "special";
  if ((m = t.match(/doubled to ([\d.]+) against an enemy below 30% health/))) r.execute = true;
  return r;
}

const spells = {};
for (const [k, list] of Object.entries(texts)) {
  const parsed = list.map(parse);
  const kinds = parsed.filter((p) => p.kind !== "special");
  const pick = (kinds.length ? kinds : parsed).sort((a, b) => (a.dmg || 0) - (b.dmg || 0))[Math.floor((kinds.length ? kinds : parsed).length / 2)];
  spells[k] = Object.assign({}, pick, { samples: list.length });
}

const cds = {};
const levels = {};
for (const f of botFiles) {
  const src = fs.readFileSync(f, "utf8");
  for (const m of src.matchAll(/"(\d+)\|([^|]*)\|([^|]*)\|([^|]*)\|([^|]*)\|([^|]*)\|([^"]*)"/g)) {
    const lvl = +m[2];
    const stats = Object.fromEntries(m[5].split(",").filter(Boolean).map((p) => { const [a, b] = p.split("="); return [a, +b]; }));
    for (const s of m[4].split(",").filter(Boolean)) {
      const [key, rank, cdmax] = s.split(":");
      if (+rank === 1 && +cdmax > 0 && stats.cd) (cds[key] = cds[key] || []).push(+cdmax / stats.cd);
    }
    if (lvl > 0 && stats.hp) (levels[lvl] = levels[lvl] || []).push(stats);
  }
}
const median = (a) => { const s = a.slice().sort((x, y) => x - y); return s.length ? s[Math.floor(s.length / 2)] : null; };
for (const [k, v] of Object.entries(cds)) if (spells[k]) spells[k].cd = Math.round(median(v) * 100) / 100;

const rarityUp = {};
for (const [type, byR] of Object.entries(upgrades)) rarityUp[type] = [0, 1, 2, 3, 4].map((r) => (byR[r] ? Object.fromEntries(Object.entries(byR[r]).map(([rk, v]) => [rk, median(v)])) : null));

const levelStats = {};
for (const [lvl, list] of Object.entries(levels)) {
  const keys = Object.keys(list[0]);
  levelStats[lvl] = Object.fromEntries(keys.map((k) => [k, median(list.map((s) => s[k]))]));
}

fs.writeFileSync(out, JSON.stringify({ spells, upgrades: rarityUp, levels: levelStats }, null, 1) + "\n");
const kinds = {};
for (const s of Object.values(spells)) kinds[s.kind] = (kinds[s.kind] || 0) + 1;
console.log(`${Object.keys(spells).length} sorts (${Object.entries(kinds).map(([k, n]) => k + " " + n).join(", ")}), ${Object.keys(cds).length} recharges, ${Object.keys(levelStats).length} niveaux`);
console.log("améliorations :", JSON.stringify(rarityUp));
