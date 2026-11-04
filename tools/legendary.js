const fs = require("fs");
const path = require("path");
const makeEmu = require("./emu.js");
const [exe, outJson, locDir] = process.argv.slice(2);
const E = makeEmu(exe);
const P = E.P;
// Resout "ability.<key>.name" / "ability.<key>.name_lc" via la loc anglaise, comme le ferait le
// callback de rendu du jeu (0x1460e6d50 en 0.135.1) : plus simple et fiable que d'emuler le vrai
// systeme de localisation Rust (format fmt::Arguments complexe).
const LOC_EN = locDir ? JSON.parse(fs.readFileSync(path.join(locDir, "loc-1.json"), "utf8")) : {};
const ABIL = 0x73a26d8; // 0x729e408 en 0.119, 0x7105910 en 0.135.1, 0x7322758 en 0.139 (table d'abilites, toujours stride 120)
const N = 115; // 113 en 0.119, 114 en 0.139 (Chaman a 12 sorts), +1 en 0.141 (kill_command, Chasseur a 12 sorts)
const START = 0x145e0baec; // 0x145c6a237 en 0.135.1, 0x145ddd60c en 0.139 ; sur le sub rsp du prologue
const TAIL = 0x145e0dd9f; // 0x145c6bcce en 0.135.1, 0x145ddf4c5 en 0.139 ; juste avant l'epilogue
// Familles a code propre : leur nom n'est pas dans la pile a la sortie (0.134, colliers du Chaman), Packlord (0.141, kill_command)
const FAMILIES = { rockbiter: "Heart of the Earthbreaker", stormstrike: "Eye of the Tempest", fire_nova: "Cinderheart Pendant", frost_shock: "Winter's Embrace", earth_shock: "Earthshatter Seal", flame_shock: "Emberwake Pendant", demonic_empowerment: "The Legionlord's Medallion", kill_command: "Heart of the Packlord" };
const str = (addr, len) => {
  const o = P.toOff(BigInt(addr));
  return o < 0 ? null : P.buf.toString("utf8", o, o + Number(len));
};
const results = [];
for (let i = 0; i < N; i++) {
  const off = ABIL + i * 120;
  const va = P.toVA(off);
  const key = P.str(off, 40);
  try {
    const r = E.run({
      start: START,
      stopAt: new Set([TAIL]),
      // 0x145d70ab0 (0.139, lit le type du sort) est integree a la fonction en 0.141
      regs: { RDX: va, RCX: 0x100000000800n },
      calls: {
        // 0x146114bf0 (0.135.1), 0x146326b00 (0.139), 0x1463a7490 (0.141) fait les deux roles vus en 0.119 (0x145fc4880 grow + 0x145f66f30 init) :
        // reserve/agrandit le Vec<Effect> passe par pointeur dans RCX.
        0x1463a7490: (api) => {
          const v = api.regs[api.Register.RCX];
          const cap = api.rdInt(v, 8), ptr = api.rdInt(v + 8n, 8), len = api.rdInt(v + 16n, 8);
          const ncap = cap * 2n > 4n ? cap * 2n : 4n;
          const np = api.alloc(Number(ncap) * 64);
          if (cap > 0n && ptr >= api.HEAP) api.wr(np, Buffer.from(api.rd(ptr, Number(len) * 64)));
          api.wrInt(v, 8, ncap);
          api.wrInt(v + 8n, 8, np);
          api.regs[api.Register.RAX] = np;
        },
        // 0x145c90340, 0x145e913a0 (0.139), 0x145e788b0 (0.141) : interning de chaine (deduplication Rust) avec cache TLS. On ne peut pas
        // emuler le cache fidelement ; renvoyer 0 (pas trouve) fait retomber le code appelant sur
        // la chaine d'origine (RDX/RSI deja corrects), resultat identique, juste pas deduplique.
        0x145e788b0: (api) => { api.regs[api.Register.RAX] = 0n; },
        // 0x1460e6d50, 0x1462f8c40 (0.139), 0x146378290 (0.141) : resout une cle de localisation format_args!() (ex. "ability.{}.name" avec
        // la cle du sort en argument). RCX=dest String{ptr,len,cap}, R8=tableau d'arguments
        // (ici juste la cle du sort, en [R8]={ptr,len}). On lit cette cle, on resout nous-memes
        // via la loc anglaise (meme resultat que spellName() de legendary-render.js), et on ecrit
        // le resultat comme une String Rust dans [RCX].
        0x146378290: (api) => {
          const R = api.Register;
          const argPtr = api.rdInt(api.regs[R.R8], 8), argLen = api.rdInt(api.regs[R.R8] + 8n, 8);
          let argKey = "";
          if (argLen > 0n && argLen < 100n) { const off = P.toOff(argPtr); if (off >= 0) argKey = P.buf.toString("utf8", off, off + Number(argLen)); }
          const resolved = LOC_EN["ability." + argKey + ".name"] || argKey;
          const bytes = Buffer.from(resolved, "utf8");
          const resPtr = api.alloc(bytes.length || 1);
          api.wr(resPtr, bytes);
          const dest = api.regs[R.RCX];
          api.wrInt(dest, 8, resPtr);
          api.wrInt(dest + 8n, 8, BigInt(bytes.length));
          api.wrInt(dest + 16n, 8, BigInt(bytes.length));
        },
        // 0x1400021d0 : desalloue l'ancien buffer de la String avant remplacement (drop). Rien a
        // faire dans notre heap jetable, pas de vraie gestion memoire necessaire ici.
        0x1400021d0: () => {},
        // Allocations de Vec<u8> (cles de famille longues, Chaman 0.134) : profilage vide, alloc, try_reserve.
        0x140002200: () => {},
        0x1463a5541: (api) => { // memcpy (0x146325eeb en 0.139)
          const R = api.Register, n = Number(api.regs[R.R8]);
          api.wr(api.regs[R.RCX], Buffer.from(api.rd(api.regs[R.RDX], n)));
          api.regs[R.RAX] = api.regs[R.RCX];
        },
        0x1400021c0: (api) => { api.regs[api.Register.RAX] = api.alloc(Number(api.regs[api.Register.RCX]) || 1); },
        0x1400e57c0: (api) => { // allocation brute d'un Vec (0x1400223d0 en 0.139)
          const R = api.Register, n = api.regs[R.RDX], out = api.regs[R.RCX];
          const size = api.rdInt(api.regs[R.RSP] + 0x28n, 8);
          api.wrInt(out, 4, 0n);
          api.wrInt(out + 8n, 8, n);
          api.wrInt(out + 16n, 8, api.alloc(Number(n * size) || 1));
        },
      },
    });
    const a = r.api;
    const R = a.Register;
    const rbp = a.regs[R.RBP];
    // Structure de sortie (RAX) : +0x38/+0x40 effets, +0x48/+0x50 icone ; famille en [rbp-8] (0.139)
    const out = a.regs[R.RAX];
    const vptr = a.rdInt(out + 0x38n, 8), vlen = Number(a.rdInt(out + 0x40n, 8));
    const effects = [];
    for (let k = 0; k < vlen; k++) effects.push(Buffer.from(a.rd(vptr + BigInt(k * 64), 64)).toString("hex"));
    const fam = FAMILIES[key] || str(a.rdInt(rbp - 8n, 8), a.rdInt(rbp, 8));
    const icon = str(a.rdInt(out + 0x48n, 8), a.rdInt(out + 0x50n, 8));
    results.push({ i, key, family: fam, icon, effects });
    console.log(i, key, "|", fam, "|", icon, "|", effects.length, "effects");
  } catch (e) {
    console.log(i, key, "ERROR", e.message);
    results.push({ i, key, error: e.message });
  }
}
require("fs").writeFileSync(outJson, JSON.stringify(results, null, 1));
