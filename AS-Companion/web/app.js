const ICON = (n) => "https://wow.zamimg.com/images/wow/icons/large/" + String(n).toLowerCase() + ".jpg";
const MAX_POINTS = 51;
const SLOTS = 6;
const CLASS_COLORS = { warrior: "#c79c6e", paladin: "#f58cba", hunter: "#abd473", rogue: "#fff569", priest: "#ffffff", shaman: "#2459ff", mage: "#69ccf0", warlock: "#9482c9", druid: "#ff7d0a" };
const RARITY_COLORS = ["#d9d9d9", "#1eff00", "#0070dd", "#a335ee", "#ff8000"];

const STR = {
  fr: {
    new: "Nouveau", dup: "Dupliquer", ren: "Renommer", del: "Supprimer", delConfirm: "Supprimer ce build ?", imp: "Importer", exp: "Exporter",
    launch: "Lancer le jeu", running: "Jeu en cours", builds: "Builds", stats: "Statistiques", sim: "Simulateur", addons: "Addons", build: "Build", talents: "Talents", spells: "Sorts", jewels: "Bijoux", rules: "Règles", options: "Options",
    none: "Aucun build pour cette classe. Cliquez sur Nouveau.", spec: "Spé", baseVal: "Valeurs de base, plus fortes aux raretés supérieures", pts: "points", rank: "Rang", next: "Rang suivant", locked: "Rangée verrouillée : {n} points requis dans cet arbre",
    clickTalent: "Clic gauche : +1 · Clic droit : -1", reset: "Réinitialiser les talents",
    pool: "Sorts de la classe", poolHint: "Clic : ajouter · Clic droit : bannir", prio: "Ordre de priorité", prioHint: "Un run garde 6 sorts : les 6 premiers sont visés, les suivants servent de repli. Le poids (1 à 5) entre dans le score avec la rareté.",
    weight: "Poids", banned: "Banni", fallbackSep: "Repli (au-delà de 6 sorts)", emptyPrio: "Cliquez un sort à gauche pour l'ajouter.",
    rings: "Anneaux", trinkets: "Bijoux", amulets: "Amulette", legendary: "Légendaires de la classe (une par sort)", target: "visé", fallback: "repli",
    jewelHint: "Clic : ajouter / retirer · Clic droit : bannir. Les premiers sont visés, les suivants servent de repli. Anneaux et bijoux ne se changent plus une fois pris ; l'amulette se remplace.",
    rarity: "Influence de la rareté", rarityHelp: "0 % : seule la priorité compte. 100 % : une légendaire vaut 5 fois une commune.",
    reserve: "Relances gardées en réserve", banishes: "Bannissements disponibles par run", reroll: "Rien du build : relancer avant de skip",
    fallbackLevel: "Anneaux et bijoux de repli à partir du niveau", fallbackHelp: "Avant ce niveau, seuls les anneaux et bijoux visés sont pris : ils ne se remplacent plus ensuite.",
    boost: "Bonus de synergie", boostHelp: "Multiplie le poids d'un sort dont vous portez l'amulette légendaire ou que vous avez déjà monté.",
    adapt: "Adapter le build à la run", adaptHelp: "Tient compte des sorts déjà pris (6 emplacements) et de l'amulette portée.",
    gamePath: "Chemin du jeu", browse: "Parcourir", lang: "Langue", auto: "Auto", autoPick: "Sélection auto des cartes", autoPickHelp: "Le compagnon choisit et relance à votre place (touches 1, 2, 3, R). Skip et bannir restent manuels.",
    overlay: "Bandeau de conseil par-dessus le jeu", importTitle: "Collez un build (texte d'export) puis validez", exportTitle: "Copiez ce texte pour partager le build", ok: "Importer", close: "Fermer", bad: "Texte de build invalide",
    raceRec: "Race conseillée :", raceAlt: "toutes races débloquées (succès) :",
    applyTal: "Appliquer au jeu", applyTalHelp: "Dans le jeu, ouvrez l’Armurerie, onglet Talents, sur la classe et la spé à remplacer. Ne bougez plus la souris après le clic (une dizaine de secondes).", applyTalRun: "Pose des talents en cours : ne bougez pas la souris…", applyTal_ok: "Talents posés. Vérifiez l’arbre puis cliquez sur Terminé.", applyTal_nogame: "Le jeu n'est pas lancé.", applyTal_empty: "Ce build n'a aucun talent.", applyTal_wrongclass: "L’Armurerie ouverte n’est pas celle de la classe de ce build : sélectionnez la bonne classe dans le jeu.", applyTal_focus: "Arrêté : le jeu n'était plus au premier plan.",
    needAddon: "L'addon SurvivorsBuilds n'est pas installé : il affiche le build en jeu et enregistre le détail de vos parties pour le simulateur et les statistiques.", needAddonOn: "L'addon SurvivorsBuilds est désactivé : il affiche le build en jeu et enregistre le détail de vos parties pour le simulateur et les statistiques.", needAddonInstall: "Installer", needAddonEnable: "Activer",
    shareNotice: "Vos parties, anonymes, améliorent le compagnon. Désactivable dans les options.", shareNoticeOk: "Compris",
    share: "Partager mes parties", shareHelp: "Vos parties améliorent ce compagnon : les builds proposés, le simulateur et les statistiques par classe et par race. À la fin de chaque partie, un résumé anonyme part vers le site communautaire : classe, race, spé, zone, résultat, durée, niveau, DPS et dégâts subis minute par minute, sorts, bijoux, cartes prises et build. Ni pseudo, ni chemin, ni adresse : seulement un identifiant aléatoire propre à cette installation.",
    presetStale: "Mis à jour", presetReimport: "Réimporter", presetBanner: "Des builds proposés ont changé depuis ton import : réimporte ceux marqués « Mis à jour ».", presets: "Builds proposés", presetsTitle: "Builds proposés : {c}", presetAdd: "Ajouter", presetHave: "Déjà ajouté", by: "par {v}",
    report: "Créer un rapport", reportLabel: "Rapport de bug", reportHelp: "Rassemble dans un zip le journal du compagnon, tes dernières parties et tes réglages, puis ouvre le dossier. Envoie ce fichier avec la description du problème.", reportDone: "Rapport créé : {v}",
    noGame: "Jeu introuvable : indiquez où se trouve AzerothSurvivors.exe.", addonsUpdated: "Addons mis à jour : {v}. Ils prennent effet au prochain lancement du jeu.", autoAddons: "Mise à jour auto des addons", autoAddonsHelp: "Au démarrage puis toutes les 30 minutes, hors partie, les addons installés sont mis à jour depuis la dernière version publiée sur GitHub.", stage_download: "Téléchargement de la version {v}…", stage_verify: "Vérification du fichier…", stage_install: "Installation des addons et du compagnon…", stage_restart: "Redémarrage du compagnon…", updated: "Mis à jour en version {v}", updateAvail: "Mise à jour {v} disponible", updateBtn: "Mettre à jour", updating: "Mise à jour en cours…", version: "Version", checkUpdate: "Rechercher une mise à jour", upToDate: "À jour", down: "Le compagnon ne répond plus : relancez ASCompanion.exe. Si ça recommence, envoyez %APPDATA%\\AS-Companion\\companion.log.", renamePrompt: "Nouveau nom du build", saved: "Enregistré", gameOff: "Jeu fermé", advice: "Conseil",
  },
  en: {
    new: "New", dup: "Duplicate", ren: "Rename", del: "Delete", delConfirm: "Delete this build?", imp: "Import", exp: "Export",
    launch: "Launch game", running: "Game running", builds: "Builds", stats: "Statistics", sim: "Simulator", addons: "Addons", build: "Build", talents: "Talents", spells: "Spells", jewels: "Jewelry", rules: "Rules", options: "Options",
    none: "No build for this class. Click New.", spec: "Spec", baseVal: "Base values, stronger at higher rarities", pts: "points", rank: "Rank", next: "Next rank", locked: "Row locked: {n} points required in this tree",
    clickTalent: "Left click: +1 · Right click: -1", reset: "Reset talents",
    pool: "Class spells", poolHint: "Click: add · Right click: ban", prio: "Priority order", prioHint: "A run holds 6 spells: the first 6 are targets, the rest are fallbacks. Weight (1 to 5) counts in the score with rarity.",
    weight: "Weight", banned: "Banned", fallbackSep: "Fallback (beyond 6 spells)", emptyPrio: "Click a spell on the left to add it.",
    rings: "Rings", trinkets: "Trinkets", amulets: "Amulet", legendary: "Class legendaries (one per spell)", target: "target", fallback: "fallback",
    jewelHint: "Click: add / remove · Right click: ban. The first ones are targets, the rest are fallbacks. Rings and trinkets can't be swapped once taken; the amulet can.",
    rarity: "Rarity influence", rarityHelp: "0%: only priority counts. 100%: a legendary is worth 5 commons.",
    reserve: "Rerolls kept in reserve", banishes: "Banishes available per run", reroll: "Nothing from the build: reroll before skipping",
    fallbackLevel: "Fallback rings and trinkets from level", fallbackHelp: "Before this level, only target rings and trinkets are taken: they can't be swapped later.",
    boost: "Synergy bonus", boostHelp: "Multiplies the weight of a spell whose legendary amulet you wear or that you already ranked up.",
    adapt: "Adapt the build to the run", adaptHelp: "Accounts for spells already taken (6 slots) and the worn amulet.",
    gamePath: "Game path", browse: "Browse", lang: "Language", auto: "Auto", autoPick: "Auto-pick cards", autoPickHelp: "The companion picks and rerolls for you (keys 1, 2, 3, R). Skip and banish stay manual.",
    overlay: "Advice banner over the game", importTitle: "Paste a build (export text) then confirm", exportTitle: "Copy this text to share the build", ok: "Import", close: "Close", bad: "Invalid build text",
    raceRec: "Recommended race:", raceAlt: "with every race unlocked (achievement):",
    applyTal: "Apply in game", applyTalHelp: "In the game, open the Armory, Talents tab, on the class and spec to replace. Don’t move the mouse after clicking (about ten seconds).", applyTalRun: "Setting talents: don’t move the mouse…", applyTal_ok: "Talents set. Check the tree, then click Done.", applyTal_nogame: "The game isn't running.", applyTal_empty: "This build has no talents.", applyTal_wrongclass: "The open Armory isn’t this build’s class: select the right class in the game.", applyTal_focus: "Stopped: the game was no longer in the foreground.",
    needAddon: "The SurvivorsBuilds addon isn't installed: it shows the build in game and records the details of your runs for the simulator and the stats.", needAddonOn: "The SurvivorsBuilds addon is disabled: it shows the build in game and records the details of your runs for the simulator and the stats.", needAddonInstall: "Install", needAddonEnable: "Enable",
    shareNotice: "Your runs, anonymous, improve the companion. You can turn this off in the options.", shareNoticeOk: "Got it",
    share: "Share my runs", shareHelp: "Your runs improve this companion: the suggested builds, the simulator and the stats per class and race. At the end of each run, an anonymous summary goes to the community site: class, race, spec, zone, result, duration, level, DPS and damage taken minute by minute, spells, jewelry, picked cards and build. No player name, path or address: only a random ID tied to this install.",
    presetStale: "Updated", presetReimport: "Re-import", presetBanner: "Some suggested builds changed since you imported them: re-import the ones marked “Updated”.", presets: "Suggested builds", presetsTitle: "Suggested builds: {c}", presetAdd: "Add", presetHave: "Already added", by: "by {v}",
    report: "Create a report", reportLabel: "Bug report", reportHelp: "Zips the companion log, your latest runs and your settings, then opens the folder. Send this file with a description of the problem.", reportDone: "Report created: {v}",
    noGame: "Game not found: show where AzerothSurvivors.exe is.", addonsUpdated: "Addons updated: {v}. They apply at the next game launch.", autoAddons: "Auto-update addons", autoAddonsHelp: "At startup and every 30 minutes, outside a run, the installed addons are updated from the latest version published on GitHub.", stage_download: "Downloading version {v}…", stage_verify: "Checking the file…", stage_install: "Installing the addons and the companion…", stage_restart: "Restarting the companion…", updated: "Updated to version {v}", updateAvail: "Update {v} available", updateBtn: "Update", updating: "Updating…", version: "Version", checkUpdate: "Check for updates", upToDate: "Up to date", down: "The companion is not responding: restart ASCompanion.exe. If it happens again, send %APPDATA%\\AS-Companion\\companion.log.", renamePrompt: "New build name", saved: "Saved", gameOff: "Game closed", advice: "Advice",
  },
};

