# Validation

Validated locally on Ubuntu 24.04, x86-64, Python 3.12, Node.js 22 and Google Chrome. These checks establish the behavior below, not exhaustive EDA or device certification.

## Automated integration checks

Run `npm test` after building:

- Five Python tests: PIC HEX checksum, missing EOF, memory bounds, bounded step requests, and real PIC16F84A Blink execution through 1.6 million instruction cycles with both RB0 states observed.
- Browser tests: known voltage-divider results (5 V and 2.5 V), paused clock stability, component placement and undo, AVR single-step and D13 output, netlist transfer and PCB routing, and board export.
- One-file project save/reopen preserves schematic, firmware, device selection, footprints and routes.
- PIC RB0 drives nonzero current through the resistor/LED schematic.
- Invalid firmware checksums are rejected; PCB connectivity and same-layer clearance conflicts are detected; opposite-layer crossings are distinguished.
- Native simulation rejects requests without the session token.
- Manufacturing ZIP generation is checked against a board with no detected clearance or connectivity errors.
- Tests fail on uncaught browser errors.

Run `npm run test:engine` for the upstream engine tests plus the local regression for redundant undo snapshots.

## Independent file-format checks

During development, KiCad CLI 10.0.7 opened generated `.kicad_pcb` files and generated Gerbers. Gerbonara parsed the application's own Gerber and Excellon output: four through-hole flashes per copper layer, two front-copper track segments for the test fixture, four outline edges, and four plated drill locations. Copper and drill coordinates matched.

## Not yet validated

Precise AVR/PIC-to-analog synchronization, arbitrary real-world firmware, every upstream component model, large circuit performance, manufacturer-specific footprints and complete fabrication DRC. Firmware source compilation, MCU models beyond the two listed in README, and advanced PCB features remain outside this alpha.
