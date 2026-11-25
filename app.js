import { makeClient, SPECS } from './lib/tapeout.js';

const $ = (id) => document.getElementById(id);
const params = new URLSearchParams(location.search);
const T = makeClient({ rpc: params.get('rpc') || undefined, minGapMs: 30 });
const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const bin = (v, n) => (n ? Number(v).toString(2).padStart(n, '0') : '–');
const cpuCache = new Map();
async function cpuAddr(i) { if (!cpuCache.has(i)) cpuCache.set(i, await T.cpuAt(i)); return cpuCache.get(i); }

$('spec').innerHTML = '<option value="">identify only</option>' + Object.entries(SPECS).map(([k, s]) => `<option value="${k}">${k} (${s.i}→${s.o})</option>`).join('');
T.factoryInfo().then((f) => { $('fac').textContent = `Live: factory ${f.factory.slice(0, 10)}… · ${f.cpuCount} processors registered on X Layer (chain ${f.chainId})`; })
  .catch((e) => { $('fac').innerHTML = `<span class="bad">RPC error: ${esc(e.message)}</span> — try <code>?rpc=https://xlayer.drpc.org</code>`; });

async function run() {
  const c = +$('cpu').value, i = +$('cid').value, s = $('spec').value;
  history.replaceState(null, '', `?c=${c}&id=${i}${s ? '&spec=' + s : ''}`);
  $('res').hidden = false; const out = $('out');
  try {
    out.innerHTML = '<p class="mut">reading circuitInfo…</p>';
    const cpu = await cpuAddr(c); const info = await T.circuitInfo(cpu, i);
    const owner = await T.ownerOf(cpu, i).catch(() => null);
    let h = `<p>Processor #${c} <code>${cpu}</code> · circuit #${i}${owner ? ` · held by <code>${owner.slice(0, 10)}…</code>` : ''}<br>` +
      `<span class="pill">${info.inputs} in</span><span class="pill">${info.outputs} out</span><span class="pill">${info.latches} latches</span><span class="pill">${info.gates} gates</span></p>`;
    if (info.latches === 0) {
      out.innerHTML = h + '<p class="mut">evaluating every input on-chain…</p>';
      const tt = await T.truthTable(cpu, i, { onRow: (x) => { out.querySelector('.mut:last-child').textContent = `eval row ${x + 1} / ${2 ** info.inputs}`; } });
      if (!tt.table) { out.innerHTML = h + `<p class="mut">${esc(tt.note)}</p>`; return; }
      h += `<p>Fingerprint <code>${tt.fingerprint}</code> · identified as <b>${tt.match.join(', ') || 'not in library'}</b></p>`;
      if (s) {
        const sp = SPECS[s]; const shape = sp.i === tt.inputs && sp.o === tt.outputs;
        const mism = shape ? tt.table.map((r, x) => (r === sp.f(x) ? null : x)).filter((v) => v !== null) : null;
        h += shape && !mism.length ? `<p class="ok"><b>✓ ${s}: matches on all ${tt.table.length} inputs</b> — proven from on-chain eval()</p>`
          : `<p class="bad"><b>✗ ${s}: no match</b> — ${shape ? `differs on ${mism.length} of ${tt.table.length} inputs (${mism.slice(0, 8).map((x) => bin(x, tt.inputs)).join(', ')})` : `shape ${tt.inputs}→${tt.outputs} vs spec ${sp.i}→${sp.o}`}</p>`;
      }
      h += '<div class="scroll"><table><tr><th>input (pin n…0)</th><th>output</th>' + (s ? `<th>${s}</th>` : '') + '</tr>' +
        tt.table.map((o, x) => `<tr><td>${bin(x, tt.inputs)}</td><td>${bin(o, tt.outputs)}</td>${s ? `<td class="${SPECS[s].f(x) === o ? 'ok' : 'bad'}">${bin(SPECS[s].f(x), SPECS[s].o)}</td>` : ''}</tr>`).join('') + '</table></div>';
    } else {
      out.innerHTML = h + '<p class="mut">stepping every (state, input) on-chain…</p>';
      const sm = await T.simulate(cpu, i);
      if (!sm.table) { out.innerHTML = h + `<p class="mut">${esc(sm.note)}</p>`; return; }
      h += `<p>Sequential circuit · fingerprint <code>${sm.fingerprint}</code> · from reset (state 0, input 0): cycle of length <b>${sm.period}</b>` +
        `${sm.cycleStart ? ` after ${sm.cycleStart} steps` : ''}${sm.match.length ? ` · behaves as <b>${sm.match.join(', ')}</b>` : ''}</p>` +
        `<p class="mut">Output sequence from reset: <code>${sm.trace.map((t) => t.out).join(' ')}</code> …</p>`;
      const X = 2 ** sm.inputs;
      h += '<div class="scroll"><table><tr><th>state</th>' + Array.from({ length: X }, (_, x) => `<th>in ${bin(x, sm.inputs) || '·'} → next / out</th>`).join('') + '</tr>' +
        sm.table.map((row, st) => `<tr><td>${bin(st, sm.latches)}</td>${row.map(([n, o]) => `<td>${bin(n, sm.latches)} / ${bin(o, sm.outputs)}</td>`).join('')}</tr>`).join('') + '</table></div>';
    }
    out.innerHTML = h;
  } catch (e) {
    out.innerHTML = `<p class="bad">${esc(e.message)}</p><p class="mut">Circuit may not exist on this processor, or the public RPC is busy.</p>`;
  }
}
$('go').onclick = run;
document.querySelectorAll('[data-c]').forEach((b) => (b.onclick = () => { const [c, i, s] = b.dataset.c.split('/'); $('cpu').value = c; $('cid').value = i; $('spec').value = s; run(); }));
if (params.get('c')) { $('cpu').value = params.get('c'); $('cid').value = params.get('id') || 1; $('spec').value = params.get('spec') || ''; run(); }

