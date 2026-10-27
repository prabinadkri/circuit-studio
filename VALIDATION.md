# Validation

Validated locally on Ubuntu 24.04, x86-64, Python 3.12, Node.js 22 and Google Chrome. These checks establish the behavior below, not exhaustive EDA or device certification.

## Automated integration checks

Run `npm test` after building:

- Twenty-five Python tests, including parameterized checks across all five PIC models: compiled blink through 1.6 million cycles, RB1 input driving RB0, DIP pin numbers, target-specific HEX bounds, configuration/EEPROM records, isolated C contexts, stale-session rejection, analog input validation and compatibility with an already-running 0.1 launcher.
- PIC16F877A, PIC18F4520 and PIC18F4550 compiled ADC programs return 0, 255, 511 and 1023 for 0, 1.25, 2.5 and 5 V respectively.
- Browser tests exercise all eight profiles: real compiled button firmware, live input/output changes, device-specific pin references and ADC midpoint readings where available. Nano A7 returns full-scale at 5 V and has no digital output button.
- A real schematic `IN_RA0` node at 1.25 V overrides the manual slider and produces an ADC value of 255. The manual control becomes disabled and shows the schematic voltage.
- All eight independent firmware payloads survive a project save/reopen. The AVR built-in blink instruction image matches the independently assembled source.
- Browser tests: known voltage-divider results (5 V and 2.5 V), paused clock stability, component placement and undo, AVR single-step and D13 output, netlist transfer and PCB routing, and board export.
- All 19 quick-palette tools are checked for click/drag placement, single undo/redo and schematic serialization. Wires intentionally require a drag. Additional checks cover repeated op-amps, double-click editing without duplicate placement, filtered search, selection state, project save/reopen, zoom and cancellation when leaving the canvas. This validates placement, not all model electrical behavior.
- One-file project save/reopen preserves schematic, firmware, device selection, footprints and routes.
- PIC RB0 drives nonzero current through the resistor/LED schematic.
- Invalid firmware checksums are rejected; PCB connectivity and same-layer clearance conflicts are detected; opposite-layer crossings are distinguished.
- Native simulation rejects requests without the session token.
- Manufacturing ZIP generation is checked against a board with no detected clearance or connectivity errors.
- Tests fail on uncaught browser errors.

Run `npm run test:engine` for the upstream engine tests plus the local regression for redundant undo snapshots.

## v0.3 milestone checks

See [15-ticket acceptance ledger](docs/planning/MILESTONE-15.md) for exact gates and limitations. Eight domain tests cover topology IDs, history, recovery corruption, unit parsing, independent asset validation, package transforms, ERC and malformed project rejection. Browser suites add real v1 migration, clipboard identity, unit-aware inspector/package/NC edits, diagnostic navigation, cross-domain undo, atomic local storage, 32 common component placements, responsive layouts, non-destructive board updates and standalone analysis persistence/CSV.

The scheduler fixture tests actual timer PWM through the CircuitJS RC solver back into AVR ADC under UI stalls. That earlier isolated feasibility experiment is now complemented by the production shared-runner tests described below. Five ngspice references are numerically compared with circuit equations/model bounds; unsupported directives are rejected. All five must execute without skips for milestone validation.

Killed/timed-out PIC workers cannot mutate disk project files; two sessions and repeated reset/step sequences are tested. Atomic-save fault injection recovers the prior complete revision. Saved CPU execution state is intentionally outside the project contract.

## Independent file-format checks

During development, KiCad CLI 10.0.7 opened generated `.kicad_pcb` files and generated Gerbers. Gerbonara parsed the application's own Gerber and Excellon output: four through-hole flashes per copper layer, two front-copper track segments for the test fixture, four outline edges, and four plated drill locations. Copper and drill coordinates matched.

The v0.3 multi-package fixture adds DIP-28, bottom-side rotated SOIC-8 and a rotated header: 42 copper pads, 34 drilled pads, 8 bottom paste flashes. KiCad CLI 10.0.7 regenerated Gerbers successfully. Gerbonara independently verified copper coordinates on both sides, rotated SMD pad sizes and drill positions/diameters against the source geometry. `spikes/verify-packages.py` reproduces this check. This does not complete the broader CS-043 routing/manufacturing parity ticket.

## Not yet validated

