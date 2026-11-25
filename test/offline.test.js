// Offline unit tests (no network): encoding, identification, fingerprint, step() decoding.
import assert from 'node:assert/strict';
import { packBits, unpackBits, identify, identifySeq, fingerprint, SPECS, makeClient } from '../lib/tapeout.js';

assert.deepEqual([...packBits(0b10, 2)], [2]);
assert.deepEqual([...packBits(0x1ff, 9)], [0xff, 1]);
assert.equal(unpackBits(new Uint8Array([0xff, 1])), 0x1ffn);
const tt = (s) => Array.from({ length: 2 ** SPECS[s].i }, (_, x) => SPECS[s].f(x));
for (const s of Object.keys(SPECS)) assert.ok(identify({ inputs: SPECS[s].i, outputs: SPECS[s].o }, tt(s)).includes(s), s);
assert.deepEqual(identify({ inputs: 2, outputs: 1 }, [0, 1, 1, 0]), ['XOR2']);
assert.deepEqual(identify({ inputs: 0, outputs: 1 }, [1]), ['CONST_1']);
assert.equal((await fingerprint({ inputs: 2, outputs: 1, latches: 0 }, [0, 1, 1, 0])).length, 16);
assert.deepEqual(identifySeq({ inputs: 0 }, null, [{ out: 1 }, { out: 0 }, { out: 0 }], 0, [1, 0, 0]), ['COUNTER_MOD3', 'PULSE_EVERY_3']);

// Mock RPC: a fake XOR circuit and a fake mod-3 counter, to test ABI encode/decode end to end.
const W = (n) => BigInt(n).toString(16).padStart(64, '0');
const bytesRet = (...bs) => { let head = '', tail = ''; let off = 32 * bs.length;
  for (const b of bs) { head += W(off); const t = W(b.length) + b.map((x) => x.toString(16).padStart(2, '0')).join('').padEnd(64, '0'); tail += t; off += t.length / 2; } return '0x' + head + tail; };
const fetchImpl = async (_u, { body }) => {
  const { params: [{ data }] } = JSON.parse(body); const sel = data.slice(0, 10); const id = Number(BigInt('0x' + data.slice(10, 74)));
  const rd = (slot) => { const off = Number(BigInt('0x' + data.slice(10 + slot * 64, 74 + slot * 64))) * 2; const len = Number(BigInt('0x' + data.slice(10 + off, 74 + off))); return parseInt(data.slice(74 + off, 74 + off + Math.max(2, len * 2)) || '0', 16); };
  let result;
  if (sel === '0x084d60f1') result = '0x' + (id === 1 ? [2, 1, 0, 4] : [0, 1, 2, 10]).map(W).join('');
  else if (sel === '0x934d06ea') { const x = rd(1); result = bytesRet([(x & 1) ^ (x >> 1)]); }
  else if (sel === '0xe8281a1a') { const s = rd(1); result = bytesRet([(s + 1) % 3], [s === 0 ? 1 : 0]); }
  else throw new Error('unexpected selector ' + sel);
  return { status: 200, json: async () => ({ jsonrpc: '2.0', id: 1, result }) };
};
const M = makeClient({ rpc: 'mock', minGapMs: 0, fetchImpl });
const r1 = await M.truthTable('0xmock', 1); assert.deepEqual(r1.table, [0, 1, 1, 0]); assert.deepEqual(r1.match, ['XOR2']);
assert.equal((await M.verify('0xmock', 1, 'XOR2')).ok, true);
assert.equal((await M.verify('0xmock', 1, 'AND2')).ok, false);
const r2 = await M.simulate('0xmock', 2); assert.equal(r2.period, 3); assert.deepEqual(r2.trace.map((t) => t.out), [1, 0, 0]);

// 429 handling: client must stop and refuse further calls.
const R = makeClient({ rpc: 'mock', minGapMs: 0, fetchImpl: async () => ({ status: 429, json: async () => ({}) }) });
await assert.rejects(R.circuitInfo('0x', 1), /429/); await assert.rejects(R.circuitInfo('0x', 1), /429/);
console.log('offline tests: all passed');