let VERSION = null;
let PRESETS = [];
const RACES = {
  human: { name: { fr: "Humain", en: "Human" }, lines: { fr: ["Perception : toutes les 30 s, +15 % de dégâts pendant 10 s", "+10 % d'expérience", "+20 % d'or"], en: ["Perception: every 30 sec, +15% damage for 10 sec", "+10% experience", "+20% gold"] } },
  orc: { name: { fr: "Orc", en: "Orc" }, lines: { fr: ["Fureur sanguinaire : toutes les 40 s, +35 % de dégâts pendant 12 s", "+10 % de points de vie max."], en: ["Blood Fury: every 40 sec, +35% damage for 12 sec", "+10% max health"] } },
  dwarf: { name: { fr: "Nain", en: "Dwarf" }, lines: { fr: ["Forme de pierre : toutes les 45 s, un bouclier de 30 % des points de vie max.", "+6 % de dégâts", "+30 % de portée de ramassage"], en: ["Stoneform: every 45 sec, a shield of 30% max health", "+6% damage", "+30% pickup range"] } },
  nightelf: { name: { fr: "Elfe de la nuit", en: "Night Elf" }, lines: { fr: ["Proche de la mort, 3 s d'immunité (recharge 75 s)", "+8 % de vitesse", "+5 % de réduction des dégâts"], en: ["Near death, 3 sec of immunity (75 sec cooldown)", "+8% movement speed", "+5% damage reduction"] } },
  scourge: { name: { fr: "Mort-vivant", en: "Undead" }, lines: { fr: ["Proche de la mort, 4 s d'immunité (recharge 60 s)", "Chaque victime rend 1 point de vie", "+4 % de réduction des dégâts"], en: ["Near death, 4 sec of immunity (60 sec cooldown)", "Every kill heals 1 health", "+4% damage reduction"] } },
  tauren: { name: { fr: "Tauren", en: "Tauren" }, lines: { fr: ["Choc martial : toutes les 15 s, étourdit les ennemis proches 2 s", "+15 % de points de vie max."], en: ["War Stomp: every 15 sec, stuns nearby enemies for 2 sec", "+15% max health"] } },
  gnome: { name: { fr: "Gnome", en: "Gnome" }, lines: { fr: ["Toutes les 20 s, immobilise les ennemis proches 2 s", "-8 % de temps de recharge", "+20 % de chance"], en: ["Every 20 sec, roots nearby enemies for 2 sec", "-8% cooldowns", "+20% luck"] } },
  troll: { name: { fr: "Troll", en: "Troll" }, lines: { fr: ["Berserker : toutes les 35 s, recharges 30 % plus rapides pendant 10 s", "+1,5 point de vie par seconde", "+3 % de critique"], en: ["Berserking: every 35 sec, cooldowns recover 30% faster for 10 sec", "+1.5 health per second", "+3% critical strike"] } },
};
function raceLine(race, alt) {
  const r = RACES[race];
  if (!r) return null;
  const line = el("div", "raceline");
  const name = el("b", "", esc(L(r.name)));
  tipOn(name, () => `<div class="t">${esc(L(r.name))}</div>` + L(r.lines).map((x) => `<div>${esc(x)}</div>`).join(""));
  line.appendChild(el("span", "hint", esc(T("raceRec")) + " "));
  line.appendChild(name);
  if (alt && RACES[alt]) {
    line.appendChild(el("span", "hint", " · " + esc(T("raceAlt")) + " "));
    const a = el("b", "", esc(L(RACES[alt].name)));
    tipOn(a, () => `<div class="t">${esc(L(RACES[alt].name))}</div>` + L(RACES[alt].lines).map((x) => `<div>${esc(x)}</div>`).join(""));
    line.appendChild(a);
  }
  return line;
}
let DATA, STATE, CLASS = null, TAB = "build", PAGE = "builds";
const $ = (id) => document.getElementById(id);
const lang = () => {
  const l = STATE.settings.lang || "auto";
  if (l !== "auto") return l;
  return (STATE.settings.gameLang || navigator.language || "en").slice(0, 2) === "fr" ? "fr" : "en";
};
const T = (k, vars) => {
  let s = (STR[lang()] || STR.en)[k] || STR.en[k] || k;
  for (const [a, b] of Object.entries(vars || {})) s = s.split("{" + a + "}").join(b);
  return s;
};
const L = (o) => (o && typeof o === "object" ? o[lang()] || o.en : o);
const el = (tag, cls, html) => { const e = document.createElement(tag); if (cls) e.className = cls; if (html !== undefined) e.innerHTML = html; return e; };
const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));

