# Current status: 29/29 original acceptance gates

See [MILESTONE-29.md](MILESTONE-29.md) for tested deliveries, completed feasibility decisions and exact implementation limits. Ticket count does not measure Proteus feature parity.

# Circuit Studio: path to a professional Linux circuit lab

**Audit date:** 26 October 2026. **Baseline:** `2b6eb6b791391f18e1de9e8c4d6dff0a748791d2`, v0.2 alpha. **Current progress:** 29 of 29 original gates pass within the scope recorded for v0.4.0-alpha.4. See [current milestone evidence](MILESTONE-29.md), [feasibility results](SPIKES.md) and [current backlog](BACKLOG.csv). This percentage counts tickets, not Proteus feature parity. The comparison and estimates below retain the original v0.2 audit baseline; use the milestone ledger for implemented behavior.

Circuit Studio is useful as an early circuit/firmware workbench. It is not yet a substitute for Proteus across a complete teaching lab or production PCB workflow. The largest gap is the connection between domains: firmware, analog simulation and PCB layout need to share stable component identities, real pin mappings and controlled simulation time. More icons or chip names alone will not close that gap.

This comparison uses official Labcenter documentation, a source audit of our application and automated browser checks. No installed commercial Proteus version or physical lab hardware was tested. Proteus features vary by package; Advanced Simulation is an additional option. See [research and limitations](RESEARCH.md), [component and interface specification](COMPONENTS_AND_UX.md), and the [ordered implementation backlog](BACKLOG.csv).

## Original v0.2 placement repair

A reproducible usability defect affected every quick-access part: selecting it and clicking the canvas produced a zero-length element which the engine discarded. All 19 tools worked when dragged. The op-amp was available, but the expected placement gesture failed.

Components now use their existing default geometry on a simple click in empty canvas space. Clicking/double-clicking an existing part preserves editing instead of placing duplicates. Dragging still sets length/orientation; wires still require a drag between endpoints. The palette gets consistent vector icons, clearer instructions, selected-button accessibility state and an explicit empty search result. The op-amp tooltip identifies the ideal model. This does not introduce an LM358/LM741 electrical model or an IC PCB footprint.

`tests/placement.cjs` exercises every quick-access tool, undo/redo and serialization, plus repeated op-amp placement, double-click editing, project save/reopen, zoom, cancellation and selection mode. This is a placement regression suite, not electrical validation of all upstream components.

## Capability comparison

