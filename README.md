# TruthTable

**Verify what a TapeOut circuit on X Layer really computes — before you trust it.**

TruthTable is a read-only verifier and indexer for [TapeOut](https://tapeout.net/) circuits on **X Layer (chain 196)**. It calls each circuit's own on-chain view functions — `eval()` for combinational logic, `step()` for state machines — on every input, then produces a truth table / state-transition table, a behaviour fingerprint, and a pass/fail proof against a specification.

No wallet. No signature. No gas. Everything runs in your browser against the public X Layer RPC.

- **Live app:** https://sid4436.github.io/truthtable/
- **Deep link example:** https://sid4436.github.io/truthtable/?c=0&id=2&spec=NAND2
- Built for **X Layer TapeOut Accelerate** (OKX Build X series), Nov–Dec 2026.

## Why

On TapeOut, a circuit is an NFT whose name and description are just claims. AI agents, dApps that gate value with circuits (risk gates, policy circuits), circuit buyers and PoD miners need to know what a circuit *actually* does before wiring it into anything that moves value. The chain already exposes the answer through free view calls — TruthTable packages it into one link.

| Who | What they get |
|---|---|
| AI agents / dApps using circuits as logic | Proof that circuit `#id` on processor `n` implements spec `S` on **every** input |
| Circuit buyers on TapeOut markets | Check before you buy: real function, gate count, duplicates |
| Circuit designers / processor creators | A shareable verification link proving the circuit matches its label |
| Judges, auditors, researchers | An index of every processor on X Layer with sampled circuits identified |

## Features (verified live on X Layer mainnet, 25 Nov 2026)

1. **Combinational truth tables** — `eval(id, input)` for all 2ⁿ inputs (n ≤ 8). Processor 0, circuit #1 → `00→0, 01→1, 10→1, 11→0` → **XOR2** (4 gates).
2. **Spec verification** — 25 reference functions (gates, adders, MUX, comparators, multipliers, popcount, parity) or a custom output table. Processor 0 #2 vs `NAND2` → ✓ all 4 inputs; vs `AND2` → ✗ differs on 4/4.
3. **Sequential simulation** — `step(id, state, input) → (next, output)` for every (state, input) pair; reconstructs the state machine and its cycle from reset. Processor 0 #4 (2 latches, 10 gates) → **mod-3 counter**, output pulses every 3 steps. (`eval` on it reverts with `has latch: use step`.)
4. **Processor index** — every processor registered in the X Layer factory with name, circuit count and up to 3 sampled circuits identified; built by a polite, resumable crawler and published as `data/index.json`.
5. **Fingerprints** — SHA-256 of the behaviour, so identical functions are recognisable across processors regardless of their names.

## Quick start

```bash
# web: serve the folder with any static server
python3 -m http.server 8080          # then open http://localhost:8080

# CLI (Node >= 18, zero dependencies)
node cli/truthtable.js factory
node cli/truthtable.js truth 0 1          # XOR truth table from on-chain eval()
node cli/truthtable.js verify 0 2 NAND2   # ok: true
node cli/truthtable.js sim 0 4            # state machine via step()
node cli/build-index.js                   # rebuild data/index.json (slow and polite)
npm test                                  # offline unit tests + a few live reads
```

RPC defaults to `https://rpc.xlayer.tech` (official, CORS-enabled). Override with `XLAYER_RPC=…` (CLI) or `?rpc=…` (web).

## Architecture

```
browser / CLI ──eth_call──► X Layer RPC ──► TapeOut factory 0x1f09…0761  (cpuCount, cpuAt)
                                        └─► processor (ERC-721 circuits)  (circuitInfo, eval, step, ownerOf)

lib/tapeout.js        universal ES module: ABI encode/decode, rate-limit-aware client,
                      truthTable(), simulate(), verify(), SPECS reference library
index.html + app.js   static UI (GitHub Pages), deep links ?c=&id=&spec=
cli/                  CLI + processor index crawler
data/index.json       index snapshot
test/                 offline tests (mock RPC) + live read-only tests
```

The client sends one request at a time with a minimum gap, backs off on transient network errors, and **stops entirely on HTTP 429 / rate-limit errors** — it never switches endpoints to evade limits.

## TapeOut integration

- **Contracts on X Layer:** factory `0x1f09daefa827f02cbb40967cc91b259763760761`; processor 0 ("OnlyTestXLayer") `0x839bdd6fa7a66416a609a735e11de5411b98574e`; every processor returned by `cpuAt(0 … cpuCount-1)`.
- **On-chain data used:** `cpuCount`, `cpuAt`, `name`, `nextId`, `circuitInfo`, `eval`, `step`, `ownerOf`.
- Naming follows the official TapeKit spec (processor number + `#ID`).
- All addresses and selectors: [`notes/onchain-notes.md`](notes/onchain-notes.md). Event rules: [`notes/official-rules.md`](notes/official-rules.md).

## Business model

- **Free:** web app, single verifications, public index — drives adoption.
- **Agent API (pay-per-call via x402 on X Layer, USDT/USDC):** batch verification, signed verification certificates an agent can cache, "cheapest circuit implementing spec S" search across all processors, webhooks when a new circuit matches a spec.
- **Creator verification badge:** processor creators pay a small fee for a verified listing and an embeddable badge linking to the live proof.
- **B2B audits:** behaviour audits for projects that gate value with TapeOut circuits (risk gates, policy circuits, games).

Why users keep paying: every new circuit is something new to check, agents need verification per integration, and certificates must be refreshed because processor code is upgradeable.

## Honest limitations

- **No official ABI documentation** for the X Layer processor contracts was found. Selectors were derived from live implementation bytecode; the `circuitInfo` word order `[inputs, outputs, latches, gates]` and the `step` argument/return order were inferred from live behaviour (XOR, NAND, a mod-3 counter) and are covered by tests. Input packing (pin *i* = bit *i*) matches community documentation; byte order above 8 pins is inferred.
- Truth tables are capped (≤ 8 inputs; ≤ 6 state+input bits for state machines) to stay polite to public RPCs.
- The X Layer factory is an **upgradeable proxy** (owner-controlled; TapeOut states upgrade rights sit with a 3/5 multisig). Results describe the code live at read time.
- The index is a **snapshot**; counts change as new circuits are taped out.

## Roadmap

1. Local netlist simulation (`netlist()` read) for circuits above the RPC cap, cross-checked against on-chain `eval` samples.
2. x402 agent endpoint + signed certificates.
3. DeWEB (TapeKit) mirror so the app itself lives on-chain.
4. Watcher for new circuits matching saved specs.

## License

MIT — see [LICENSE](LICENSE). Not affiliated with OKX, X Layer or TapeOut. Built with AI assistance; every result shown comes from live on-chain reads.