// Processor index (pre-built by cli/build-index.js, published as data/index.json)
let IDX = null;
function renderList() {
  if (!IDX) return; const q = $('q').value.toLowerCase(); const ne = $('nonempty').checked;
  const rows = IDX.cpus.filter((c) => (!ne || c.circuits > 0) && (!q || (c.name || '').toLowerCase().includes(q) || c.cpu.includes(q))).slice(0, 300);
  $('list').innerHTML = '<tr><th>#</th><th>name</th><th>circuits</th><th>sampled functions</th></tr>' + rows.map((c) =>
    `<tr data-i="${c.index}"><td>${c.index}</td><td>${esc(c.name || '(unnamed)')}</td><td>${c.circuits}</td><td>${c.sample.map((s) => s.match && s.match.length ? `<span class="pill">#${s.id} ${esc(s.match[0])}</span>` : s.error ? '' : `<span class="pill mut">#${s.id} ${s.inputs}→${s.outputs}${s.latches ? ' seq' : ''}</span>`).join('')}</td></tr>`).join('');
  $('list').querySelectorAll('tr[data-i]').forEach((tr) => (tr.onclick = () => { $('cpu').value = tr.dataset.i; $('cid').value = 1; $('spec').value = ''; scrollTo({ top: 0, behavior: 'smooth' }); run(); }));
}
fetch('data/index.json').then((r) => r.json()).then((j) => {
  IDX = j; const s = j.summary || {};
  $('idxmeta').textContent = `· ${s.processors} processors, ${s.withCircuits} with circuits, ${s.totalCircuits} circuits total, ${s.identified} sampled circuits identified · snapshot ${String(j.updatedAt).slice(0, 16).replace('T', ' ')} UTC`;
  renderList();
}).catch(() => { $('idxmeta').textContent = '· index not available'; });
$('q').oninput = renderList; $('nonempty').onchange = renderList;