const cls = (key) => DATA.classes.find((c) => c.key === key);
const spellOf = (c, key) => c.spells.find((s) => s.key === key);
const builds = (key) => STATE.builds.filter((b) => b.class === key);
const active = () => {
  const list = builds(CLASS);
  return list.find((b) => b.id === STATE.active[CLASS]) || list[0] || null;
};
function legendary(c, spellKey) {
  const l = DATA.legendaries[spellKey];
  const s = spellOf(c, spellKey);
  if (!l || !s) return null;
  return { key: "leg:" + spellKey, icon: l.icon, sub: s.icon, legendary: true, lines: l.lines, name: { en: l.family.en + " : " + s.name.en, fr: l.family.fr + " : " + s.name.fr } };
}
function jewel(cat, key, c) {
  if (cat === "amulets" && key.startsWith("leg:")) return legendary(c, key.slice(4));
  return DATA[cat].find((j) => j.key === key);
}

let saveTimer;
function save() {
  clearTimeout(saveTimer);
  saveTimer = setTimeout(() => fetch("/api/state", { method: "POST", body: JSON.stringify(STATE) }), 300);
}
function changed() { save(); render(); }

function newBuild(classKey, name) {
  const b = { id: STATE.nextId++, class: classKey, name: name || "Build " + (STATE.nextId - 1), talents: {}, spells: [], ban: {}, rings: [], trinkets: [], amulets: [],
    rules: { rarity: 50, reserve: 1, reroll: 1, banishes: 3, fallbackLevel: 10, boost: 2, adapt: 1 } };
  STATE.builds.push(b);
  STATE.active[classKey] = b.id;
  return b;
}

function treePoints(b, tree) { return tree.talents.reduce((n, t) => n + (b.talents[t.key] || 0), 0); }
function totalPoints(b) { return cls(b.class).trees.reduce((n, t) => n + treePoints(b, t), 0); }
function treeValid(b, tree) {
  for (const t of tree.talents) {
    if ((b.talents[t.key] || 0) > 0) {
      const below = tree.talents.filter((o) => o.row < t.row).reduce((n, o) => n + (b.talents[o.key] || 0), 0);
      if (below < t.row * 5) return false;
    }
  }
  return true;
}
function tryRank(b, tree, t, d) {
  const r = b.talents[t.key] || 0;
  const n = r + d;
  if (n < 0 || n > t.max) return false;
  if (d > 0 && totalPoints(b) >= MAX_POINTS) return false;
  if (n) b.talents[t.key] = n; else delete b.talents[t.key];
  if (treeValid(b, tree)) return true;
  if (r) b.talents[t.key] = r; else delete b.talents[t.key];
  return false;
}
function canAdd(b, tree, t) {
  const r = b.talents[t.key] || 0;
  if (r >= t.max || totalPoints(b) >= MAX_POINTS) return false;
  b.talents[t.key] = r + 1;
  const ok = treeValid(b, tree);
  if (r) b.talents[t.key] = r; else delete b.talents[t.key];
  return ok;
}
function spec(b) {
  const c = cls(b.class);
  const parts = c.trees.map((t) => treePoints(b, t));
  const max = Math.max(...parts);
  return { tree: max > 0 ? c.trees[parts.indexOf(max)] : null, parts };
}

