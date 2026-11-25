# On-chain notes — TapeOut on X Layer (chain 196), read 25 Nov 2026 via https://xlayer.drpc.org (block ~76,835,491)

| Item | Address | Note |
|---|---|---|
| Factory (ERC-1967 proxy) | `0x1f09daefa827f02cbb40967cc91b259763760761` | impl `0x336e9f0f4c3fee7c8c803377e4dea00293f4ae2a`; owner `0xB3D85b42A045c1A88D800CAD0F55d2566a4D3138`; cpuCount 450; deployFee 1e7 wei; protocolFee 1e6 wei; isSealed=false (upgradeable) |
| Market (ERC-1967 proxy) | `0xd89f358c48a7B632c9845af2a02A32eB90DD75DB` | impl `0x38d688f4793a9bf270c2c99492c9a1e45163db6e` (list/buy/delist) |
| Circuit beacon | `0xf70d1ed4f62CF3780157B0b421b7E2F45bD0991C` | impl `0x977f217887E085D298Cb3819cDAD5A0ee35F29B2` |
| Transistor beacon | `0x1059Ad62cAbB6a6925bb65aA617300556c60A51B` | impl `0x265bf10faB9ddEC0eE0A649C6B9DB845f1b9a06b` (ERC-1155 NAND/LATCH, mint payable) |
| CPU #0 circuits | `0x839bdD6fa7A66416A609A735e11DE5411B98574e` | "OnlyTestXLayer", nextId 105, TAPEOUT_FEE 0.0013 OKB, transistors `0xbe0eeE424C49d44592e4D498740F5B031Ef8e26D` |
| CPU #449 | `0x06Ba166258a89a26801C57193c4c3bb21bBeaCDb` | "Gris", 0 circuits |

Factory selectors (from implementation bytecode, resolved via a 4byte DB): cpuCount `0xa94da8a7`, cpuAt `0x4bc7cbbd`, cpus `0xd2c26963`, isCPU `0x5f5a364f`, createCPU `0x47f9b5fd`, deployFee, protocolFee, circuitBeacon, transistorBeacon, owner, upgradeToAndCall.
Circuit contract: eval(uint256,bytes) `0x934d06ea` (view), step(uint256,bytes,bytes) `0xe8281a1a` (view), circuitInfo `0x084d60f1`, netlist `0x3fc4be56`, tapeout(bytes,uint32,uint32) `0x7bd3ac1d` (payable), nextId, TAPEOUT_FEE, transistors.

Note: the processor list at tapeout.work (`0xb1024b…`, `0x50a994…`) has **no code on X Layer** → those are BNB Chain addresses. The official TapeOut docs/ABI were not found; everything above comes from live bytecode + view calls.
The factory owner can upgrade the implementation (UUPS, not sealed) — mention this in the submission as a dependency risk.
