// TruthTable core — read-only verifier for TapeOut circuits on X Layer (chain 196).
// Universal ES module: runs in the browser and in Node >= 18. Zero dependencies.
// Uses only eth_call (free view calls): no wallet, no signing, no transactions.
// Selectors were derived from the live X Layer implementation bytecode (see notes/onchain-notes.md).

export const CHAIN_ID = 196;
export const DEFAULT_RPC = 'https://rpc.xlayer.tech';
export const FACTORY = '0x1f09daefa827f02cbb40967cc91b259763760761';

const SEL = {
  cpuCount: '0xa94da8a7', cpuAt: '0x4bc7cbbd', deployFee: '0xeb2a5d2c', protocolFee: '0xb0e21e8a',
  name: '0x06fdde03', nextId: '0x61b8ce8c', circuitInfo: '0x084d60f1', eval: '0x934d06ea',
  step: '0xe8281a1a', ownerOf: '0x6352211e', tapeoutFee: '0xadfb2b69', transistors: '0x6fbd1719',
};

export class RateLimited extends Error {}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const u256 = (n) => BigInt(n).toString(16).padStart(64, '0');
const word = (hex, i) => BigInt('0x' + (hex.slice(2 + i * 64, 2 + (i + 1) * 64) || '0'));
const addrAt = (hex, i) => '0x' + hex.slice(2 + i * 64 + 24, 2 + (i + 1) * 64);
const hexToBytes = (h) => { const b = new Uint8Array(h.length / 2); for (let i = 0; i < b.length; i++) b[i] = parseInt(h.substr(i * 2, 2), 16); return b; };
const bytesToHex = (b) => Array.from(b, (x) => x.toString(16).padStart(2, '0')).join('');

/** Dynamic `bytes` at ABI head slot `slot` of a return value. */
function decBytesAt(hex, slot = 0) {
  const off = Number(word(hex, slot)) * 2;
  const len = Number(BigInt('0x' + hex.slice(2 + off, 2 + off + 64)));
  return hexToBytes(hex.slice(2 + off + 64, 2 + off + 64 + len * 2));
}
function decString(hex) { return new TextDecoder().decode(decBytesAt(hex, 0)); }
/** ABI-encode a `bytes` tail (length word + right-padded data). */
const encBytes = (b) => u256(b.length) + bytesToHex(b).padEnd(Math.max(64, Math.ceil(b.length / 32) * 64), '0');

/** Pin i -> bit i, little-endian bytes (pin 0 = bit 0 of byte 0). Confirmed for <= 8 pins; byte order above 8 pins is inferred. */
export function packBits(x, nBits) {
  const n = Math.max(1, Math.ceil(nBits / 8)); const b = new Uint8Array(n);
  for (let i = 0; i < n; i++) b[i] = Number((BigInt(x) >> BigInt(8 * i)) & 0xffn);
  return b;
}
export function unpackBits(b) { let v = 0n; for (let i = b.length - 1; i >= 0; i--) v = (v << 8n) | BigInt(b[i]); return v; }

