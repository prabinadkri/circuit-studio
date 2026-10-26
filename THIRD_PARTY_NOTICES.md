# Third-party notices and provenance

- **CircuitJS1**, Paul Falstad, Iain Sharp and contributors: https://github.com/pfalstad/circuitjs1 — GPL-2.0-or-later. Vendored commit `e952e788a4135a693bfd4cee7883f9b3314e3e76`. Full corresponding source and original notices are in `sources/circuitjs1`. Local changes add the commands/reset/netlist API, remove the Dropbox script and unnecessary service worker registration for offline operation, fix redundant undo snapshots after component placement, add an undo regression test, and refresh the development dependency lockfile.
- **AVR8js 0.21.1**, Uri Shaked and contributors: https://github.com/wokwi/avr8js — MIT. Bundled into `web/mcu.js`. License in `licenses/AVR8js-MIT.txt`; dependency locked in `package-lock.json`.
- **PICsim**, Luis Claudio Gamboa Lopes and contributors: https://github.com/lcgamboa/picsim — GPL-2.0-or-later. Vendored commit `3ee791875e15097a2d219c6afe08a8eadc17b673`. Full corresponding source is in `sources/picsim`; the application adapter is `native/pic_bridge.c`.
- **fflate 0.8.3**, Arjun Barrett: https://github.com/101arrowz/fflate — MIT. Bundled into `web/manufacture.js`; license in `licenses/fflate-MIT.txt`.
- Development tools include esbuild, Playwright, TypeScript and Vitest; their package metadata and installed license notices apply. They are not required to run the prebuilt application.

The upstream CircuitJS npm package metadata says ISC, but its repository/source license is GPL-2.0-or-later; this project follows the source license.

REA (https://github.com/morluto/rea) was inspected at the user's request. Its workflow guidance recommends direct repository analysis when complete source is available. No proprietary Proteus binary was supplied or reverse engineered, and no REA code is bundled.

SimulIDE and KiCad were evaluated during development. They are not launched by or bundled with this application. KiCad's CLI was used independently to validate generated PCB files. Gerbonara was used independently to parse the generated Gerber and Excellon outputs.
