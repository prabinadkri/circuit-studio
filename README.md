# Circuit Studio

An integrated, offline Linux electronics workbench with schematic simulation, AVR and PIC firmware execution, and a PCB editor sharing one project file.

**Status: working alpha, 0.1.0.** This is an independent application built with open-source simulation engines. It is not affiliated with Proteus, does not import Proteus projects, and does not yet offer Proteus feature parity.

![Circuit Studio schematic workspace](docs/circuit-studio.png)

## Run on Linux

```sh
./run.sh
```

Requires Python 3.10+ and Chrome or Chromium. The included PIC backend is built for Linux x86-64 / Ubuntu 24.04; rebuild it on other architectures. The launcher opens a dedicated desktop window and serves the application only on `127.0.0.1`. Internet access is not needed at runtime.

Optional application-menu shortcut:

```sh
python3 install-desktop.py
```

Keep this folder in its current location after installing the shortcut, or rerun the installer after moving it. Browser profile and autosave data are kept in `$XDG_DATA_HOME/circuit-studio` (normally `~/.local/share/circuit-studio`). Removing `~/.local/share/applications/circuit-studio.desktop` removes the menu entry.

For a regular browser window: `./run.sh --serve`, then open the printed local address. Change the port with `--port NUMBER` if necessary.

## What works

- **Circuit lab:** component placement, wiring, editing values, undo/redo, analog and digital simulation, oscilloscope views, example circuits, measurements and SVG export. CircuitJS1 supplies the simulation and schematic engine.
- **Firmware:** ATmega328P / Arduino Uno at 16 MHz via AVR8js, and PIC16F84A at 4 MHz via native PICsim. Load compiled Intel HEX, run, pause, reset and step; inspect GPIO and program counter. AVR USART0 output appears in the serial monitor. Both devices include a Blink demo.
- **Circuit connections:** AVR outputs use External Voltage components named `D0`–`D13`; PIC outputs use `RA0`–`RA4` and `RB0`–`RB7`. Inputs use labeled nodes prefixed with `IN_`, for example `IN_D2` or `IN_RB0`. The firmware workspace can load a ready-to-use LED circuit.
- **PCB:** import supported schematic nets, move through-hole parts, route front/back tracks with bend points, undo edits, inspect airwires, check basic clearances and connectivity, and export KiCad boards or Gerber/drill ZIPs.
- **Projects:** `.circuit` JSON files contain schematic, AVR firmware, PIC firmware, selected device and PCB layout. Open also accepts CircuitJS text/XML circuits. Browser autosave is a recovery aid; use Save file for a portable backup.

## Current boundaries

- Firmware and analog simulation have independent clocks and exchange sampled GPIO states. Fast PWM, serial protocols across the circuit bridge and precise mixed-signal timing are not validated. This is functional GPIO coupling, not timing-accurate co-simulation.
- MCU support is limited to ATmega328P and PIC16F84A. Source compilers, board packages and a source-level debugger are not bundled. PIC16F84A has no hardware USART.
- PCB transfer supports two-pin resistors, capacitors, inductors, diodes, LEDs, switches and voltage-source connectors. Other components are rejected with a message; IC footprint mapping is unfinished.
- PCB layout currently uses generic horizontal two-pin through-hole footprints, a fixed 100 × 60 mm board, 0.5 mm tracks, 2 mm round pads and 0.8 mm drills. There are no vias, pours, autorouter, rotation or manufacturer-specific footprint library yet.
- Design checks cover endpoint connectivity, copper/pad clearance and board edges. Same-net track intersections are conservatively not counted as intentional junctions; terminate routes at pads. Checks do not cover every manufacturing or assembly constraint. Gerber export requires the available checks to pass. Verify footprint pitch, polarity and fabrication outputs before ordering.
- Schematic changes do not automatically rewrite an existing PCB. Export rejects a board whose imported netlist no longer matches the schematic; re-importing replaces placement and routes.
- There is no Proteus `.dsn` / `.pdsprj` compatibility, 3D board viewer or validated SPICE model import pipeline.

## Build from source

Install Node.js 22+, npm, Python 3, GCC and Make. Then:

```sh
npm ci
npm run build
npm test
npm run test:engine
```

The build bundles AVR8js and the Gerber ZIP writer, builds the vendored TypeScript simulation engine and compiles the PIC backend. The first engine build installs its locked development dependencies. `CHROME_BIN=/path/to/chromium npm test` selects a different Chromium binary.

The runnable `web/` assets and `native/libcircuitpic.so` are included for convenience. All corresponding source is included under `web/*-source.js`, `native/`, `sources/`, and the Python files. See [ARCHITECTURE.md](ARCHITECTURE.md), [VALIDATION.md](VALIDATION.md), and [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md).

## License

GPL-2.0-or-later. Third-party code retains its own notices. See [LICENSE](LICENSE) and [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md).
