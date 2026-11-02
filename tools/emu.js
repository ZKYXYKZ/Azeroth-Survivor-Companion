const load = require("./pe.js");
const X = require("iced-x86");
const { Decoder, DecoderOptions, Formatter, FormatterSyntax, OpKind, Register, RegisterExt, MemorySizeExt, Mnemonic, ConditionCode } = X;

const M64 = (1n << 64n) - 1n;
const mask = (bits) => (1n << BigInt(bits)) - 1n;

module.exports = function makeEmu(exePath) {
  const P = load(exePath);
  const { buf } = P;
  const text = P.sec(".text");
  const ib = P.ib;
  const imgLo = ib, imgHi = ib + 0x10000000n;
  const fmt = new Formatter(FormatterSyntax.Nasm);
  const cache = new Map();

  function decodeAt(ip) {
    if (cache.has(ip)) return cache.get(ip);
    const off = P.toOff(BigInt(ip));
    const d = new Decoder(64, buf.subarray(off, off + 16), DecoderOptions.None);
    d.ip = BigInt(ip);
    const ins = d.decode();
    cache.set(ip, ins);
    return ins;
  }

  function run(opts) {
    const heap = Buffer.alloc(1 << 20);
    let heapTop = 0x1000;
    const HEAP = 0x100000000000n;
    const stack = Buffer.alloc(1 << 16);
    const STACK = 0x7f0000000000n;
    const regs = {};
    const xmm = {};
    const flags = { zf: 0, cf: 0, sf: 0, of: 0, pf: 0 };
    const full = (r) => RegisterExt.fullRegister(r);
    const rsize = (r) => RegisterExt.size(r);
    const isXmm = (r) => RegisterExt.isXMM(r);
    const getFull = (r) => regs[full(r)] || 0n;
    const getReg = (r) => {
      if (isXmm(r)) return xmm[r] || Buffer.alloc(16);
      const v = getFull(r);
      const sz = rsize(r);
      if (r === Register.AH || r === Register.BH || r === Register.CH || r === Register.DH) return (v >> 8n) & 0xffn;
      return v & mask(sz * 8);
    };
    const setReg = (r, val) => {
      if (isXmm(r)) { xmm[r] = val; return; }
      const f = full(r);
      const sz = rsize(r);
      val = BigInt.asUintN(sz * 8, val);
      if (sz === 8) regs[f] = val;
      else if (sz === 4) regs[f] = val;
      else { const old = regs[f] || 0n; const m = mask(sz * 8); regs[f] = (old & ~m & M64) | val; }
    };
    const mem = (addr, n) => {
      if (addr >= HEAP && addr < HEAP + BigInt(heap.length)) { const o = Number(addr - HEAP); return { b: heap, o }; }
      if (addr >= STACK - 0x8000n && addr < STACK + 0x8000n) { const o = Number(addr - STACK + 0x8000n); return { b: stack, o }; }
      if (addr >= imgLo && addr < imgHi) { const o = P.toOff(addr); if (o >= 0) return { b: buf, o, ro: true }; }
      throw new Error("bad mem 0x" + addr.toString(16));
    };
    const rd = (addr, n) => { const m = mem(addr, n); return m.b.subarray(m.o, m.o + n); };
    const rdInt = (addr, n) => { const s = rd(addr, n); let v = 0n; for (let i = n - 1; i >= 0; i--) v = (v << 8n) | BigInt(s[i]); return v; };
    const wr = (addr, bytes) => { const m = mem(addr, bytes.length); if (m.ro) throw new Error("write ro 0x" + addr.toString(16)); bytes.copy(m.b, m.o); };
    const wrInt = (addr, n, v) => { const b = Buffer.alloc(n); for (let i = 0; i < n; i++) { b[i] = Number((v >> BigInt(8 * i)) & 0xffn); } wr(addr, b); };
    const alloc = (n) => { const a = HEAP + BigInt(heapTop); heapTop += (n + 15) & ~15; return a; };

    const ea = (ins) => {
      if (ins.isIpRelMemoryOperand) return BigInt(ins.ipRelMemoryAddress);
      let a = BigInt.asUintN(64, ins.memoryDisplacementU64 !== undefined ? BigInt(ins.memoryDisplacementU64) : BigInt(ins.memoryDisplacement));
      if (ins.memoryBase !== Register.None) a += getFull(ins.memoryBase);
      if (ins.memoryIndex !== Register.None) a += getFull(ins.memoryIndex) * BigInt(ins.memoryIndexScale);
      return a & M64;
    };
    const opKind = (ins, i) => ins.opKind(i);
    const opSize = (ins, i) => {
      const k = opKind(ins, i);
      if (k === OpKind.Register) return rsize(ins.opRegister(i));
      if (k === OpKind.Memory) return MemorySizeExt.size(ins.memorySize);
      return 8;
    };
    const readOp = (ins, i, size) => {
      const k = opKind(ins, i);
      if (k === OpKind.Register) return getReg(ins.opRegister(i));
      if (k === OpKind.Memory) return rdInt(ea(ins), size || opSize(ins, i));
      if (k === OpKind.Immediate8 || k === OpKind.Immediate16 || k === OpKind.Immediate32 || k === OpKind.Immediate64 ||
          k === OpKind.Immediate8to16 || k === OpKind.Immediate8to32 || k === OpKind.Immediate8to64 || k === OpKind.Immediate32to64) {
        return BigInt.asUintN(64, BigInt(ins.immediate(i)));
      }
      if (k === OpKind.NearBranch64) return BigInt(ins.nearBranch64);
      throw new Error("op kind " + k);
    };
    const writeOp = (ins, i, v) => {
      const k = opKind(ins, i);
      if (k === OpKind.Register) return setReg(ins.opRegister(i), v);
      if (k === OpKind.Memory) return wrInt(ea(ins), opSize(ins, i), v);
      throw new Error("write op kind " + k);
    };
    const setFlagsLogic = (r, bits) => { flags.zf = r === 0n ? 1 : 0; flags.sf = Number((r >> BigInt(bits - 1)) & 1n); flags.cf = 0; flags.of = 0; };
    const setFlagsSub = (a, b, bits) => {
      const m = mask(bits); const r = (a - b) & m;
      flags.zf = r === 0n ? 1 : 0; flags.sf = Number((r >> BigInt(bits - 1)) & 1n); flags.cf = a < b ? 1 : 0;
      const sa = (a >> BigInt(bits - 1)) & 1n, sb = (b >> BigInt(bits - 1)) & 1n, sr = (r >> BigInt(bits - 1)) & 1n;
      flags.of = (sa !== sb && sr !== sa) ? 1 : 0; return r;
    };
    const setFlagsAdd = (a, b, bits) => {
      const m = mask(bits); const full = a + b; const r = full & m;
      flags.zf = r === 0n ? 1 : 0; flags.sf = Number((r >> BigInt(bits - 1)) & 1n); flags.cf = full > m ? 1 : 0;
      const sa = (a >> BigInt(bits - 1)) & 1n, sb = (b >> BigInt(bits - 1)) & 1n, sr = (r >> BigInt(bits - 1)) & 1n;
      flags.of = (sa === sb && sr !== sa) ? 1 : 0; return r;
    };
    const cond = (cc) => {
      switch (cc) {
        case ConditionCode.e: return flags.zf;
        case ConditionCode.ne: return !flags.zf;
        case ConditionCode.b: return flags.cf;
        case ConditionCode.ae: return !flags.cf;
        case ConditionCode.be: return flags.cf || flags.zf;
        case ConditionCode.a: return !flags.cf && !flags.zf;
        case ConditionCode.l: return flags.sf !== flags.of;
        case ConditionCode.ge: return flags.sf === flags.of;
        case ConditionCode.le: return flags.zf || flags.sf !== flags.of;
        case ConditionCode.g: return !flags.zf && flags.sf === flags.of;
        case ConditionCode.s: return flags.sf;
        case ConditionCode.ns: return !flags.sf;
        case ConditionCode.p: return flags.pf;
        case ConditionCode.np: return !flags.pf;
        default: throw new Error("cc " + cc);
      }
    };
    const f32 = (bits) => { const b = Buffer.alloc(4); b.writeUInt32LE(Number(bits & 0xffffffffn)); return b.readFloatLE(0); };
    const f64 = (bits) => { const b = Buffer.alloc(8); b.writeBigUInt64LE(bits & M64); return b.readDoubleLE(0); };

    for (const k of Object.keys(opts.regs || {})) regs[Register[k]] = opts.regs[k];
    regs[Register.RSP] = STACK;
    regs[Register.RBP] = STACK + 0x80n;
    const api = { rd, rdInt, wr, wrInt, alloc, regs, Register, xmm, f32, STACK, HEAP };
    let ip = opts.start;
    const depth = [];
    const trace = [];
    for (let step = 0; step < (opts.maxSteps || 20000); step++) {
      if (opts.stopAt && opts.stopAt.has(ip)) return { ip, api, trace };
      const ins = decodeAt(ip);
      const next = ip + ins.length;
      const mn = ins.mnemonic;
      if (opts.trace) trace.push(ip.toString(16) + " " + fmt.format(ins));
      const sz0 = ins.opCount > 0 ? opSize(ins, 0) : 8;
      const bits = sz0 * 8;
      let jumped = null;
      switch (mn) {
        case Mnemonic.Nop: case Mnemonic.Int3: break;
        case Mnemonic.Mov: writeOp(ins, 0, readOp(ins, 1, sz0) & mask(bits)); break;
        case Mnemonic.Movzx: writeOp(ins, 0, readOp(ins, 1)); break;
        case Mnemonic.Movsxd: case Mnemonic.Movsx: {
          const s1 = opSize(ins, 1); const v = readOp(ins, 1, s1);
          writeOp(ins, 0, BigInt.asUintN(bits, BigInt.asIntN(s1 * 8, v)));
          break;
        }
        case Mnemonic.Lea: writeOp(ins, 0, ea(ins) & mask(bits)); break;
        case Mnemonic.Add: writeOp(ins, 0, setFlagsAdd(readOp(ins, 0), readOp(ins, 1, sz0) & mask(bits), bits)); break;
        case Mnemonic.Sub: writeOp(ins, 0, setFlagsSub(readOp(ins, 0), readOp(ins, 1, sz0) & mask(bits), bits)); break;
        case Mnemonic.Inc: { const c = flags.cf; writeOp(ins, 0, setFlagsAdd(readOp(ins, 0), 1n, bits)); flags.cf = c; break; }
        case Mnemonic.Dec: { const c = flags.cf; writeOp(ins, 0, setFlagsSub(readOp(ins, 0), 1n, bits)); flags.cf = c; break; }
        case Mnemonic.Cmp: setFlagsSub(readOp(ins, 0), readOp(ins, 1, sz0) & mask(bits), bits); break;
        case Mnemonic.Xor: case Mnemonic.Or: case Mnemonic.And: case Mnemonic.Test: {
          const a = readOp(ins, 0), b = readOp(ins, 1, sz0) & mask(bits);
          const r = mn === Mnemonic.Xor ? a ^ b : mn === Mnemonic.Or ? a | b : a & b;
          setFlagsLogic(r & mask(bits), bits);
          if (mn !== Mnemonic.Test) writeOp(ins, 0, r & mask(bits));
          break;
        }
        case Mnemonic.Shl: { const c = readOp(ins, 1) & 63n; const r = (readOp(ins, 0) << c) & mask(bits); writeOp(ins, 0, r); setFlagsLogic(r, bits); break; }
        case Mnemonic.Shr: { const c = readOp(ins, 1) & 63n; const r = (readOp(ins, 0) >> c) & mask(bits); writeOp(ins, 0, r); setFlagsLogic(r, bits); break; }
        case Mnemonic.Bt: { const v = readOp(ins, 0), b = readOp(ins, 1) & BigInt(bits - 1); flags.cf = Number((v >> b) & 1n); break; }
        case Mnemonic.Neg: { const v = readOp(ins, 0); writeOp(ins, 0, setFlagsSub(0n, v, bits)); break; }
        case Mnemonic.Imul: {
          if (ins.opCount === 3) writeOp(ins, 0, (readOp(ins, 1) * readOp(ins, 2)) & mask(bits));
          else if (ins.opCount === 2) writeOp(ins, 0, (readOp(ins, 0) * readOp(ins, 1)) & mask(bits));
          else throw new Error("imul1");
          break;
        }
        case Mnemonic.Sete: case Mnemonic.Setne: case Mnemonic.Setbe: case Mnemonic.Seta: case Mnemonic.Setb: case Mnemonic.Setae:
        case Mnemonic.Setl: case Mnemonic.Setg: case Mnemonic.Setle: case Mnemonic.Setge: case Mnemonic.Setnp: case Mnemonic.Setp:
          writeOp(ins, 0, cond(ins.conditionCode) ? 1n : 0n); break;
        case Mnemonic.Cmove: case Mnemonic.Cmovne: case Mnemonic.Cmovb: case Mnemonic.Cmovae: case Mnemonic.Cmova: case Mnemonic.Cmovbe:
        case Mnemonic.Cmovl: case Mnemonic.Cmovg: case Mnemonic.Cmovle: case Mnemonic.Cmovge: case Mnemonic.Cmovs: case Mnemonic.Cmovns:
          if (cond(ins.conditionCode)) writeOp(ins, 0, readOp(ins, 1, sz0) & mask(bits));
          else if (sz0 === 4) writeOp(ins, 0, readOp(ins, 0));
          break;
        case Mnemonic.Jmp:
          if (opKind(ins, 0) === OpKind.NearBranch64) jumped = Number(ins.nearBranch64);
          else jumped = Number(readOp(ins, 0));
          break;
        case Mnemonic.Je: case Mnemonic.Jne: case Mnemonic.Jb: case Mnemonic.Jae: case Mnemonic.Jbe: case Mnemonic.Ja:
        case Mnemonic.Jl: case Mnemonic.Jge: case Mnemonic.Jle: case Mnemonic.Jg: case Mnemonic.Js: case Mnemonic.Jns:
        case Mnemonic.Jp: case Mnemonic.Jnp:
          if (cond(ins.conditionCode)) jumped = Number(ins.nearBranch64);
          break;
        case Mnemonic.Call: {
          // Appel indirect (fiche de famille, Chaman 0.134) : on execute la cible, Ret revient ici
          if (opKind(ins, 0) !== OpKind.NearBranch64) {
            const callee = Number(readOp(ins, 0));
            depth.push(next);
            regs[Register.RSP] -= 8n;
            jumped = callee;
            break;
          }
          const target = Number(ins.nearBranch64);
          // Fonctions pures a executer vraiment plutot qu'a simuler
          if (opts.follow && opts.follow.has(target)) {
            depth.push(next);
            regs[Register.RSP] -= 8n;
            jumped = target;
            break;
          }
          const h = opts.calls && opts.calls[target];
          if (!h) throw new Error("call 0x" + target.toString(16) + " at 0x" + ip.toString(16));
          h(api);
          break;
        }
        case Mnemonic.Movss: case Mnemonic.Movsd: case Mnemonic.Movaps: case Mnemonic.Movups: case Mnemonic.Movdqu: case Mnemonic.Movdqa: case Mnemonic.Movd: case Mnemonic.Movq: {
          const n = mn === Mnemonic.Movss || mn === Mnemonic.Movd ? 4 : mn === Mnemonic.Movsd || mn === Mnemonic.Movq ? 8 : 16;
          const k0 = opKind(ins, 0), k1 = opKind(ins, 1);
          let src;
          if (k1 === OpKind.Register) {
            const r = ins.opRegister(1);
            if (isXmm(r)) src = Buffer.from(getReg(r)).subarray(0, n);
            else { const v = getReg(r); src = Buffer.alloc(8); src.writeBigUInt64LE(v); src = src.subarray(0, n); }
          } else src = Buffer.from(rd(ea(ins), n));
          if (k0 === OpKind.Register) {
            const r = ins.opRegister(0);
            if (isXmm(r)) {
              const b = (k1 === OpKind.Memory || (mn !== Mnemonic.Movss && mn !== Mnemonic.Movsd)) ? Buffer.alloc(16) : Buffer.from(getReg(r));
              src.copy(b, 0);
              setReg(r, b);
            } else { const b = Buffer.alloc(8); src.copy(b); setReg(r, b.readBigUInt64LE(0)); }
          } else wr(ea(ins), src);
          break;
        }
        case Mnemonic.Xorps: case Mnemonic.Pxor: {
          const a = Buffer.from(getReg(ins.opRegister(0)));
          const b = opKind(ins, 1) === OpKind.Register ? getReg(ins.opRegister(1)) : rd(ea(ins), 16);
          for (let i = 0; i < 16; i++) a[i] ^= b[i];
          setReg(ins.opRegister(0), a);
          break;
        }
        case Mnemonic.Pcmpeqb: case Mnemonic.Pand: case Mnemonic.Por: {
          const a = Buffer.from(getReg(ins.opRegister(0)));
          const b = opKind(ins, 1) === OpKind.Register ? getReg(ins.opRegister(1)) : rd(ea(ins), 16);
          for (let i = 0; i < 16; i++) a[i] = mn === Mnemonic.Pcmpeqb ? (a[i] === b[i] ? 0xff : 0) : mn === Mnemonic.Pand ? a[i] & b[i] : a[i] | b[i];
          setReg(ins.opRegister(0), a);
          break;
        }
        case Mnemonic.Pmovmskb: {
          const a = getReg(ins.opRegister(1));
          let m = 0;
          for (let i = 0; i < 16; i++) if (a[i] & 0x80) m |= 1 << i;
          setReg(ins.opRegister(0), BigInt(m));
          break;
        }
        case Mnemonic.Ucomiss: case Mnemonic.Comiss: {
          const a = getReg(ins.opRegister(0)).readFloatLE(0);
          const b = opKind(ins, 1) === OpKind.Register ? getReg(ins.opRegister(1)).readFloatLE(0) : rd(ea(ins), 4).readFloatLE(0);
          if (isNaN(a) || isNaN(b)) { flags.zf = 1; flags.pf = 1; flags.cf = 1; }
          else { flags.zf = a === b ? 1 : 0; flags.pf = 0; flags.cf = a < b ? 1 : 0; }
          flags.of = 0; flags.sf = 0;
          break;
        }
        case Mnemonic.Mulss: case Mnemonic.Addss: case Mnemonic.Subss: case Mnemonic.Divss: case Mnemonic.Maxss: case Mnemonic.Minss: {
          const ra = ins.opRegister(0);
          const a = Buffer.from(getReg(ra));
          const x = a.readFloatLE(0);
          const y = opKind(ins, 1) === OpKind.Register ? getReg(ins.opRegister(1)).readFloatLE(0) : rd(ea(ins), 4).readFloatLE(0);
          const r = mn === Mnemonic.Mulss ? x * y : mn === Mnemonic.Addss ? x + y : mn === Mnemonic.Subss ? x - y : mn === Mnemonic.Divss ? x / y : mn === Mnemonic.Maxss ? Math.max(x, y) : Math.min(x, y);
          a.writeFloatLE(r, 0);
          setReg(ra, a);
          break;
        }
        case Mnemonic.Cvtsi2ss: {
          const ra = ins.opRegister(0); const a = Buffer.from(getReg(ra));
          const v = BigInt.asIntN(opSize(ins, 1) * 8, readOp(ins, 1));
          a.writeFloatLE(Number(v), 0); setReg(ra, a); break;
        }
        case Mnemonic.Cvtss2sd: {
          const ra = ins.opRegister(0); const a = Buffer.from(getReg(ra));
          const y = opKind(ins, 1) === OpKind.Register ? getReg(ins.opRegister(1)).readFloatLE(0) : rd(ea(ins), 4).readFloatLE(0);
          a.writeDoubleLE(y, 0); setReg(ra, a); break;
        }
        case Mnemonic.Push: regs[Register.RSP] -= 8n; api.wrInt(regs[Register.RSP], 8, readOp(ins, 0)); break;
        case Mnemonic.Pop: writeOp(ins, 0, api.rdInt(regs[Register.RSP], 8)); regs[Register.RSP] += 8n; break;
        case Mnemonic.Ret:
          if (depth.length) { regs[Register.RSP] += 8n; jumped = depth.pop(); break; }
          return { ip, api, trace, ret: true };
        default:
          throw new Error("unsupported " + fmt.format(ins) + " at 0x" + ip.toString(16));
      }
      ip = jumped !== null ? jumped : next;
    }
    throw new Error("too many steps");
  }
  return { run, P, decodeAt, fmt };
};