function showTip(e, html) { const t = $("tip"); t.innerHTML = html; t.style.display = "block"; moveTip(e); }
function moveTip(e) { const t = $("tip"); t.style.left = Math.min(e.clientX + 16, innerWidth - 380) + "px"; t.style.top = Math.min(e.clientY + 12, innerHeight - t.offsetHeight - 10) + "px"; }
function hideTip() { $("tip").style.display = "none"; }
function tipOn(node, fn) { node.onmouseenter = (e) => showTip(e, fn()); node.onmousemove = moveTip; node.onmouseleave = hideTip; }
const fmtV = (desc, v) => (v === undefined ? desc.split("{v}").join("?") : desc.split("{v}").join(Number.isInteger(v) ? v : +v.toFixed(1)));

function iconNode(icon, extra) {
  const d = el("div", "ic " + (extra || ""));
  const img = el("img"); img.src = ICON(icon); img.loading = "lazy";
  d.appendChild(img);
  return d;
}

function renderTalents(sec, b) {
  const c = cls(b.class);
  const sp = spec(b);
  const wrap = el("div", "trees");
  c.trees.forEach((tree, ti) => {
    const pts = treePoints(b, tree);
    const box = el("div", "tree" + (sp.tree === tree ? " spec" : ""));
    box.style.backgroundImage = `linear-gradient(rgba(14,14,16,.5), rgba(14,14,16,.82)), url(img/${b.class}-${ti}.jpg)`;
    box.appendChild(el("div", "head", `<span>${esc(L(tree.name))}</span><span>${pts} ${T("pts")}</span>`));
    const grid = el("div", "grid");
    grid.style.gridTemplateRows = "repeat(7, 58px)";
    const miles = tree.talents.filter((t) => t.milestone || t.capstone);
    for (let i = 1; i < miles.length; i++) {
      const a = miles[i - 1], z = miles[i];
      if (a.col !== z.col) continue;
      const ln = el("div", "line" + ((b.talents[a.key] || 0) >= a.max ? " on" : ""));
      ln.style.left = `calc(${(a.col + 0.5) * 25}% - 1px)`;
      ln.style.top = a.row * 58 + 50 + "px";
      ln.style.height = (z.row - a.row) * 58 - 42 + "px";
      grid.appendChild(ln);
    }
    tree.talents.forEach((t) => {
      const r = b.talents[t.key] || 0;
      const state = r >= t.max ? "full" : r > 0 ? "some" : canAdd(b, tree, t) ? "" : "locked";
      const n = iconNode(t.icon, state);
      n.style.gridRow = t.row + 1;
      n.style.gridColumn = t.col + 1;
      n.appendChild(el("span", "rk", `${r}/${t.max}`));
      n.onclick = () => { if (tryRank(b, tree, t, 1)) changed(); };
      n.oncontextmenu = (e) => { e.preventDefault(); if (tryRank(b, tree, t, -1)) changed(); };
      tipOn(n, () => {
        const rr = b.talents[t.key] || 0;
        const d = L(t.desc);
        let h = `<div class="t">${esc(L(t.name))}</div><div class="r">${T("rank")} ${rr}/${t.max}</div><div>${esc(fmtV(d, t.v !== undefined ? t.v * Math.max(rr, 1) : undefined))}</div>`;
        if (rr > 0 && rr < t.max && t.v !== undefined) h += `<div class="r" style="margin-top:6px">${T("next")}</div><div>${esc(fmtV(d, t.v * (rr + 1)))}</div>`;
        const below = tree.talents.filter((o) => o.row < t.row).reduce((x, o) => x + (b.talents[o.key] || 0), 0);
        if (below < t.row * 5) h += `<div class="warn">${T("locked", { n: t.row * 5 })}</div>`;
        return h + `<div class="r" style="margin-top:6px">${T("clickTalent")}</div>`;
      });
      grid.appendChild(n);
    });
    box.appendChild(grid);
    const ml = el("div", "miles");
    miles.forEach((t) => ml.appendChild(el("div", (b.talents[t.key] || 0) > 0 ? "on" : "", `${t.row * 5} ${T("pts")} · ${esc(L(t.name))}`)));
    box.appendChild(ml);
    wrap.appendChild(box);
  });
  sec.appendChild(wrap);
  const reset = el("button", "", T("reset"));
  reset.style.marginTop = "12px";
  reset.onclick = () => { b.talents = {}; changed(); };
  sec.appendChild(reset);
  const ap = el("button", "primary", esc(T("applyTal")));
  ap.style.margin = "12px 0 0 8px";
  const msg = el("span", "hint", esc(T("applyTalHelp")));
  msg.style.marginLeft = "10px";
  ap.onclick = async () => {
    ap.disabled = true;
    msg.textContent = T("applyTalRun");
    try { const r = await fetch("/api/apply-talents", { method: "POST", body: JSON.stringify(b) }).then((x) => x.json()); msg.textContent = T("applyTal_" + r.result); } catch (e) { msg.textContent = T("down"); }
    ap.disabled = false;
  };
  sec.appendChild(ap);
  sec.appendChild(msg);
}

function renderSpells(sec, b) {
  const c = cls(b.class);
  const cols = el("div", "cols");
  const left = el("div", "list");
  left.appendChild(el("h3", "", T("pool")));
  left.appendChild(el("div", "hint", T("poolHint")));
  c.spells.forEach((s) => {
    const idx = b.spells.findIndex((x) => x.key === s.key);
    const it = el("div", "item pool");
    it.appendChild(iconNode(s.icon, b.ban[s.key] ? "ban" : ""));
    it.appendChild(el("div", "name", esc(L(s.name))));
    it.appendChild(el("div", "tag" + (b.ban[s.key] ? " ban" : ""), b.ban[s.key] ? T("banned") : idx >= 0 ? "#" + (idx + 1) : ""));
    it.onclick = () => { delete b.ban[s.key]; if (idx < 0) b.spells.push({ key: s.key, w: 3 }); changed(); };
    it.oncontextmenu = (e) => { e.preventDefault(); if (b.ban[s.key]) delete b.ban[s.key]; else { b.ban[s.key] = true; if (idx >= 0) b.spells.splice(idx, 1); } changed(); };
    left.appendChild(it);
  });
  const right = el("div", "list");
  right.appendChild(el("h3", "", T("prio")));
  right.appendChild(el("div", "hint", T("prioHint")));
  if (!b.spells.length) right.appendChild(el("div", "hint", T("emptyPrio")));
  b.spells.forEach((e, i) => {
    const s = spellOf(c, e.key);
    if (!s) return;
    if (i === SLOTS) right.appendChild(el("div", "sep", T("fallbackSep")));
    const it = el("div", "item" + (i >= SLOTS ? " extra" : ""));
    it.appendChild(el("div", "num", i + 1));
    it.appendChild(iconNode(s.icon));
    it.appendChild(el("div", "name", esc(L(s.name))));
    const btn = (txt, fn) => { const x = el("button", "small", txt); x.onclick = fn; it.appendChild(x); };
    btn("▲", () => { if (i > 0) { [b.spells[i - 1], b.spells[i]] = [b.spells[i], b.spells[i - 1]]; changed(); } });
    btn("▼", () => { if (i < b.spells.length - 1) { [b.spells[i + 1], b.spells[i]] = [b.spells[i], b.spells[i + 1]]; changed(); } });
    it.appendChild(el("span", "hint", T("weight")));
    btn("−", () => { e.w = Math.max(1, (e.w || 3) - 1); changed(); });
    it.appendChild(el("b", "", e.w || 3));
    btn("+", () => { e.w = Math.min(5, (e.w || 3) + 1); changed(); });
    btn("✕", () => { b.spells.splice(i, 1); changed(); });
    right.appendChild(it);
  });
  cols.appendChild(left);
  cols.appendChild(right);
  sec.appendChild(cols);
}

