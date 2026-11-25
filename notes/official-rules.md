# X Layer TapeOut Accelerate — official rules (read 25 Nov 2026 ~21:56 WIB)

Primary source: **https://web3.okx.com/xlayer/build-x-series** (official OKX / X Layer event page, text fetched 2026-11-25 14:56 UTC).
Secondary (non-official, used only for the submission-form hint): https://opengrants.io/guides/crypto-grants/ , https://grants.watch/programs/x-layer-tapeout-accelerate

## Key facts
| Item | Official text (summary) |
|---|---|
| Organizer | X Layer; prize pool sponsored by the TapeOut community |
| Prize pool | **100,000 USDT** — 1st 20,000 (1 winner), 2nd 10,000 each (5 winners), 3rd 6,000 each (5 winners) = 11 winners; pool "may continue to grow" |
| Deadline | Submit through the submission form **before 7 Dec 2026 23:59 UTC (= Tue 8 Dec 2026 06:59 WIB)** — marked **provisional**; event page confirms the final date |
| Format | Online; **shortlisted teams attend an offline Demo Day** (location not stated; costs incl. Demo Day are the participant's own) |
| Who | Individuals and teams welcome (**solo OK**); age ≥ 18 / majority; X Layer "Restricted Persons" ineligible |
| Entry fee | None stated |
| Core requirement | Build within the TapeOut ecosystem and **use TapeOut circuits, contracts or on-chain data on X Layer**, or run on X Layer DeWEB. Interfaces/other components do **not** need to be on-chain |
| Description must cover | product/service, **target users and how to reach them**, **proposed revenue model**, **why users would pay and keep using it** (tool projects may describe use cases + commercial applications) |
| Addresses / links | Circuit projects: processor contract address + circuit ID. Websites/apps/tools: **an access link** + which TapeOut ecosystem projects/features they use |
| Existing projects | Allowed, but only work done during the event is judged; describe additions |
| Revenue | Pre-revenue projects may participate |
| AI-built projects | **Not mentioned** (no ban). Misconduct clause bans plagiarism, unauthorized code/assets, **fabricated functionality or data**, impersonation, judging manipulation |
| ID / KYC | Organizer may verify eligibility and require **winners to complete identity checks**; compliance/sanctions checks on recipient wallets |
| Payout | Paid **in stages** as winners work with X Layer and TapeOut on agreed milestones; to a **self-custodial wallet** the winner controls (organizer never asks for keys/seed) |
| IP | Participant keeps ownership; grants organizer a non-exclusive licence to showcase |
| Support | Event Telegram channel (link on page, not opened) |

## Judging criteria (official, jointly by X Layer + TapeOut teams)
1. **User Value & Commercial Potential** — real user needs, target market, long-term growth, sustainable operations.
2. **Innovation** — originality in circuit design, product features or UX; potential to expand TapeOut into new use cases.
3. **Ecosystem Integration** — effective use of TapeOut or ecosystem capabilities (DeWEB, FabX, TapeCode, TapeKit, TapeSend). Using any specific tool is not required.
4. **Product Readiness & UX** — functional core features, complete user journey, reduced technical barrier.
5. **Demo Video** — recommended ≤ 3 min; must cover: problem, core-feature demo, target users & business model, how the project uses TapeOut / ecosystem tools.

## Submission form
The event page says "Submit through the submission form"; the form link is rendered by JavaScript and was **not visible in fetched text**. A third-party listing says it is a **Google Form linked from the Build X page**. → Needs a live-browser check (open the page, click the submission link, list the fields) before filing.

## TapeOut documentation found
- No official ABI doc for the X Layer processor/circuit contracts was found.
- Official: **TapeKit `SPEC.md` (TapeOutProtocol/TapeKit, Appendix B "contract interfaces")** — defines processor number = `factory.cpuAt(n)`, #ID numbering from 1, ERC-6551 containers, DeWEB site store. It targets **BNB Chain**; X Layer addresses differ. https://github.com/TapeOutProtocol/TapeKit/blob/main/SPEC.md
- Official site tapeout.net legal notice: protocol v2.0 still in development; **factory contracts remain upgradeable, permissions held by a 3/5 multisig** (statement is about the protocol; X Layer factory owner per on-chain read is `0xB3D85b42A045c1A88D800CAD0F55d2566a4D3138`, multisig status not verified).
- Community confirmation of input packing: "TapeOut packs input pin i into bit i" (fruitfly.world/nand) — matches our encoding.
- Our own live verification: `eval(id, bytes)` reverts with `"has latch: use step"` on sequential circuits; `step(id, state, input)` returns `(nextState, output)` — confirmed on CPU 0 circuit #4 (a mod-3 counter).

## Surprises / competitive notes
- Other entrants are already live on X Layer with TapeOut: e.g. **ViperX** (four TapeOut risk circuits gating a trading vault, "verified against all 65,536 inputs before deployment") and **FIZZL presign-guard** (checks TapeOut transfers before an AI agent signs, paid per check). → TruthTable should position as the **neutral, reusable verification layer** any such project (and their users/judges) can use, not as a one-off.
- "Fabricated functionality or data" is a disqualification ground → README must keep every claim backed by live reads (done: tests hit mainnet; index snapshot is reproducible).
