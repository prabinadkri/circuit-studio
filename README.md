# Circuit Studio

An integrated, offline Linux electronics workbench with schematic simulation, AVR and PIC firmware execution, and a PCB editor sharing one project file.

**Status: working alpha, 0.3.0.** This is an independent application built with open-source simulation engines. It is not affiliated with Proteus, does not import Proteus projects, and does not yet offer Proteus feature parity.

![Circuit Studio schematic workspace](docs/circuit-studio.png)

## Run on Linux

```sh
./run.sh
```

Requires Python 3.10+ and Chrome or Chromium. The included PIC and ngspice backends are built for Linux x86-64 / Ubuntu 24.04; rebuild PICsim and install system ngspice on other architectures. The launcher opens a dedicated desktop window and serves the application only on `127.0.0.1`. Internet access is not needed at runtime.

Optional application-menu shortcut:

```sh
python3 install-desktop.py
```

Keep this folder in its current location after installing the shortcut, or rerun the installer after moving it. Browser profile and autosave data are kept in `$XDG_DATA_HOME/circuit-studio` (normally `~/.local/share/circuit-studio`). Removing `~/.local/share/applications/circuit-studio.desktop` removes the menu entry.

For a regular browser window: `./run.sh --serve`, then open the printed local address. Change the port with `--port NUMBER` if necessary.

## What works

- **Circuit lab:** 145 searchable component entries with categories/favorites and explicit model limits, unit-aware property inspector, component references, navigable electrical checks, placement, wiring, rotate/mirror, copy/paste, cross-workspace undo/redo, analog and digital simulation, oscilloscope views, example circuits, measurements and SVG export. CircuitJS1 supplies the simulation and schematic engine.
- **Firmware:** eight lab profiles: Arduino Uno R3, classic Nano, bare ATmega328P, PIC16F84A, PIC16F628A, PIC16F877A, PIC18F4520 and PIC18F4550. Load compiled Intel HEX, run, pause, reset and step; inspect GPIO, registers and program counter. AVR USART0 output appears in the serial monitor. Each profile includes blink and button-to-LED exercises with source; ADC-capable devices also include a voltage-sweep exercise.
- **Circuit connections:** AVR GPIO uses `D0`–`D13` and `A0`–`A5`; PIC signals follow the selected chip’s pin reference. External Voltage components receive outputs; labeled `IN_` nodes supply inputs. Analog sliders provide 0–5 V test stimuli, overridden by a connected schematic node. Classic Nano A6/A7 are analog-only. Physical pin references and manufacturer links help translate an exercise to hardware.
- **PCB:** assign DIP/SOIC/header/passive packages and pin maps, rotate/flip footprints, preview schematic updates while preserving placement and unaffected routes, route front/back tracks with bend points, undo edits, inspect airwires, check basic clearances and connectivity, and export KiCad boards or Gerber/drill ZIPs.
- **Projects:** v2 `.circuit` files retain stable component/pin/net identities, schematic, firmware per profile, selected device, PCB layout and analysis results. v1 projects migrate on opening. Save locally uses atomic disk writes with a previous revision; browser recovery retains two checked revisions. Open also accepts CircuitJS text/XML circuits. Use Save file for a portable backup; local disk projects are under the application’s `projects/` directory.

- **Analysis:** standalone ngspice DC/AC/transient sweeps, first-probe plots, CSV export and local diode/BJT model import with explicit syntax limits. Matching ngspice source and licenses are included.

**Milestone delivered:** [15 of 29 tested roadmap tickets](docs/planning/MILESTONE-15.md), including three feasibility experiments. This is a ticket-count milestone, not 50% Proteus parity.

The [professional-workbench roadmap](docs/planning/ROADMAP.md) compares this alpha with documented Proteus workflows and includes a component/UI specification and dependency-ordered backlog. The latest placement repair lets you select an op-amp or other component and **click empty canvas space to place it**; dragging still sets size, and wires require a drag between endpoints.

See [the lab guide](docs/LAB_GUIDE.md) for device choices, exercises, source files and physical wiring references.

## Current boundaries

- Firmware and analog simulation have independent clocks and exchange sampled GPIO states. Fast PWM, serial protocols across the circuit bridge and precise mixed-signal timing are not validated. This is functional GPIO coupling, not timing-accurate co-simulation.
- MCU support is limited to the eight profiles listed above (six distinct chip models). Uno, Nano and bare ATmega328P share the same AVR core. AT89S52/8051, ATmega32/2560, ESP32 and STM32 are not implemented. Compilers, board packages and source debugging are not built into the app; the supplied examples can be rebuilt with external AVR-GCC/gputils.
- All profiles use 5 V logic with implicit power/reset and fixed clocks: 16 MHz for AVR, 4 MHz for PIC. Config-dependent clock changes, oscillator-pin GPIO, USB, and SPI/I2C devices across the schematic bridge are not implemented. The PIC serial monitor is not connected. Output voltage sources approximate digital levels; they do not model tri-state buses, open-drain drive or pin current limits.
- Automated device checks cover blink, button GPIO, ADC reference points and project persistence. They do not certify all silicon peripherals, interrupts, instruction edge cases or arbitrary firmware. Pin references describe exposed signals, not a complete power/oscillator wiring diagram.
- Basic two-pin parts receive generic packages automatically; other components require an explicit package/pad map. The behavioral 555 has a default DIP-8 mapping. Generic symbols/models do not certify manufacturer pinouts or electrical behavior.
- PCB uses a fixed 100 × 60 mm board and 0.5 mm tracks. Pad sizes/drills follow assigned packages. DIP-28/40 are the wide 15.24 mm variants; exact narrow/manufacturer variants must be verified or added. There are no vias, pours, autorouter, courtyards or 3D models yet.
- Design checks cover endpoint connectivity, copper/pad clearance and board edges. Same-net track intersections are conservatively not counted as intentional junctions; terminate routes at pads. Checks do not cover every manufacturing or assembly constraint. Both KiCad and Gerber UI exports require the available checks to pass. Verify footprint pitch, polarity and fabrication outputs before ordering.
- Schematic changes do not automatically rewrite an existing PCB. Export rejects a board whose imported netlist no longer matches the schematic; Update from schematic previews changes and retains placement/routes whose endpoint nets still match.
- There is no Proteus `.dsn` / `.pdsprj` compatibility, 3D board viewer or general-purpose vendor SPICE model import. The experimental Analysis tab accepts a limited local D/NPN/PNP syntax and does not translate the schematic.

## Build from source

Install Node.js 22+, npm, Python 3, GCC and Make. Then:

```sh
npm ci
npm run build
npm test
npm run test:engine
```

To rebuild the lab examples, install `gputils`, `gcc-avr`, `binutils-avr` and `avr-libc`, then run `npm run build:examples` before `npm run build`. CI rebuilds these examples before testing them.

The build bundles AVR8js and the Gerber ZIP writer, builds the vendored TypeScript simulation engine and compiles the PIC backend. The first engine build installs its locked development dependencies. `CHROME_BIN=/path/to/chromium npm test` selects a different Chromium binary.

The runnable `web/` assets and `native/libcircuitpic.so` are included for convenience. All corresponding source is included under `web/*-source.js`, `native/`, `sources/`, and the Python files. See [ARCHITECTURE.md](ARCHITECTURE.md), [VALIDATION.md](VALIDATION.md), and [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md).

After updating an existing installation, save your project and close/reopen Circuit Studio so the Python backend and frontend use the same version.

## License

GPL-2.0-or-later. Third-party code retains its own notices. See [LICENSE](LICENSE) and [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md).
