#!/usr/bin/env node
// TruthTable CLI (read-only; eth_call only).
//   node cli/truthtable.js factory
//   node cli/truthtable.js cpu <cpuIndex>
//   node cli/truthtable.js circuits <cpuIndex> [max]
//   node cli/truthtable.js truth <cpuIndex> <id>
//   node cli/truthtable.js verify <cpuIndex> <id> <SPEC>
//   node cli/truthtable.js sim <cpuIndex> <id>
//   node cli/truthtable.js specs
// Env: XLAYER_RPC (default https://rpc.xlayer.tech)
import { makeClient, SPECS } from '../lib/tapeout.js';

const T = makeClient({ rpc: process.env.XLAYER_RPC || undefined });
const [cmd, a, b, c] = process.argv.slice(2);
const out = (o) => console.log(JSON.stringify(o, (k, v) => (typeof v === 'bigint' ? v.toString() : v), 2));
try {
  if (cmd === 'factory') out(await T.factoryInfo());
  else if (cmd === 'cpu') out({ index: +a, ...(await T.cpuDetails(await T.cpuAt(+a))) });
  else if (cmd === 'circuits') {
    const cpu = await T.cpuAt(+a); const info = await T.cpuInfo(cpu); const max = Math.min(info.circuits, +(b || 10));
    const list = []; for (let id = 1; id <= max; id++) list.push(await T.circuitInfo(cpu, id));
    out({ index: +a, ...info, list });
  } else if (cmd === 'truth') out(await T.truthTable(await T.cpuAt(+a), +b));
  else if (cmd === 'verify') out(await T.verify(await T.cpuAt(+a), +b, c));
  else if (cmd === 'sim') out(await T.simulate(await T.cpuAt(+a), +b));
  else if (cmd === 'specs') out(Object.fromEntries(Object.entries(SPECS).map(([k, s]) => [k, { inputs: s.i, outputs: s.o }])));
  else { console.error('commands: factory | cpu | circuits | truth | verify | sim | specs'); process.exit(1); }
} catch (e) { console.error('ERROR:', e.message); process.exit(2); }