Silicon-cycle-accurate AVR/PIC-to-analog synchronization, arbitrary firmware, every upstream component model, manufacturer-specific footprints and complete fabrication DRC remain unvalidated. The current compiler/debugger covers AVR C; additional MCU models, PIC source debugging/serial monitoring, USB, arbitrary SPI/I2C hardware-controller coupling, chip-specific electrical fidelity and PCB features beyond the bounded alpha.4 gates remain unvalidated. Recorded performance covers the specified fixtures, not arbitrary large designs. Test HEX images are rebuilt by external gputils/AVR-GCC in CI; this does not constitute testing on physical chips.

## v0.4 automation, copper and mechanical acceptance

- `npm run test:automation`: real Chromium component creation (including op-amp
  and named external source), 5 V divider numerical result, atomic rollback,
  revision conflicts, stable identities, SVG and bounded MCP stdio/path tests.
- `tests/routing.cjs`: copper intersection connectivity, layer isolation, vias,
  solid zones with clearance holes, matching export gates and WebGL/model exports.
- `spikes/verify-routing.py`: Gerbonara + KiCad CLI + Shapely comparison of zone
  area/clearance and drill sizes; Trimesh model-unit/origin/drill-section checks.
  Run after the browser fixture and KiCad Gerber export. Optional verifier packages:
  `gerbonara shapely trimesh numpy scipy networkx`.
- `tests/test_install.py`: checksummed installation, idempotence, original project
  retention, modified-file preservation, unrelated shortcuts and symlink boundaries.
- `scripts/verify_release.py`: fresh extracted install with bundled Electron,
  actual solver output, PIC/device/ngspice/worker-storage suites and uninstall.
- `spikes/backends/audit.py`: separate native feasibility evidence for exact AVR
  GPIO timing, generic 8052 behavior and selected STM32 boot/UART. Not device support.
- Coding Hub's own `test_circuit_integration.py` checks command boundaries and
  instruction-context delivery; `tools/check_all.py --no-gui` passes after integration.

The 3D renderer uses procedural envelopes. The original protocol/peripheral and advanced-routing gates are recorded in MILESTONE-29.md; the shared-clock/AVR-debugger gates are recorded below.

## Alpha.3 embedded and usability acceptance

See `docs/planning/MILESTONE-24.md` for the five newly completed ticket gates,
fixture names and limits. `tests/coupled.cjs` uses the real analog solver and AVR
core, including a PWM/RC/ADC roundtrip and driver contention. Native PIC traces
are compared across request sizes and watchdog resets. `tests/instruments.cjs`
checks actual controls, CSV, triggers and in-flight PIC cancellation.
`tests/compiler.cjs` builds real C, navigates a real diagnostic, and pauses both
CPU and analog time on source breakpoints. `tests/usability.cjs` records measured
performance and effective CSS zoom/width reflow, not all OS scaling combinations.

## Alpha.4 original roadmap closure

`tests/protocols.test.mjs` independently generates UART frames at two rates and
SPI edges in four modes, and exercises I²C ACK/NACK/stretch/repeated START/read,
EEPROM busy/page wrap, OLED addressing and LCD DDRAM. `tests/peripheral-lab.cjs`
executes compiled AVR firmware against the actual analog return nets.
`tests/reuse.cjs` checks isolated/nested block instances, editable copies, stable
reopen IDs and assembly variants with unchanged PCB copper.
`tests/advanced-routing.cjs` separates pair, length, shove and via-span fixtures,
checks transaction rollback, validates per-layer connectivity and exported files.
`spikes/verify-advanced-routing.py` independently parses Gerbers/drills.
`spikes/backends/esp32c3-audit.py` records a repeatable direct-ELF UART probe, not
ESP-IDF or schematic integration. The backend audit explicitly leaves unsupported
profiles disabled. See `docs/planning/MILESTONE-29.md` for all scope limits.


## Alpha.5 navigation and UI regression

`tests/navigation.cjs` uses real browser mouse/keyboard gestures against the bundled
engine: hand, middle-button and Space-drag pan; pointer capture/release outside the
iframe; placement immediately after pan; preserved geometry and undo; keyboard
and clickable view movement; form input isolation; panel hide/show; PCB wheel
anchor and unfinished-route preservation; running shared MCU timeline retention.
`tests/usability.cjs` checks all workspaces at nine effective viewport/zoom sizes.
The full existing regression suite remains required, including analog simulation,
MCU coupling, component placement, project edits, PCB export, reuse and peripherals.
Neutral UI colors do not change solver or fabrication outputs. Screenshots are
visual review evidence, not a substitute for the interaction tests.
