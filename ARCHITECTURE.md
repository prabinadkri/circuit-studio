# Architecture

The Linux launcher owns a loopback-only HTTP server and a dedicated Chromium application window. The frontend is framework-free JavaScript, SVG and CSS. It has no cloud account or external service dependency.

`web/studio.js` owns project state and coordinates the schematic, firmware and PCB workspaces. The CircuitJS iframe is same-origin and exposes a small adapter for commands, reset, circuit import/export, GPIO and netlist extraction. The full upstream source is in `sources/circuitjs1`; modified files are listed in the third-party notices.

`web/mcu-source.js` instantiates the AVR8js CPU, timers, GPIO, ADC, EEPROM and USART. Digital GPIO, ADC voltage inputs and USART output connect to the product interface; selected registers are read-only instruments. Uno, classic Nano and DIP-28 profiles share an ATmega328P core. Nano ADC6/7 have no digital drivers. Its instruction batches and the circuit solver advance independently.

`web/pic.js` calls a local, per-launch token-protected PIC endpoint. `pic_worker.py` manages up to eight independently locked subprocesses with bounded requests and a five-second timeout. Each child owns `pic_backend.py`, which validates HEX records and memory bounds and calls `native/pic_bridge.c` through ctypes. PICsim supplies the five selected PIC16/PIC18 processor implementations. Each Python backend owns a separately allocated C context, and each load changes a generation token so an obsolete browser session cannot step the replacement program. Device-specific memory regions are validated before native parsing. The frontend generation counter discards responses arriving after a device switch. The context API uses `cs2_*`; legacy ABI wrappers let an already-running 0.1 launcher finish safely. The session endpoint declares API version 2, and the new PIC frontend asks users to save/restart if the server is older. The endpoint accepts only bounded load/step operations and digital/analog pin values, never shell commands or user-chosen filesystem paths.

`web/devices.json` is the shared profile catalog used by Python and the browser: target IDs, memory bounds, exposed signals, package pins, analog channels and reference links. `web/device-ui.js` presents the instruments and resolves named schematic input nodes. `examples/lab` contains assembler/C sources and compiled HEX; the build publishes these to `web/demos`.

`web/pcb.js` owns footprints, nets, tracks, undo snapshots, routing interaction, design checks and KiCad serialization. `web/footprints.js` supplies generic parametric package geometry, physical pad numbers, rotation and side transforms. PCB connectivity uses stable design net IDs. A source fingerprint prevents exporting a board after its schematic changes without an explicit preview/apply update; unaffected routes and placements survive.

`web/manufacture-source.js` generates RS-274X copper/mask/paste/outline files and Excellon plated drills, then packages them with fflate. All manufacturing outputs use the same coordinate transform. Both manufacturing paths consume transformed pad geometry and enforce the supported checks.

The `.circuit` format is v2 JSON. `web/project.js` migrates v1, reconciles stable instance/pin/net identities and keeps bounded whole-project undo snapshots. IDs and metadata are persisted in CircuitJS XML. Versioned catalog records and a SHA-256 asset manifest retain provenance. Schema/geometry checks run before project replacement. Firmware selection and a `firmwareByDevice` dictionary persist. Legacy `firmware` and `picFirmware` fields remain for old version-1 projects. Live CPU/RAM state, manual pin states and analog slider settings do not persist. Changing devices clears execution state and releases the old output voltages; firmware text remains per profile. Browser recovery uses two checksummed slots. `project_store.py` fsyncs a temporary file and atomically replaces current/previous disk revisions; project files stay under the app projects directory. Browser exports remain portable backups.

## Analysis and feasibility work

`analysis_backend.py` validates a restricted SPICE grammar, generates DC/AC/transient commands, runs ngspice in a temporary directory with a timeout, and reads bounded numeric results. One authenticated analysis request can run at a time. `web/analysis.js` retains the independent text/parameters/results in the project and plots/exports results. It does not translate schematic components or accept general control scripts.

The paused deterministic stepping API supports the isolated `web/scheduler-source.js` feasibility fixture. The production AVR/PIC runners still use independent clocks. `spikes/electron.cjs` is an optional sandboxed runtime prototype; the release launcher continues to use system Chromium. See [tested milestone](docs/planning/MILESTONE-15.md) and [spike decisions](docs/planning/SPIKES.md).

## Remaining engineering

Shared-time production simulation and drive resolution, on-schematic MCUs, protocol instruments/peripherals, source debugging, vias/zones/full DRC, extra MCU audits, installable bundled runtime, hierarchy/variants and 3D remain open. The tested milestone does not imply those features exist.