| Area | Official Proteus benchmark | Circuit Studio evidence | Required outcome / priority |
|---|---|---|---|
| Schematic editing | Integrated capture, reuse, variants and documentation ([source](https://www.labcenter.com/schematic/)) | Working engine wiring, editing, rotation/mirroring, copy/paste and subcircuits. Quick palette has 19 tools; many other parts remain in Draw. No inspected project-wide hierarchy/ERC workflow. | Unified searchable library, consistent editing, stable multi-sheet nets, ERC, annotation/BOM. P0/P1. |
| Component library | Symbols, footprints and 3D assets with managed libraries ([source](https://www.labcenter.com/libraries/)) | Generic simulation elements and MCU profile metadata; no unified part/symbol/model/package record. | Separate symbol, simulation model and physical package; show precise support and provenance. P0. |
| MCU simulation | Firmware runs on a schematic MCU with circuit interaction and debugging ([source](https://www.labcenter.com/simulation/)) | Eight profiles, six chip models. Uno/Nano/bare 328P share one AVR core. MCU lives in a separate tab; named voltage nodes couple sampled GPIO. | Place a real pin-mapped MCU symbol, attach firmware, share simulated time with the circuit. P0. |
| Electrical/time accuracy | Mixed-mode system simulation ([source](https://www.labcenter.com/simulation/)) | AVR batches 160,000 cycles (~10 ms at 16 MHz); PIC batches 20,000 instruction cycles (~20 ms at 1 MHz), with separate wall-clock scheduling. High-Z/open-drain and explicit power/reset absent. | Deterministic event scheduling, power and drive semantics; preserve edges and analog feedback. P0. |
| Instruments | Scopes, meters, logic/protocol instruments and generators ([source](https://www.labcenter.com/instruments/)) | CircuitJS scope triggers, FFT and data recording already exist; shell exposes only basic measurements. AVR serial text exists, PIC serial not connected. | Surface existing tools; add time-aligned logic analyzer, UART/I2C/SPI decoding and trace export. P1. |
| Build and debug | Integrated toolchain discovery, build and source debugging ([source](https://www.labcenter.com/vsmstudio/)) | HEX loading and low-level state/step controls. Example compilation uses external tools. | Build pane with diagnostics, ELF/debug data, breakpoints/watchpoints and peripheral views. P1. |
| Peripheral models | Interactive displays, inputs, memory, sensors and drivers ([source](https://www.labcenter.com/peripherals/)) | Some generic upstream devices; no validated shared-bus LCD/OLED/I2C/SPI lab workflow. | End-to-end device fixtures with actual bus behavior, documented limits and saved projects. P1. |
| PCB layout | Constraint-driven routing, push/shove, high-speed tools and manufacturing outputs ([source](https://www.labcenter.com/pcb/)) | Two-pin horizontal generic footprints only; 30-part import cap. Two copper layers, fixed geometry, no vias/pours/IC packages. Re-import destroys layout. | Real footprints and pad maps, rotation, vias, rules, copper zones and non-destructive updates. P0/P1. Advanced routing later. |
| Analysis | Parameter/frequency/noise and other graph analyses in the add-on ([source](https://www.labcenter.com/advancedsim/)) | Interactive transient simulation; upstream FFT is not a complete SPICE analysis workflow. No validated model importer. | Explicit ngspice analysis backend, parameter sweeps and saved measurement assertions. P2. |
| Desktop/release quality | Integrated installed design environment | Python loopback launcher with external Chrome; Linux x86-64 native PIC library. Browser download-based saves. | Offline installer, native file handling, recovery, fault isolation and repeatable release builds. P1. |
| Advanced suite breadth | HDI, output jobs and other current additions ([source](https://www.labcenter.com/whatsnew/9.2/)) | No equivalent HDI/3D/MCAD/high-speed/variant/AI workflow. | Separate advanced milestones after common lab and ordinary PCB workflows pass. P3. |

P0 = correctness/foundation, P1 = common lab workflow, P2 = broader engineering use, P3 = advanced breadth. Library catalog size is not evidence that those parts are electrically simulated. We should not publish a percentage of “Proteus parity.”

## Architecture decisions

### One durable design document

Introduce project schema v2 with UUIDs for instances, pins, nets, sheets, footprints and routes. A library part references a symbol revision, package/pad mapping and optional simulation model revision. Project assets pin those revisions so updating a library cannot silently change an existing design.

The present `getNetlist()` exposes element-list positions and solver node indices. Those are transient implementation details, unsuitable as saved electrical identities. Add a separate connectivity graph, preserve legacy engine payloads during migration, and prove v1 projects reopen without silent loss. Commands must be undoable across schematic, properties and PCB. Separate this state from DOM rendering in `studio.js`.

### One authority for simulated time

Define backend capabilities before adding chips: `loadFirmware`, `runUntil`, `nextEvent`, `applyInputs`, `readPins`, `readMemory` and optional debug/snapshot operations. Unsupported operations must be explicit. Use integer ticks or rational conversion for differing clock domains and deterministic ordering for simultaneous events.

Digital nets need 0/1/Z/X resolution, open-drain pull-ups, contention detection and power/reset rules. Analog crossings need thresholds/hysteresis and a defined synchronization boundary. Preserve every relevant GPIO edge; never use the browser paint rate as the electrical clock. Run native emulators in isolated worker processes and batch timestamped events over bounded IPC.

The first experiment is AVR PWM into an RC network with ADC feedback. Compare trace and final state while UI rendering is throttled. If exact edge scheduling cannot be supported by a backend, declare the mode approximate. The existing `ontimestep` hook helps integration but does not by itself solve causal ordering. Optimistic rollback requires complete CPU, peripheral, solver and event-queue snapshots; use conservative synchronization until that exists.

### Reuse engines behind explicit boundaries

Keep CircuitJS for interactive circuits while evaluating ngspice first for offline analysis. Its [shared-library API](https://ngspice.sourceforge.io/shared.html) supports control/callbacks, but a correct co-simulation bridge remains our engineering work. Use one analog solver per circuit partition and document each supported model dialect. Do not silently simulate the same net in two engines.

Evaluate simavr for additional AVR targets, uCsim/SDCC for 8051, Renode for selected STM32 boards and Espressif QEMU for selected ESP32 firmware. These are candidates, not implemented backends or complete electrical models. Verify exact device, peripheral, pin, timing, licensing and debug coverage in a feasibility fixture before adding a support badge. Sources and limitations are in [RESEARCH.md](RESEARCH.md).

### Physical libraries and board design

Import a documented subset of KiCad symbols/footprints as assets with separate licenses and provenance. Retain KiCad library attribution and applicable CC BY-SA terms; the [design-output exception](https://www.kicad.org/libraries/license/) is not permission to relabel redistributed libraries as application GPL code.

Build Circuit Studio's own integrated board workflow around explicit pad-to-pin mappings, arbitrary footprints, transforms, layer stack and routing geometry. Start with manual routing and through-vias; add zones and incremental DRC before push/shove or autorouting. Preserve placement/routes on value changes and present a reviewable change list for net changes.

Use the same export checks for KiCad and Gerber. Currently KiCad export invokes checks without blocking on reported issues, whereas Gerber export blocks; make the policy consistent and document any explicit override. Silkscreen, solder mask, paste, drill plating and board outline must come from real package data, not global fixed dimensions.

### Linux delivery

Benchmark Qt WebEngine, Electron and Tauri against existing canvas interaction and worker needs before choosing a bundled runtime. Ship one integrated app with offline examples and license/source manifests. Package native backends per architecture. Preserve user projects on updates/uninstall; use atomic saves, migrations, recovery and understandable crash diagnostics. No root privileges should be needed for routine editing or simulation.

## Delivery sequence and acceptance gates

These estimates are preliminary engineering effort, not calendar promises. They assume experienced EDA/simulation development and require revision after spikes. Hardware validation, advanced feature breadth and ongoing component maintenance add further work.

| Milestone | Work / dependencies | Exit demonstration | Initial effort range |
|---|---|---|---|
| M0 Reliability | Placement repair delivered; remaining capability audit and baseline fixtures | Every exposed tool has documented gestures; failures reproduce in a saved fixture; no misleading support labels | 1–2 engineer-weeks for remaining audit |
| M1 Foundation | Stable schema, migration, library contract, command history. Depends M0 | Existing v1 projects reopen with equivalent nets/values; move/delete/undo/reopen retain IDs | 3–6 engineer-weeks |
| M2 Everyday editing | Library browser, properties, symbols, ERC, accessible layout. Depends M1 | Build a 555/op-amp circuit from blank without hidden menus; named model limitations visible; ERC navigates to pins | 4–8 engineer-weeks |
| M3 Embedded correctness | Scheduler, electrical pins, on-canvas MCU, isolated backends. Depends M1, with M2 integration | Reproducible GPIO/PWM/ADC tests; shared bus has Z/open-drain/contention semantics; UI load does not alter traces | 8–16 engineer-weeks plus feasibility risk |
| M4 Complete lab exercises | Instruments, UART/I2C/SPI, display/input models, build/debug. Depends M3 | Compile/debug a button+LCD exercise and a sensor+OLED exercise; inspect bus frames and analog readings | 6–12 engineer-weeks |
| M5 Practical boards | Real DIP/SMD assets, transforms, vias/zones, DRC, ECO and manufacturing. Depends M1/M2 | Make a DIP-28 MCU board with regulator and headers; update a value without lost routes; independent output validation | 8–16 engineer-weeks |
| M6 More silicon | Target-specific AVR/8051, then selected STM32/ESP32 feasibility. Depends M3/M4 | Each supported target passes declared instruction/peripheral/bus fixtures and has exact package mapping | 6–12 engineer-weeks for a selected first tranche; reassess per family |
| M7 Reliable Linux release | Bundled runtime, recovery, installer, performance/accessibility and docs. Starts after M1; releases after gates above | Fresh offline Linux install runs supplied projects, saves/reopens and survives a worker crash without corrupting files | 4–8 engineer-weeks |
| M8 Advanced engineering | Analysis/model import, hierarchy/variants, 3D/MCAD, high-speed/HDI, autorouting and further peripherals | Separate acceptance specification and regression corpus per feature | Estimate after M3/M5 results; sustained multi-year program for broad suite parity |

Parallel implementation is possible after the shared document contracts stabilize, but adding people does not remove integration and validation dependencies. First target **dependable common teaching-lab exercises**, then **complete ordinary EDA workflow**, then **advanced suite breadth**. Do not label an alpha “perfect” or production ready.

## Validation contract for future milestones

- **Editing:** click/drag placement, rotation, mirror, copy/paste, multi-select and undo/redo at multiple zoom levels. Save/reopen must preserve topology and properties. Test mixed sheets and library migrations, not only one demo.
- **Analog:** resistor divider and RC step fixtures with declared sources/load/step bounds (initial target ≤1% error). Use model-specific tolerances for nonlinear circuits; compare saturation, supply behavior and settling for named op-amps. Do not impose one accuracy claim on all models.
- **Embedded:** repeat 10,000-edge traces deterministically under normal and throttled rendering; check PWM/RC/ADC round trips, interrupts, reset and two MCU instances. Validate UART at 9,600/115,200 baud, I2C at 100/400 kHz including NACK/stretch, and four SPI modes. Record unsupported peripheral behavior.
- **Hardware:** capture reference traces on exact chips/boards when hardware becomes available. Until then label fixtures software-validated, not hardware-certified.
- **ERC:** detect missing power, conflicting outputs, floating required inputs and mismatched pins; allow deliberate no-connect markers. Findings link to design objects.
- **PCB:** transformed pin/pad mapping, copper junction connectivity, cross-layer vias, annular ring/mask/paste/silkscreen/edge rules. Independently parse fabrication outputs and compare dimensions; DRC must not silently accept incomplete nets.
- **Reliability:** v0.1/v0.2 migration, interrupted atomic writes, crash recovery, malformed assets and large designs. Fresh offline Ubuntu 24.04 launch with no compiler needed for bundled examples. Expand distro/architecture claims only after testing.
- **UI/performance:** record baselines before promising speed. Test 1280/1366/1920 widths and 100/150/200% scaling, keyboard focus, non-color status cues and readable errors. Future targets: responsive editing on a declared reference machine and bounded cancellation for long analysis jobs.

## Immediate implementation order after this repair

1. `CS-002` reproducible capability fixtures and `CS-010` stable project schema.
2. `CS-011` component records/pin maps alongside `CS-020` library browser and inspector.
3. `CS-030` scheduling feasibility; stop expanding “supported MCU” claims until this gate passes.
4. `CS-040` real footprints and `CS-041` non-destructive schematic-to-board updates.
5. Instruments/peripheral exercises, new chip families and packaging against the explicit gates.

The [CSV backlog](BACKLOG.csv) is the implementation handoff: each ticket has dependencies, affected areas and a concrete completion test. Completed placement work is distinguished from future tickets.