function jewelIcon(b, cat, j, want, c) {
  const list = b[cat];
  const idx = list.indexOf(j.key);
  let state = j.legendary ? "leg" : "";
  if (b.ban[j.key]) state = "ban"; else if (idx >= 0) state = idx < want ? "target" : "fallback";
  const n = iconNode(j.icon, state);
  if (idx >= 0 && !b.ban[j.key]) n.appendChild(el("span", "badge", idx + 1)).style.color = idx < want ? "var(--gold)" : "var(--blue)";
  if (j.sub) { const s = el("img", "sub"); s.src = ICON(j.sub); n.appendChild(s); }
  n.onclick = () => { delete b.ban[j.key]; if (idx >= 0) list.splice(idx, 1); else list.push(j.key); changed(); };
  n.oncontextmenu = (e) => { e.preventDefault(); if (idx >= 0) list.splice(idx, 1); if (b.ban[j.key]) delete b.ban[j.key]; else b.ban[j.key] = true; changed(); };
  tipOn(n, () => {
    if (j.legendary) return `<div class="t leg">${esc(L(j.name))}</div>` + (j.lines[lang()] || j.lines.en).map((x) => `<div>${esc(x)}</div>`).join("");
    const lines = j.desc && typeof j.desc === "object" ? j.desc[lang()] || j.desc.en : [];
    const rar = j.tier ? `<div class="mute">${esc(L(DATA.rarity[j.tier[0]]))}</div>` : "";
    return `<div class="t">${esc(L(j.name))}</div>` + rar + lines.map((x) => `<div>${esc(x)}</div>`).join("") + (lines.length ? `<div class="mute">${T("baseVal")}</div>` : "");
  });
  return n;
}

function renderJewels(sec, b) {
  const c = cls(b.class);
  sec.appendChild(el("div", "hint", T("jewelHint")));
  const cols = el("div", "jcols");
  [["rings", 2], ["trinkets", 2], ["amulets", 1]].forEach(([cat, want]) => {
    const col = el("div", "jcol");
    col.appendChild(el("h3", "", T(cat)));
    const g = el("div", "jgrid");
    DATA[cat].forEach((j) => g.appendChild(jewelIcon(b, cat, j, want, c)));
    col.appendChild(g);
    if (cat === "amulets") {
      col.appendChild(el("div", "legtitle", T("legendary")));
      const lg = el("div", "jgrid");
      c.spells.forEach((s) => { const j = legendary(c, s.key); if (j) lg.appendChild(jewelIcon(b, cat, j, want, c)); });
      col.appendChild(lg);
    }
    const jl = el("div", "jlist");
    b.jw = b.jw || {};
    b[cat].forEach((k, i) => {
      const j = jewel(cat, k, c);
      if (!j) return;
      const row = el("div", "jrow", `<span class="jn">${i + 1}. ${esc(L(j.name))} <span>${i < want ? T("target") : T("fallback")}</span></span>`);
      const w = () => b.jw[k] || (i < want ? 5 : 3);
      const btn = (txt, fn) => { const x = el("button", "small", txt); x.onclick = fn; row.appendChild(x); };
      row.appendChild(el("span", "hint", T("weight")));
      btn("−", () => { b.jw[k] = Math.max(1, w() - 1); changed(); });
      row.appendChild(el("b", "", w()));
      btn("+", () => { b.jw[k] = Math.min(5, w() + 1); changed(); });
      jl.appendChild(row);
    });
    col.appendChild(jl);
    cols.appendChild(col);
  });
  sec.appendChild(cols);
}

function field(form, label, input, help) {
  form.appendChild(el("label", "", label));
  form.appendChild(input);
  if (help) form.appendChild(el("div", "help", help));
}
function rangeInput(get, set, min, max, step, fmt) {
  const w = el("div");
  const r = el("input"); r.type = "range"; r.min = min; r.max = max; r.step = step; r.value = get();
  const v = el("span", "val", fmt(get()));
  r.oninput = () => { set(+r.value); v.textContent = fmt(+r.value); save(); };
  w.appendChild(r); w.appendChild(v);
  return w;
}
function checkInput(get, set) {
  const c = el("input"); c.type = "checkbox"; c.checked = !!get();
  c.onchange = () => { set(c.checked ? 1 : 0); save(); };
  const w = el("div"); w.appendChild(c); return w;
}

function renderRules(sec, b) {
  const r = b.rules;
  const f = el("div", "form");
  field(f, T("rarity"), rangeInput(() => r.rarity ?? 50, (x) => (r.rarity = x), 0, 100, 10, (x) => x + " %"), T("rarityHelp"));
  field(f, T("reserve"), rangeInput(() => r.reserve ?? 1, (x) => (r.reserve = x), 0, 6, 1, String));
  field(f, T("banishes"), rangeInput(() => r.banishes ?? 3, (x) => (r.banishes = x), 0, 3, 1, String));
  field(f, T("reroll"), checkInput(() => r.reroll ?? 1, (x) => (r.reroll = x)));
  field(f, T("fallbackLevel"), rangeInput(() => r.fallbackLevel ?? 10, (x) => (r.fallbackLevel = x), 1, 40, 1, String), T("fallbackHelp"));
  field(f, T("boost"), rangeInput(() => r.boost ?? 2, (x) => (r.boost = x), 1, 4, 0.5, (x) => "x" + x), T("boostHelp"));
  field(f, T("adapt"), checkInput(() => r.adapt ?? 1, (x) => (r.adapt = x)), T("adaptHelp"));
  sec.appendChild(f);
}

