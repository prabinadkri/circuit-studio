# 15-ticket tested milestone — v0.3 alpha

26 October 2026. The agreed unit is **15 of the 29 existing tickets passing their acceptance gates**: 51.7% by ticket count. Tickets differ greatly in effort. This is not 50% of Proteus functionality, engineering effort, or production readiness. The three feasibility tickets deliver tested experiments and decisions; their successor implementations remain open.

| Ticket | Delivered acceptance evidence | Scope / limitation |
|---|---|---|
| CS-001 | `tests/placement.cjs`: all 19 quick tools click/drag, one undo/redo, op-amp save/reopen | Wires require dragging. |
| CS-002 | `CAPABILITIES.csv`, `web/library.json`; `tests/catalog.cjs` compares the entire native Draw model list with the registry | All 145 model entries have a fixture or explicit unvalidated status. Eight MCU profiles have separate evidence. Placement never certifies electrical accuracy. Imported custom models remain unvalidated. |
| CS-010 | `tests/milestone.cjs`: actual v1 text migration, property/part retention, UUIDs through rotation/mirror/copy/save/reopen; `design.test.mjs`: net reindex/merge/split | One sheet; live CPU/RAM state is not saved. Net identities use pin-overlap matching. |
| CS-011 | Independent symbol/model/footprint/pad-map validators in `web/assets.js`, tested with malformed assets; provenance/revisions in catalog and project, generated SHA-256 asset manifest | Generic original packages, not manufacturer-certified library parts. Custom imported assets are explicitly unresolved. |
| CS-012 | Browser test undoes PCB import then schematic edit; keyboard/native menu use project history. Python injects rename failure; two-slot recovery rejects corruption | 100 full-document history entries; browser recovery and atomic disk revisions. No live CPU checkpoint. |
| CS-020 | `tests/milestone.cjs`: alias search, categories, blank-canvas placement, unit-aware inspector, footprint mapping and metadata | Detailed engine dialogs retained for advanced properties. |
| CS-021 | `tests/catalog.cjs`: 32 Wave A parts, finite grid-aligned pins, pin identities and save/reopen; screenshots reviewed at 1024/1366/1920 | Existing generic CircuitJS symbols/models. No new LM358/LM741/74HC manufacturer model is claimed. All catalog electrical validation states are explicit. |
| CS-022 | Placement/interaction suites: click/drag, rotate/mirror, Escape, zoom, clipboard, text-field shortcut suppression; responsive viewport checks | Existing engine shortcuts retained; this is not a complete WCAG audit. |
| CS-023 | `design.test.mjs`: missing supplies, multiple digital drivers, NC suppression; browser finding selects/centers component | Supported rule set, not full datasheet-aware ERC; generic power roles and no bus-drive resolution. |
| CS-030 | `tests/scheduler.cjs`, `docs/evidence/scheduler-trace.json`: actual AVR timer PWM → CircuitJS 1 kΩ/1 µF RC → AVR ADC, bit-identical trace with UI stalls | Feasibility fixture only. 1 µs conservative quantum, bounded sampling delay; production firmware UI still has independent clocks. See `SPIKES.md`. |
| CS-032 | `test_workers_store.py`: killed/timed-out worker, project survives, repeated reset/step results, two independent sessions | PICsim moved out of HTTP process into bounded workers. Eight session limit, 5-second RPC deadline. Step-only execution means no autonomous progress while paused. |
| CS-040 | `design.test.mjs`: DIP28/SOIC8/header all rotations/sides; `footprint-export.cjs`; independent KiCad/Gerbonara coordinate/dimension/drill checks | Generic package variants have explicit dimensions; verify exact physical part. No courtyard/3D library yet. |
| CS-041 | Browser test: value edit keeps placement/routes; net-change preview names affected pads, removes affected route; undo restores | Manual explicit update. No vias, zones or automatic rerouting. |
| CS-060 | Three trials each of system Chromium and sandboxed Electron: offline startup, canvas, solver, authenticated IPC; committed measurements and decision in `SPIKES.md` | Electron selected for future packaged desktop prototype; current release keeps the system-browser launcher. Qt/Tauri were not benchmarked. Installer ticket stays open. |
| CS-070 | Five ngspice references: divider DC, RC transient/AC, RL transient, diode local model; syntax rejection; browser sweep save/reopen/CSV | Standalone restricted SPICE tab, separate from drawn schematic. D/NPN/PNP local models only, no includes/subcircuits/scripts. |

## Reproduce

`npm ci && npm run build && npm test && npm run test:engine`

The complete run includes 8 JavaScript domain tests, 25 Python tests, 9 browser suites and 69 engine tests. The ngspice references must run without skips for milestone verification. Linux x86-64 binary/source bundle is included; install `ngspice` or set `NGSPICE` on other platforms.

Optional independent manufacturing check: run `tests/footprint-export.cjs` with the test server, export `.test-output/packages/board.kicad_pcb` through KiCad CLI into `.test-output/packages/kicad-gerbers`, then run `spikes/verify-packages.py` with Gerbonara installed. Runtime benchmark instructions are in `SPIKES.md`.

## Remaining work

14 tickets remain open: production common-time scheduler and pin-drive semantics; on-schematic MCUs; shared-time instruments/protocol peripherals/debugging; vias/zones and complete routing/DRC; extra MCU backend audits; installer/accessibility/performance guide; hierarchy/variants, 3D and advanced routing. No completion claim is made for those tickets.
