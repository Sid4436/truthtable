// Live read-only test against X Layer mainnet (a handful of eth_calls).
import assert from 'node:assert/strict';
import { makeClient } from '../lib/tapeout.js';
const T = makeClient({ rpc: process.env.XLAYER_RPC || undefined, minGapMs: 80 });
const f = await T.factoryInfo(); assert.ok(f.cpuCount >= 450);
const cpu = await T.cpuAt(0); assert.equal(cpu, '0x839bdd6fa7a66416a609a735e11de5411b98574e');
assert.deepEqual((await T.truthTable(cpu, 1)).match, ['XOR2']);
assert.equal((await T.verify(cpu, 2, 'NAND2')).ok, true);
const sm = await T.simulate(cpu, 4); assert.equal(sm.period, 3);
console.log('live tests: all passed (cpuCount', f.cpuCount + ')');
