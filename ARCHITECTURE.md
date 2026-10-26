# Architecture

The Linux launcher owns a loopback-only HTTP server and a dedicated Chromium application window. The frontend is framework-free JavaScript, SVG and CSS. It has no cloud account or external service dependency.

`web/studio.js` owns project state and coordinates the schematic, firmware and PCB workspaces. The CircuitJS iframe is same-origin and exposes a small adapter for commands, reset, circuit import/export, GPIO and netlist extraction. The full upstream source is in `sources/circuitjs1`; modified files are listed in the third-party notices.

`web/mcu-source.js` instantiates the AVR8js CPU, timers, GPIO, ADC, EEPROM and USART. Only digital GPIO and USART output are currently connected to the product interface. Its instruction batches and the circuit solver advance independently.

`web/pic.js` calls a local, per-launch token-protected PIC endpoint. `pic_backend.py` validates HEX records and memory bounds, serializes requests, and calls `native/pic_bridge.c` through ctypes. PICsim supplies the PIC16F84A processor/peripheral implementation. The endpoint accepts only bounded load/step operations and pin values, never shell commands or user-chosen filesystem paths.

`web/pcb.js` owns footprints, nets, tracks, undo snapshots, routing interaction, design checks and KiCad serialization. PCB connectivity comes from the analyzed schematic nodes. A source fingerprint prevents exporting a board after its schematic changes without an explicit re-import.

`web/manufacture-source.js` generates RS-274X copper/mask/outline files and Excellon plated drills, then packages them with fflate. All manufacturing outputs use the same coordinate transform. Generic footprint dimensions are a current product constraint.

The `.circuit` format is versioned JSON. Schema/geometry checks run before project replacement. Firmware selection and both firmware payloads persist; live CPU/RAM state does not. Browser autosave is separate from explicit file downloads.

## Next engineering milestones

1. Deterministic common-time scheduler with event-driven GPIO exchange and timing tests.
2. Editable footprint assignments, rotation, vias, net-preserving PCB synchronization, and broader DRC.
3. Compiler integration, serial input, source debugging and more validated MCU profiles.
4. Native save dialogs, distributable desktop runtime, project migration tests and installation packages.
5. Larger model/footprint libraries, 3D visualization and extensive reference-circuit validation.

These are unfinished work, not hidden existing features.
