#!/usr/bin/env node
// Build data/index.json: every processor registered in the X Layer TapeOut factory, plus a sample of
// circuits per processor identified by their on-chain behaviour. Read-only (eth_call), sequential,
// polite (one request at a time, min gap between requests), stops on the first rate-limit signal.
// Resumable: re-running skips processors already in the index.
//   node cli/build-index.js [--sample 3] [--gap 60]
import { readFile, writeFile } from 'node:fs/promises';
import { makeClient, RateLimited } from '../lib/tapeout.js';

const arg = (k, d) => { const i = process.argv.indexOf(k); return i > 0 ? Number(process.argv[i + 1]) : d; };
const SAMPLE = arg('--sample', 3); const GAP = arg('--gap', 60);
const OUT = new URL('../data/index.json', import.meta.url);
const T = makeClient({ rpc: process.env.XLAYER_RPC || undefined, minGapMs: GAP });

let idx; try { idx = JSON.parse(await readFile(OUT, 'utf8')); } catch { idx = { cpus: [] }; }
const have = new Set(idx.cpus.map((c) => c.index));
const save = async () => { idx.updatedAt = new Date().toISOString(); await writeFile(OUT, JSON.stringify(idx, null, 1)); };

try {
  const f = await T.factoryInfo(); Object.assign(idx, { chainId: f.chainId, factory: f.factory, cpuCount: f.cpuCount, rpc: T.rpc });
  for (let i = 0; i < f.cpuCount; i++) {
    if (have.has(i)) continue;
    const cpu = await T.cpuAt(i); const info = await T.cpuInfo(cpu);
    const entry = { index: i, ...info, sample: [] };
    for (let id = 1; id <= Math.min(SAMPLE, info.circuits); id++) {
      try {
        const c = await T.circuitInfo(cpu, id); const s = { ...c };
        if (c.latches === 0 && c.inputs <= 3) { const tt = await T.truthTable(cpu, id, { maxInputs: 3 }); Object.assign(s, { table: tt.table, fingerprint: tt.fingerprint, match: tt.match }); }
        else if (c.latches > 0 && c.latches + c.inputs <= 3) { const sm = await T.simulate(cpu, id, { maxBits: 3 }); Object.assign(s, { period: sm.period, fingerprint: sm.fingerprint, match: sm.match }); }
        entry.sample.push(s);
      } catch (e) { if (e instanceof RateLimited) throw e; entry.sample.push({ id, error: e.message.slice(0, 80) }); }
    }
    idx.cpus.push(entry);
    if (i % 10 === 0) { await save(); console.log(`cpu ${i}/${f.cpuCount} ${info.name} circuits=${info.circuits}`); }
  }
  idx.complete = idx.cpus.length >= idx.cpuCount;
} catch (e) {
  idx.stoppedReason = e.message; console.error('STOP:', e.message);
} finally {
  idx.cpus.sort((a, b) => a.index - b.index);
  const all = idx.cpus;
  idx.summary = {
    processors: all.length, withCircuits: all.filter((c) => c.circuits > 0).length,
    totalCircuits: all.reduce((s, c) => s + c.circuits, 0),
    sampled: all.reduce((s, c) => s + c.sample.length, 0),
    identified: all.reduce((s, c) => s + c.sample.filter((x) => x.match && x.match.length).length, 0),
  };
  await save(); console.log('summary', idx.summary);
}