export function makeClient({ rpc = DEFAULT_RPC, minGapMs = 40, fetchImpl = globalThis.fetch } = {}) {
  let id = 0; let last = 0; let stopped = null;
  async function ethCall(to, data) {
    if (stopped) throw stopped;
    const wait = last + minGapMs - Date.now(); if (wait > 0) await sleep(wait); last = Date.now();
    for (let a = 0; ; a++) {
      let res;
      try {
        res = await fetchImpl(rpc, { method: 'POST', headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ jsonrpc: '2.0', id: ++id, method: 'eth_call', params: [{ to, data }, 'latest'] }) });
      } catch (e) { if (a < 2) { await sleep(1500 * (a + 1)); continue; } throw e; } // transient network error: back off, max 2 retries
      if (res.status === 429) { stopped = new RateLimited('RPC rate limited (HTTP 429) - stopping, no retry'); throw stopped; }
      const j = await res.json();
      if (j.error) {
        if (/rate|limit|too many/i.test(j.error.message || '')) { stopped = new RateLimited('RPC rate limited: ' + j.error.message); throw stopped; }
        if (a < 1 && /timeout|busy/i.test(j.error.message || '')) { await sleep(600); continue; }
        const e = new Error(j.error.message || 'eth_call error'); e.revert = true; throw e;
      }
      return j.result;
    }
  }

  const api = {
    rpc, ethCall,
    async factoryInfo() {
      const cnt = await ethCall(FACTORY, SEL.cpuCount);
      const dep = await ethCall(FACTORY, SEL.deployFee).catch(() => null);
      const prot = await ethCall(FACTORY, SEL.protocolFee).catch(() => null);
      return { chainId: CHAIN_ID, factory: FACTORY, cpuCount: Number(word(cnt, 0)),
        deployFeeWei: dep && word(dep, 0).toString(), protocolFeeWei: prot && word(prot, 0).toString() };
    },
    async cpuAt(i) { return addrAt(await ethCall(FACTORY, SEL.cpuAt + u256(i)), 0); },
    /** cpu = processor (ERC-721 circuits) contract returned by factory.cpuAt(i) */
    async cpuInfo(cpu) {
      const name = await ethCall(cpu, SEL.name).then(decString).catch(() => '');
      const next = await ethCall(cpu, SEL.nextId).then((h) => Number(word(h, 0))).catch(() => 1);
      return { cpu, name, nextId: next, circuits: Math.max(0, next - 1) };
    },
    async cpuDetails(cpu) {
      const base = await api.cpuInfo(cpu);
      const fee = await ethCall(cpu, SEL.tapeoutFee).then((h) => word(h, 0).toString()).catch(() => null);
      const tr = await ethCall(cpu, SEL.transistors).then((h) => addrAt(h, 0)).catch(() => null);
      return { ...base, tapeoutFeeWei: fee, transistors: tr };
    },
    /** circuitInfo(id) -> [inputs, outputs, latches, gates]. Interpretation inferred from live behaviour (see notes). */
    async circuitInfo(cpu, id) {
      const h = await ethCall(cpu, SEL.circuitInfo + u256(id));
      const w = [0, 1, 2, 3].map((i) => Number(word(h, i)));
      return { id, inputs: w[0], outputs: w[1], latches: w[2], gates: w[3] };
    },
    async ownerOf(cpu, id) { return addrAt(await ethCall(cpu, SEL.ownerOf + u256(id)), 0); },
    /** Combinational evaluation: eval(id, inputBytes) -> outputBytes (view). Reverts "has latch: use step" for sequential circuits. */
    async evalCircuit(cpu, id, x, nInputs) {
      const data = SEL.eval + u256(id) + u256(64) + encBytes(packBits(x, nInputs));
      return unpackBits(decBytesAt(await ethCall(cpu, data), 0));
    },
    /** Sequential step: step(id, state, input) -> (nextState, output) (view). Arg/return order confirmed on a mod-3 counter. */
    async stepCircuit(cpu, id, state, nLatches, x, nInputs) {
      const s = encBytes(packBits(state, nLatches)); const inp = encBytes(packBits(x, nInputs));
      const data = SEL.step + u256(id) + u256(96) + u256(96 + s.length / 2) + s + inp;
      const r = await ethCall(cpu, data);
      return { next: unpackBits(decBytesAt(r, 0)), out: unpackBits(decBytesAt(r, 1)) };
    },
    /** Full truth table via on-chain eval for every input (combinational, <= maxInputs). */
    async truthTable(cpu, id, { maxInputs = 8, onRow } = {}) {
      const info = await api.circuitInfo(cpu, id);
      if (info.latches > 0) return { ...info, kind: 'sequential', table: null, note: 'sequential circuit - use simulate()' };
      if (info.inputs > maxInputs) return { ...info, kind: 'combinational', table: null, note: `inputs ${info.inputs} > cap ${maxInputs}` };
      const rows = [];
      for (let x = 0; x < 2 ** info.inputs; x++) { rows.push(Number(await api.evalCircuit(cpu, id, x, info.inputs))); onRow && onRow(x, rows[x]); }
      return { ...info, kind: 'combinational', table: rows, fingerprint: await fingerprint(info, rows), match: identify(info, rows) };
    },
    /** Explore the full state machine of a sequential circuit: for every (state, input) -> (next, out).
     *  Capped at latches+inputs <= maxBits. Also runs the trajectory from reset state 0 with input 0 to find its cycle. */
    async simulate(cpu, id, { maxBits = 6 } = {}) {
      const info = await api.circuitInfo(cpu, id);
      if (info.latches === 0) return { ...info, kind: 'combinational', note: 'no latches - use truthTable()' };
      if (info.latches + info.inputs > maxBits) return { ...info, kind: 'sequential', table: null, note: `latches+inputs ${info.latches + info.inputs} > cap ${maxBits}` };
      const S = 2 ** info.latches, X = 2 ** info.inputs; const table = [];
      for (let s = 0; s < S; s++) { const row = []; for (let x = 0; x < X; x++) { const r = await api.stepCircuit(cpu, id, s, info.latches, x, info.inputs); row.push([Number(r.next), Number(r.out)]); } table.push(row); }
      // trajectory from reset (state 0, input 0), computed locally from the on-chain table
      const seen = new Map(); const trace = []; let s = 0;
      while (!seen.has(s)) { seen.set(s, trace.length); const [n, o] = table[s][0]; trace.push({ state: s, out: o }); s = n; }
      const cycleStart = seen.get(s);
      const outs = trace.map((t) => t.out);
      return { ...info, kind: 'sequential', table, trace, cycleStart, period: trace.length - cycleStart,
        fingerprint: await fingerprint(info, table.flat().map((p) => p.join(':'))), match: identifySeq(info, table, trace, cycleStart, outs) };
    },
    /** Verify a combinational circuit against a named spec or an explicit array of outputs. */
    async verify(cpu, id, spec) {
      const tt = await api.truthTable(cpu, id);
      if (!tt.table) return { ok: false, reason: tt.note, info: tt };
      const ref = Array.isArray(spec) ? spec.map(Number) : SPECS[spec] ? tt.table.map((_, x) => SPECS[spec].f(x)) : null;
      if (!ref) return { ok: false, reason: `unknown spec ${spec}` };
      const shapeOk = Array.isArray(spec) || (SPECS[spec].i === tt.inputs && SPECS[spec].o === tt.outputs);
      const mismatches = tt.table.map((r, x) => (r === ref[x] ? null : { x, got: r, want: ref[x] })).filter(Boolean);
      return { ok: shapeOk && mismatches.length === 0 && ref.length === tt.table.length, spec: Array.isArray(spec) ? 'custom' : spec,
        mismatches, fingerprint: tt.fingerprint, inputs: tt.inputs, outputs: tt.outputs, gates: tt.gates, table: tt.table };
    },
  };
  return api;
}

