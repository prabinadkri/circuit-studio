# Architecture

The Linux launcher owns a loopback-only HTTP server and a dedicated Chromium application window. The frontend is framework-free JavaScript, SVG and CSS. It has no cloud account or external service dependency.

`web/studio.js` owns project state and coordinates the schematic, firmware and PCB workspaces. The CircuitJS iframe is same-origin and exposes a small adapter for commands, reset, circuit import/export, GPIO and netlist extraction. The full upstream source is in `sources/circuitjs1`; modified files are listed in the third-party notices.

`web/mcu-source.js` instantiates the AVR8js CPU, timers, GPIO, ADC, EEPROM and USART. Digital GPIO, ADC voltage inputs and USART output connect to the product interface; selected registers are read-only instruments. Uno, classic Nano and DIP-28 profiles share an ATmega328P core. Nano ADC6/7 have no digital drivers. Its instruction batches and the circuit solver advance independently.

`web/pic.js` calls a local, per-launch token-protected PIC endpoint. `pic_backend.py` validates HEX records and memory bounds, serializes requests, and calls `native/pic_bridge.c` through ctypes. PICsim supplies the five selected PIC16/PIC18 processor implementations. Each Python backend owns a separately allocated C context, and each load changes a generation token so an obsolete browser session cannot step the replacement program. Device-specific memory regions are validated before native parsing. The frontend generation counter discards responses arriving after a device switch. The context API uses `cs2_*`; legacy ABI wrappers let an already-running 0.1 launcher finish safely. The session endpoint declares API version 2, and the new PIC frontend asks users to save/restart if the server is older. The endpoint accepts only bounded load/step operations and digital/analog pin values, never shell commands or user-chosen filesystem paths.

`web/devices.json` is the shared profile catalog used by Python and the browser: target IDs, memory bounds, exposed signals, package pins, analog channels and reference links. `web/device-ui.js` presents the instruments and resolves named schematic input nodes. `examples/lab` contains assembler/C sources and compiled HEX; the build publishes these to `web/demos`.

`web/pcb.js` owns footprints, nets, tracks, undo snapshots, routing interaction, design checks and KiCad serialization. PCB connectivity comes from the analyzed schematic nodes. A source fingerprint prevents exporting a board after its schematic changes without an explicit re-import.

`web/manufacture-source.js` generates RS-274X copper/mask/outline files and Excellon plated drills, then packages them with fflate. All manufacturing outputs use the same coordinate transform. Generic footprint dimensions are a current product constraint.

The `.circuit` format is versioned JSON. Schema/geometry checks run before project replacement. Firmware selection and a `firmwareByDevice` dictionary persist. Legacy `firmware` and `picFirmware` fields remain for old version-1 projects. Live CPU/RAM state, manual pin states and analog slider settings do not persist. Changing devices clears execution state and releases the old output voltages; firmware text remains per profile. Browser autosave is separate from explicit file downloads.

## Next engineering milestones

1. Deterministic common-time scheduler with event-driven GPIO exchange and timing tests.
2. Editable footprint assignments, rotation, vias, net-preserving PCB synchronization, and broader DRC.
3. Compiler integration, serial input, source debugging and more validated MCU profiles.
4. Native save dialogs, distributable desktop runtime, project migration tests and installation packages.
5. Larger model/footprint libraries, 3D visualization and extensive reference-circuit validation.

These are unfinished work, not hidden existing features.