function renderOptions(sec) {
  const s = STATE.settings;
  const f = el("div", "form");
  const p = el("input"); p.type = "text"; p.value = s.gamePath || ""; p.onchange = () => { s.gamePath = p.value; save(); };
  const br = el("button", "", T("browse"));
  br.onclick = async () => {
    let r;
    try { r = await (await fetch("/api/browse", { method: "POST", body: p.value })).json(); } catch (e) { return alert(T("down")); }
    if (r.path) { p.value = r.path; s.gamePath = r.path; save(); }
  };
  const pw = el("div", "pathrow"); pw.appendChild(p); pw.appendChild(br);
  field(f, T("gamePath"), pw);
  const sel = el("select");
  [["auto", T("auto")], ["fr", "Français"], ["en", "English"]].forEach(([v, l]) => { const o = el("option", "", l); o.value = v; if ((s.lang || "auto") === v) o.selected = true; sel.appendChild(o); });
  sel.onchange = () => { s.lang = sel.value; changed(); };
  field(f, T("lang"), sel);
  field(f, T("autoPick"), checkInput(() => s.autoPick, (x) => (s.autoPick = x)), T("autoPickHelp"));
  field(f, T("overlay"), checkInput(() => s.overlay ?? 1, (x) => (s.overlay = x)));
  field(f, T("autoAddons"), checkInput(() => s.autoAddons ?? 1, (x) => (s.autoAddons = x)), T("autoAddonsHelp"));
  field(f, T("share"), checkInput(() => s.shareRuns ?? 1, (x) => (s.shareRuns = x)), T("shareHelp"));
  const ver = el("div", "row");
  ver.appendChild(el("span", "", esc(VERSION || "-")));
  const chk = el("button", "small", esc(T("checkUpdate")));
  const res = el("span", "hint");
  chk.onclick = async () => {
    const r = await (await fetch("/api/check", { method: "POST" })).json();
    res.textContent = r.update ? T("updateAvail", { v: r.update }) + " " : r.updateError || T("upToDate");
    if (r.update) {
      const go = el("button", "small primary", esc(T("updateBtn")));
      go.onclick = () => startUpdate(r.update);
      res.appendChild(go);
    }
  };
  ver.appendChild(chk);
  ver.appendChild(res);
  field(f, T("version"), ver);
  const rep = el("div", "row");
  const rb = el("button", "small", esc(T("report")));
  const rr = el("span", "hint");
  rb.onclick = async () => {
    rb.disabled = true;
    try {
      const r = await (await fetch("/api/report", { method: "POST", body: "" })).json();
      rr.textContent = r.path ? T("reportDone", { v: r.path }) : r.error || "";
    } catch (e) { rr.textContent = T("down"); }
    rb.disabled = false;
  };
  rep.appendChild(rb);
  rep.appendChild(rr);
  field(f, T("reportLabel"), rep, T("reportHelp"));
  sec.appendChild(f);
}

function encode(b) {
  const c = cls(b.class);
  const trees = c.trees.map((t) => t.talents.map((x) => b.talents[x.key] || 0).join("")).join("/");
  const r = b.rules;
  return ["SB1", b.class, b.name.replace(/[;|/,:]/g, " "), trees, b.spells.map((s) => s.key + ":" + (s.w || 3)).join(","), Object.keys(b.ban).sort().join(","),
    ...["rings", "trinkets", "amulets"].map((cat) => b[cat].map((k) => (b.jw && b.jw[k] ? k + ":" + b.jw[k] : k)).join(",")),
    [r.rarity ?? 50, r.reserve ?? 1, r.reroll ?? 1, r.banishes ?? 3, r.fallbackLevel ?? 10, r.boost ?? 2, r.adapt ?? 1].join(",")].join(";");
}
function decode(text) {
  const f = text.trim().split(";");
  if (f[0] !== "SB1" || f.length < 10) return null;
  const c = cls(f[1]);
  if (!c) return null;
  const b = newBuild(c.key, f[2] || undefined);
  f[3].split("/").forEach((s, ti) => { const tree = c.trees[ti]; if (!tree) return; tree.talents.forEach((t, i) => { const r = +s[i]; if (r > 0) b.talents[t.key] = Math.min(r, t.max); }); });
  f[4].split(",").filter(Boolean).forEach((p) => { const [k, w] = p.split(":"); if (spellOf(c, k)) b.spells.push({ key: k, w: Math.max(1, Math.min(5, +w || 3)) }); });
  f[5].split(",").filter(Boolean).forEach((k) => (b.ban[k] = true));
  b.jw = {};
  ["rings", "trinkets", "amulets"].forEach((cat, i) => f[6 + i].split(",").filter(Boolean).forEach((p) => {
    const m = p.match(/^(.*?)(?::([1-5]))?$/);
    const k = m[1];
    if (!jewel(cat, k, c)) return;
    b[cat].push(k);
    if (m[2]) b.jw[k] = Math.max(1, Math.min(5, +m[2]));
  }));
  const r = f[9].split(",").map(Number);
  Object.assign(b.rules, { rarity: r[0] ?? 50, reserve: r[1] ?? 1, reroll: r[2] ?? 1, banishes: r[3] ?? 3, fallbackLevel: r[4] || 10, boost: r[5] || 2, adapt: r[6] ?? 1 });
  return b;
}

// Build importe d'une suggestion (meme nom) dont le code a change depuis : a reimporter
function stalePreset(p) {
  const nm = p.names ? L(p.names) : p.name;
  const old = builds(p.class).find((b) => b.name === nm || b.name === p.name);
  return old && encode(Object.assign({}, old, { name: p.name })) !== p.code ? old : null;
}

// Builds suggeres presents d'office : ajoutes une fois (pas de retour apres suppression), mis a jour tant que le joueur
// ne les a pas modifies ; un build modifie garde ses changements et affiche « Mis a jour » dans les builds proposes.
function syncPresets() {
  STATE.presetsSeen = STATE.presetsSeen || {};
  let changedAny = false;
  for (const p of PRESETS) {
    if (!cls(p.class)) continue;
    const key = p.class + "|" + p.name, nm = p.names ? L(p.names) : p.name;
    const code = (b) => encode(Object.assign({}, b, { name: p.name }));
    let b = STATE.builds.find((x) => x.preset === key) || builds(p.class).find((x) => x.name === nm || x.name === p.name);
    if (!b) {
      if (STATE.presetsSeen[key]) continue;
      const was = STATE.active[p.class];
      b = decode(p.code);
      if (!b) continue;
      b.name = nm;
      if (p.race) b.race = p.race;
      if (p.raceAlt) b.raceAlt = p.raceAlt;
      if (was) STATE.active[p.class] = was;
      b.preset = key;
      b.presetCode = p.code;
      changedAny = true;
    } else {
      if (!b.preset) { b.preset = key; b.presetCode = code(b); changedAny = true; }
      if (b.presetCode !== p.code && code(b) === b.presetCode) {
        const was = STATE.active[p.class], fresh = decode(p.code);
        if (fresh) {
          STATE.builds.splice(STATE.builds.indexOf(fresh), 1);
          Object.assign(b, fresh, { id: b.id, name: b.name, preset: key, presetCode: p.code });
          if (p.race) b.race = p.race;
          b.raceAlt = p.raceAlt;
          STATE.active[p.class] = was || b.id;
          changedAny = true;
        }
      }
    }
    if (!STATE.presetsSeen[key]) { STATE.presetsSeen[key] = 1; changedAny = true; }
  }
  if (changedAny) save();
}

