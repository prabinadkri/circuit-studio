# Research record and audit evidence

Reviewed **26 October 2026**, Asia/Kathmandu. These sources support the capability benchmark and candidate architecture; the implementation order and estimates are our engineering recommendations.

## Official product references

| Source | Use in this audit |
|---|---|
| [Labcenter VSM simulation](https://www.labcenter.com/simulation/) | Schematic MCU execution, mixed-mode circuit interaction and debugging |
| [Schematic capture](https://www.labcenter.com/schematic/) | Capture, hierarchy/reuse and documentation workflows |
| [PCB overview](https://www.labcenter.com/pcb/) and [layout](https://www.labcenter.com/pcb-layout/) | Routing, rules, high-speed design and physical-board workflow |
| [Advanced Simulation](https://www.labcenter.com/advancedsim/) | Separately offered graph-analysis capability |
| [Virtual instruments](https://www.labcenter.com/instruments/) | Measurement, generators and protocol analysis |
| [Peripheral models](https://www.labcenter.com/peripherals/) | Interactive devices and embedded peripheral categories |
| [VSM Studio](https://www.labcenter.com/vsmstudio/) | Build and source-debug integration |
| [Microprocessor families](https://www.labcenter.com/microprocessors/) | Breadth of target families; not proof of our backend support |
| [Libraries](https://www.labcenter.com/libraries/) | Symbols/footprints/3D asset workflow; catalog counts are not simulation counts |
| [What's new in 9.2](https://www.labcenter.com/whatsnew/9.2/) | Current advertised advanced scope and release context |

The site advertised Proteus 9.2 during review. This is a documentation comparison, not a hands-on version benchmark. Product bundles differ. Exact instrument channel counts were not used because official pages describe differing configurations. No vendor performance or accuracy claim was independently verified here.

## Candidate open-source integrations

| Primary reference | Decision and uncertainty |
|---|---|
| [ngspice shared library](https://ngspice.sourceforge.io/shared.html), [extras](https://ngspice.sourceforge.io/extras.html) | Candidate controlled analysis backend. Callbacks enable integration; timing correctness and model compatibility need a spike. |
| [KiCad library license](https://www.kicad.org/libraries/license/) | Retain CC BY-SA terms/attribution on redistributed assets and distinguish the design-output exception. |
| [KiCad format introduction](https://dev-docs.kicad.org/en/file-formats/sexpr-intro/), [footprints](https://dev-docs.kicad.org/en/file-formats/sexpr-footprint/index.html), [schematics](https://dev-docs.kicad.org/en/file-formats/sexpr-schematic/) | Documented formats support a constrained importer; interoperability is not automatic. Reject unsupported constructs explicitly. |
| [KiCad library conventions](https://klc.kicad.org/) | Reference for symbol/footprint quality checks, pin metadata and package geometry. |
| [simavr](https://github.com/buserror/simavr) | Candidate additional AVR backend. Exact chip/peripheral coverage and deployment licensing must be evaluated before selecting it. |
| [SDCC](https://sdcc.sourceforge.net/), [manual](https://sdcc.sourceforge.io/doc/sdccman.pdf) | MCS-51 compiler and uCsim direction for 8051; AT89S52-specific behavior needs validation. |
| [Renode supported boards](https://renode.readthedocs.io/en/latest/introduction/supported-boards.html) | Candidate for selected STM32 platforms. A board model is not full analog pin fidelity. |
| [Espressif QEMU guide](https://docs.espressif.com/projects/esp-idf/en/stable/esp32/api-guides/tools/qemu.html) | Official firmware emulation/debugging route for selected ESP32 features. Do not infer full radio, analog or all variant support. |
| [WCAG contrast guidance](https://www.w3.org/WAI/WCAG22/Understanding/contrast-minimum.html) | Design target for readable interface text. |
| [morluto/rea](https://github.com/morluto/rea) | User-suggested reverse-engineering tooling reviewed as context. It is not an EDA engine or component-model library and was not needed for this source-level repair. No Proteus binaries were analyzed or incorporated. |

None of the proposed new engines or asset libraries above was added to this change. Existing engines and licenses remain documented in [THIRD_PARTY_NOTICES.md](../../THIRD_PARTY_NOTICES.md).

## Reproducible local evidence

Baseline commit: `2b6eb6b791391f18e1de9e8c4d6dff0a748791d2`.

| Inspected area | Source evidence / implication |
|---|---|
| Shell/persistence | `web/studio.js`: 19 quick parts, project version 1, serialized engine schematic plus firmware map and board |
| Netlist identity | `sources/circuitjs1/ts/JSInterface.ts`: element-list and solver indices; stable cross-domain IDs need new representation |
| AVR timing | `web/mcu-source.js`: 160,000-cycle chunks, input sampling at batch boundaries and browser scheduling |
| PIC timing | `web/pic.js`: 20,000-cycle calls with wall-clock scheduling; not lockstep analog coupling |
| Component coverage | `sources/circuitjs1/ts/Menus.ts`: many additional upstream components and edit operations; do not misreport them all as absent |
| Scope capabilities | `ScopeFFT.ts`, `ScopeTrigger.ts`, `ScopeOverlays.ts`, `DataRecorderElm.ts`: existing functionality to expose/validate |
| Ideal op-amp | `OpAmpElm.ts`: generic behavior and compatibility GBW field; not a named manufacturer model |
| Placement defect | `MouseManager.ts`: zero-length click-created components discarded. Default `CircuitElm.dragPlace()` already provides suitable geometry |
| PCB | `web/pcb.js`: two-pin mapping, 30-part import cap, fixed layout parameters and endpoint connectivity. Re-import replaces layout |
| Manufacturing | `web/manufacture-source.js`: basic copper/mask/outline/drill output; no complete assembly output pipeline |
| Current test scope | `VALIDATION.md`, Python tests and browser suites; six distinct chips across eight profiles, no physical hardware certification |

Baseline UI evidence: [schematic](current-schematic.png), [firmware](current-firmware.png), [PCB](current-pcb.png), [measurements](ui-audit.json). These are **before this repair/palette polish**, at 1366 × 900 for the images. Automated layout measurements cover 1024, 1366 and 1440 widths. No toolbar overflow was observed at those settings; zoom/accessibility/very small screens still need their own checks.

After the repair: [op-amp click placement](placement-after.png).

The new regression suite `tests/placement.cjs` reproduces the user's gesture and checks all palette items, undo/redo, serialization, op-amp project persistence, double-click editing without duplicates, zoom and cancellation. Run `npm run build`, `npm test`, and `npm run test:engine` from the repository root. Tests use an isolated server/browser profile and do not close or overwrite the user's open application.

## Limits and maintenance

This is a feature/workflow audit, not a security certification, complete upstream model audit or commercial product evaluation. Revisit source links and package availability before choosing new dependencies. Maintain one feature matrix tied to tested versions, exact device identifiers and saved fixtures. Archive failures as regression cases and update status only after the corresponding acceptance gate passes.