export async function fingerprint(info, rows) {
  const msg = new TextEncoder().encode(`${info.inputs}:${info.outputs}:${info.latches}:${rows.join(',')}`);
  const d = new Uint8Array(await globalThis.crypto.subtle.digest('SHA-256', msg));
  return bytesToHex(d).slice(0, 16);
}

/** Reference library. f(x) returns the packed output word for packed input x (pin i = bit i). */
export const SPECS = {
  BUF: { i: 1, o: 1, f: (x) => x & 1 },
  NOT: { i: 1, o: 1, f: (x) => (~x) & 1 },
  AND2: { i: 2, o: 1, f: (x) => (x & 1) & (x >> 1) },
  OR2: { i: 2, o: 1, f: (x) => ((x & 1) | (x >> 1)) & 1 },
  NAND2: { i: 2, o: 1, f: (x) => 1 - ((x & 1) & (x >> 1)) },
  NOR2: { i: 2, o: 1, f: (x) => 1 - (((x & 1) | (x >> 1)) & 1) },
  XOR2: { i: 2, o: 1, f: (x) => (x & 1) ^ ((x >> 1) & 1) },
  XNOR2: { i: 2, o: 1, f: (x) => 1 - ((x & 1) ^ ((x >> 1) & 1)) },
  HALF_ADDER: { i: 2, o: 2, f: (x) => { const a = x & 1, b = (x >> 1) & 1; return (a ^ b) | ((a & b) << 1); } },
  AND3: { i: 3, o: 1, f: (x) => (x === 7 ? 1 : 0) },
  OR3: { i: 3, o: 1, f: (x) => (x ? 1 : 0) },
  XOR3: { i: 3, o: 1, f: (x) => ((x & 1) ^ ((x >> 1) & 1) ^ ((x >> 2) & 1)) },
  FULL_ADDER: { i: 3, o: 2, f: (x) => (x & 1) + ((x >> 1) & 1) + ((x >> 2) & 1) },
  MUX2: { i: 3, o: 1, f: (x) => (((x >> 2) & 1) ? (x >> 1) & 1 : x & 1) },
  MAJ3: { i: 3, o: 1, f: (x) => (((x & 1) + ((x >> 1) & 1) + ((x >> 2) & 1)) >= 2 ? 1 : 0) },
  ADD2x2: { i: 4, o: 3, f: (x) => (x & 3) + ((x >> 2) & 3) },
  MUL2x2: { i: 4, o: 4, f: (x) => (x & 3) * ((x >> 2) & 3) },
  EQ2: { i: 4, o: 1, f: (x) => ((x & 3) === ((x >> 2) & 3) ? 1 : 0) },
  DEC2TO4: { i: 2, o: 4, f: (x) => 1 << (x & 3) },
  ADD4x4: { i: 8, o: 5, f: (x) => (x & 15) + ((x >> 4) & 15) },
  MUL4x4: { i: 8, o: 8, f: (x) => (x & 15) * ((x >> 4) & 15) },
  GT4: { i: 8, o: 1, f: (x) => ((x & 15) > ((x >> 4) & 15) ? 1 : 0) },
  EQ4: { i: 8, o: 1, f: (x) => ((x & 15) === ((x >> 4) & 15) ? 1 : 0) },
  POPCOUNT8: { i: 8, o: 4, f: (x) => { let c = 0; for (let k = 0; k < 8; k++) c += (x >> k) & 1; return c; } },
  PARITY8: { i: 8, o: 1, f: (x) => { let c = 0; for (let k = 0; k < 8; k++) c ^= (x >> k) & 1; return c; } },
};

export function identify(info, rows) {
  const names = Object.entries(SPECS).filter(([, s]) => s.i === info.inputs && s.o === info.outputs && rows.every((r, x) => s.f(x) === r)).map(([k]) => k);
  if (!names.length && rows.every((r) => r === rows[0])) names.push(`CONST_${rows[0]}`);
  return names;
}

/** Light classification of sequential behaviour from the on-chain transition table. */
export function identifySeq(info, table, trace, cycleStart, outs) {
  const tags = [];
  if (info.inputs === 0) {
    const period = trace.length - cycleStart;
    if (cycleStart === 0 && period > 1) tags.push(`COUNTER_MOD${period}`);
    const cyc = outs.slice(cycleStart);
    if (cyc.filter((o) => o).length === 1 && period > 1) tags.push(`PULSE_EVERY_${period}`);
  }
  return tags;
}