function showPresets() {
  $("presetTitle").textContent = T("presetsTitle", { c: L(cls(CLASS).name) });
  $("presetClose").textContent = T("close");
  const list = $("presetList");
  list.innerHTML = "";
  if (PRESETS.some((p) => p.class === CLASS && stalePreset(p))) list.appendChild(el("div", "stalebanner", esc(T("presetBanner"))));
  PRESETS.filter((p) => p.class === CLASS).forEach((p) => {
    const item = el("div", "preset");
    const head = el("div", "row");
    head.appendChild(el("b", "", esc(p.names ? L(p.names) : p.name)));
    if (p.author) head.appendChild(el("span", "hint", esc(T("by", { v: p.author }))));
    const have = builds(CLASS).some((b) => encode(Object.assign({}, b, { name: p.name })) === p.code);
    const stale = !have && stalePreset(p);
    if (stale) head.appendChild(el("span", "badge2 stale", esc(T("presetStale"))));
    const add = el("button", "small" + (have ? "" : " primary"), esc(have ? T("presetHave") : stale ? T("presetReimport") : T("presetAdd")));
    add.disabled = have;
    add.onclick = () => {
      let b = decode(p.code);
      if (!b) return alert(T("bad"));
      if (stale) {
        STATE.builds.splice(STATE.builds.indexOf(b), 1);
        const id = stale.id;
        b = Object.assign(stale, b, { id });
        STATE.active[p.class] = id;
        b.presetCode = p.code;
      }
      b.name = p.names ? L(p.names) : p.name;
      if (p.race) b.race = p.race;
      if (p.raceAlt) b.raceAlt = p.raceAlt;
      STATE.lastClass = CLASS;
      $("presetModal").classList.add("hidden");
      changed();
    };
    head.appendChild(add);
    item.appendChild(head);
    const notes = p.notes && (p.notes[lang()] || p.notes.en);
    if (notes) item.appendChild(el("div", "hint", esc(notes)));
    const rl = raceLine(p.race, p.raceAlt);
    if (rl) item.appendChild(rl);
    list.appendChild(item);
  });
  $("presetModal").classList.remove("hidden");
}

function modal(title, text, okLabel, onOk) {
  $("modalTitle").textContent = title;
  $("modalText").value = text;
  $("modalOk").textContent = okLabel || "";
  $("modalOk").style.display = okLabel ? "" : "none";
  $("modalClose").textContent = T("close");
  $("modal").classList.remove("hidden");
  $("modalText").focus();
  $("modalText").select();
  $("modalOk").onclick = () => onOk($("modalText").value);
}

function renderHeader() {
  const cs = $("classSel");
  cs.innerHTML = "";
  DATA.classes.forEach((c) => { const o = el("option", "", esc(L(c.name))); o.value = c.key; o.style.color = CLASS_COLORS[c.key]; if (c.key === CLASS) o.selected = true; cs.appendChild(o); });
  cs.style.color = CLASS_COLORS[CLASS];
  const bs = $("buildSel");
  bs.innerHTML = "";
  const b = active();
  builds(CLASS).forEach((x) => { const o = el("option", "", esc(x.name)); o.value = x.id; if (b && x.id === b.id) o.selected = true; bs.appendChild(o); });
  bs.disabled = !b;
  [["newBtn", "new"], ["dupBtn", "dup"], ["renBtn", "ren"], ["delBtn", "del"], ["impBtn", "imp"], ["expBtn", "exp"], ["presetBtn", "presets"]].forEach(([id, k]) => ($(id).textContent = T(k)));
  $("presetBtn").classList.toggle("hidden", !PRESETS.some((p) => p.class === CLASS));
  const nStale = PRESETS.filter((p) => p.class === CLASS && stalePreset(p)).length;
  $("presetBtn").classList.toggle("stalebtn", nStale > 0);
  if (nStale) $("presetBtn").textContent += " (!)";
  const pages = $("pages");
  pages.innerHTML = "";
  ["builds", "stats", "sim", "addons", "options"].forEach((p) => {
    const x = el("button", p === PAGE ? "active" : "", T(p));
    x.onclick = () => { PAGE = p; render(); };
    pages.appendChild(x);
  });
  const tabs = $("tabs");
  tabs.innerHTML = "";
  ["build", "rules"].forEach((t) => {
    const x = el("button", t === TAB ? "active" : "", T(t));
    x.onclick = () => { TAB = t; render(); };
    tabs.appendChild(x);
  });
  if (b) {
    const s = spec(b);
    tabs.appendChild(el("div", "right hint", `${T("spec")} : ${s.tree ? esc(L(s.tree.name)) : "-"} &nbsp; ${s.parts.join("/")} &nbsp; (${totalPoints(b)}/51)`));
  }
}

function render() {
  const y = $("scroll").scrollTop;
  hideTip();
  renderHeader();
  const b = active();
  ["builds", "stats", "sim", "addons", "options"].forEach((p) => ($("page-" + p).className = p === PAGE ? "show" : ""));
  const opt = $("page-options");
  opt.innerHTML = "";
  if (PAGE === "options") renderOptions(opt);
  const st = $("page-stats");
  if (PAGE === "stats") renderStats(st); else st.innerHTML = "";
  if (PAGE === "sim") renderSim($("page-sim")); else $("page-sim").innerHTML = "";
  const ad = $("page-addons");
  if (PAGE === "addons") renderAddons(ad); else ad.innerHTML = "";
  ["build", "rules"].forEach((t) => {
    const sec = $("tab-" + t);
    sec.innerHTML = "";
    sec.className = t === TAB ? "show" : "";
    if (t !== TAB || PAGE !== "builds") return;
    if (!b) { sec.appendChild(el("div", "empty", T("none"))); return; }
    if (t === "rules") return renderRules(sec, b);
    const rl = raceLine(b.race, b.raceAlt);
    if (rl) sec.appendChild(rl);
    [["talents", renderTalents], ["spells", renderSpells], ["jewels", renderJewels]].forEach(([k, fn]) => {
      const part = el("div", "part");
      part.appendChild(el("h2", "", T(k)));
      fn(part, b);
      sec.appendChild(part);
    });
  });
  $("scroll").scrollTop = y;
}

