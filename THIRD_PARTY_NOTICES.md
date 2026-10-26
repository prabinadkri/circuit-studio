# Third-party notices and provenance

- **CircuitJS1**, Paul Falstad, Iain Sharp and contributors: https://github.com/pfalstad/circuitjs1 — GPL-2.0-or-later. Vendored commit `e952e788a4135a693bfd4cee7883f9b3314e3e76`. Full corresponding source and original notices are in `sources/circuitjs1`. Local changes add the commands/reset/netlist API, remove the Dropbox script and unnecessary service worker registration for offline operation, fix redundant undo snapshots after component placement, add click-to-place using existing default component geometry (wires retain drag placement), add an undo regression test, refresh the development dependency lockfile, persist stable object/pin metadata, expose inspector/topology APIs, delegate project history commands and support bounded deterministic stepping. Alpha.3 adds time-target stepping, finite-impedance external GPIO drives, an original MCU package element, and its profile/configuration API. All modified engine sources are included.
- **AVR8js 0.21.1**, Uri Shaked and contributors: https://github.com/wokwi/avr8js — MIT. Bundled into `web/mcu.js` and the scheduler feasibility bundle `web/scheduler.js`. License in `licenses/AVR8js-MIT.txt`; dependency locked in `package-lock.json`.
- **PICsim**, Luis Claudio Gamboa Lopes and contributors: https://github.com/lcgamboa/picsim — GPL-2.0-or-later. Vendored commit `3ee791875e15097a2d219c6afe08a8eadc17b673`. Full corresponding source is in `sources/picsim`; the application adapter is `native/pic_bridge.c`.
- **fflate 0.8.3**, Arjun Barrett: https://github.com/101arrowz/fflate — MIT. Bundled into `web/manufacture.js`; license in `licenses/fflate-MIT.txt`.
- Development tools include esbuild, Playwright, TypeScript and Vitest; their package metadata and installed license notices apply. They are not required to run the prebuilt application.

The upstream CircuitJS npm package metadata says ISC, but its repository/source license is GPL-2.0-or-later; this project follows the source license.

REA (https://github.com/morluto/rea) was inspected at the user's request. Its workflow guidance recommends direct repository analysis when complete source is available. No proprietary Proteus binary was supplied or reverse engineered, and no REA code is bundled.

SimulIDE and KiCad were evaluated during development. They are not launched by or bundled with this application. KiCad's CLI was used independently to validate generated PCB files. Gerbonara was used independently to parse the generated Gerber and Excellon outputs.

- **ngspice 42**, Berkeley CAD Group/ngspice contributors: https://ngspice.sourceforge.io/ — mixed BSD/LGPL/GPL notices, preserved in `sources/ngspice/COPYRIGHT` with full GPL-2/LGPL-2 texts. `native/ngspice` is the unmodified Ubuntu noble amd64 package binary `42+ds-3build1`. Matching upstream/doc source archives, Debian patches/build recipe and signed source descriptor are included in `sources/ngspice`; checksums were verified against that descriptor. System shared libraries are not bundled. This restricted adapter does not redistribute third-party vendor models.
- **Electron 41.0.0** was used for the runtime feasibility benchmark. Source archives omit Electron binaries; optional full desktop archives include the runtime and notices described below.
- **Generic footprint assets** are original Circuit Studio parametric geometry, GPL-2.0-or-later. No KiCad library assets were copied. Exact dimensions and limitations are in `web/footprints.js`; these generic variants are not manufacturer certification.

## Copper geometry and mechanical preview

- JavaScript Clipper 6.4.2 (library header 6.4.2.2), Angus Johnson and Timo:
  [upstream](https://github.com/junmer/clipper-lib), Boost Software License 1.0.
  Its embedded JSBN code retains Tom Wu's license and acknowledgement:
  **This product includes software developed by Tom Wu and his collaborators.**
  License texts are in `licenses/clipper-Boost-1.0.txt` and `licenses/jsbn-LICENSE.txt`.
- earcut 3.0.2, Mapbox: [upstream](https://github.com/mapbox/earcut), ISC;
  `licenses/earcut-ISC.txt`.
- Three.js 0.180.0 and its OrbitControls/glTF/STL exporters:
  [upstream](https://github.com/mrdoob/three.js), MIT; `licenses/three-MIT.txt`.
  Original package envelopes in Circuit Studio are approximate, not manufacturer models.

Optional full desktop archives contain Electron and Chromium in `runtime/electron/`,
including the upstream `LICENSE`, `LICENSES.chromium.html` and `version` files.
Their binaries are copied without modification. Electron is MIT; Chromium contains
multiple licenses listed in its bundled notices. The desktop shell is Circuit Studio code.

The simavr/uCsim/Renode feasibility probes do not bundle those engines or their
firmware fixtures into the app. `spikes/backends/simavr-audit.c` is GPL-3.0-or-later
because it links to simavr's GPL-3.0-or-later API when built separately. The other
original application files remain GPL-2.0-or-later. Exact backend versions and
externally obtained fixture hashes are recorded in `docs/evidence/backend-audit.json`.