let statusKey = "", updClicked = 0;
function startUpdate(v) {
  updClicked = Date.now();
  $("updModal").classList.remove("hidden");
  $("updText").textContent = T("stage_download", { v });
  $("updBar").style.width = "0%";
  statusKey = "";
  fetch("/api/update", { method: "POST" });
}
async function poll() {
  try {
    const s = await (await fetch("/api/status")).json();
    const lb = $("launchBtn");
    lb.textContent = s.running ? T("running") : T("launch");
    lb.disabled = !!s.running;
    if (VERSION && s.version && s.version !== VERSION) return location.reload();
    VERSION = s.version || VERSION;
    const key = JSON.stringify([s.running, s.spec, s.advice, s.error, s.updating, s.update, s.updatedFrom, s.game, s.addonsUpdated, s.updateError, s.buildsAddon, lang()]);
    const um = $("updModal");
    if (s.updating) {
      um.classList.remove("hidden");
      $("updText").textContent = T("stage_" + (s.updateStage || "download"), { v: s.update || "" });
      $("updBar").style.width = (s.updateStage === "download" ? s.updateProgress || 0 : s.updateStage ? 100 : 0) + "%";
    } else if (!updClicked || Date.now() - updClicked > 4000) um.classList.add("hidden");
    if (key === statusKey) return;
    statusKey = key;
    const st = $("status");
    st.innerHTML = "";
    const add = (cls, html) => { const x = el("span", cls, html); st.appendChild(x); return x; };
    if (s.running) add("", s.advice ? `${T("advice")} : <b>${esc(s.advice)}</b>` : T("running"));
    else if (s.error) add("err", esc(s.error));
    if (s.spec) add("upd", esc(s.spec));
    if (s.buildsAddon === "missing" || s.buildsAddon === "disabled") {
      const w = add("err", esc(T(s.buildsAddon === "missing" ? "needAddon" : "needAddonOn")) + " ");
      const b = el("button", "small primary", esc(T(s.buildsAddon === "missing" ? "needAddonInstall" : "needAddonEnable")));
      b.onclick = async () => {
        b.disabled = true;
        const r = await fetch("/api/addons", { method: "POST", body: JSON.stringify({ name: "SurvivorsBuilds", action: s.buildsAddon === "missing" ? "install" : "enable" }) }).then((x) => x.json()).catch(() => ({ error: T("down") }));
        if (r.error) { alert(r.error); b.disabled = false; }
        statusKey = "";
        poll();
      };
      w.appendChild(b);
    }
    if (!STATE.settings.shareNoticeSeen && (STATE.settings.shareRuns ?? 1)) {
      const n = add("upd", esc(T("shareNotice")) + " ");
      const ok = el("button", "small", esc(T("shareNoticeOk")));
      ok.onclick = () => { STATE.settings.shareNoticeSeen = 1; save(); statusKey = ""; poll(); };
      n.appendChild(ok);
    }
    if (s.updatedFrom !== null && s.updatedFrom !== undefined) add("upd", esc(T("updated", { v: s.version })));
    if (!s.updating && s.update) {
      const u = add("upd", esc(T("updateAvail", { v: s.update })) + " ");
      const btn = el("button", "small primary", esc(T("updateBtn")));
      btn.onclick = () => startUpdate(s.update);
      u.appendChild(btn);
    }
    if (!s.running && !s.game) {
      const g = add("upd", esc(T("noGame")) + " ");
      const btn = el("button", "small primary", esc(T("browse")));
      btn.onclick = async () => {
        const r = await (await fetch("/api/browse", { method: "POST", body: "" })).json();
        if (r.path) { STATE.settings.gamePath = r.path; save(); }
      };
      g.appendChild(btn);
    }
    if (s.addonsUpdated) add("upd", esc(T("addonsUpdated", { v: s.addonsUpdated })));
    if (s.updateError) add("err", esc(s.updateError));
  } catch (e) {
    statusKey = "";
    $("status").innerHTML = `<span class="err">${esc(T("down"))}</span>`;
  }
}
function loop() { poll().finally(() => setTimeout(loop, 1500)); }

document.addEventListener("click", (e) => {
  const a = e.target.closest("a[target=_blank]");
  if (!a) return;
  e.preventDefault();
  fetch("/api/open", { method: "POST", body: a.href }).catch(() => window.open(a.href));
});

function windowFrame() {
  const wv = window.chrome && window.chrome.webview;
  if (!wv) return;
  document.body.classList.add("framed");
  $("winCtl").classList.remove("hidden");
  $("winCtl").querySelectorAll("button").forEach((b) => (b.onclick = () => wv.postMessage(b.dataset.w)));
  const head = document.querySelector("header");
  head.addEventListener("mousedown", (e) => {
    if (e.button !== 0 || e.target.closest("button, a, select, input")) return;
    wv.postMessage(e.clientY < 5 ? "resize-top" : "drag");
  });
  head.addEventListener("dblclick", (e) => { if (!e.target.closest("button, a, select, input")) wv.postMessage("max"); });
  wv.addEventListener("message", (e) => document.body.classList.toggle("maximized", e.data === "maximized"));
}

async function init() {
  windowFrame();
  [DATA, STATE] = await Promise.all([fetch("data.json").then((r) => r.json()), fetch("/api/state").then((r) => r.json())]);
  try { PRESETS = await (await fetch("defaults.json")).json(); } catch (e) { PRESETS = []; }
  STATE.builds = STATE.builds || [];
  STATE.active = STATE.active || {};
  STATE.settings = STATE.settings || {};
  STATE.nextId = STATE.nextId || 1;
  syncPresets();
  CLASS = STATE.lastClass || "warrior";
  const qp = new URLSearchParams(location.search);
  if (["builds", "stats", "sim", "addons", "options"].includes(qp.get("page"))) PAGE = qp.get("page");
  if (qp.get("tab") === "rules") TAB = "rules";
  $("classSel").onchange = (e) => { CLASS = e.target.value; STATE.lastClass = CLASS; changed(); };
  $("buildSel").onchange = (e) => { STATE.active[CLASS] = +e.target.value; changed(); };
  $("newBtn").onclick = () => { newBuild(CLASS); changed(); };
  $("dupBtn").onclick = () => { const b = active(); if (!b) return; const c = JSON.parse(JSON.stringify(b)); c.id = STATE.nextId++; c.name += " (2)"; STATE.builds.push(c); STATE.active[CLASS] = c.id; changed(); };
  $("renBtn").onclick = () => { const b = active(); if (!b) return; const n = prompt(T("renamePrompt"), b.name); if (n) { b.name = n; changed(); } };
  $("delBtn").onclick = () => { const b = active(); if (!b || !confirm(T("delConfirm"))) return; STATE.builds = STATE.builds.filter((x) => x !== b); delete STATE.active[CLASS]; changed(); };
  $("expBtn").onclick = () => { const b = active(); if (b) modal(T("exportTitle"), encode(b)); };
  $("impBtn").onclick = () => modal(T("importTitle"), "", T("ok"), (txt) => {
    const b = decode(txt);
    if (!b) return alert(T("bad"));
    CLASS = b.class; STATE.lastClass = CLASS;
    $("modal").classList.add("hidden");
    changed();
  });
  $("modalClose").onclick = () => $("modal").classList.add("hidden");
  $("presetClose").onclick = () => $("presetModal").classList.add("hidden");
  $("presetBtn").onclick = () => showPresets();
  $("launchBtn").onclick = async () => {
    try { await fetch("/api/state", { method: "POST", body: JSON.stringify(STATE) }); await fetch("/api/launch", { method: "POST" }); } catch (e) { alert(T("down")); }
  };
  render();
  loop();
}
init();
