# Feasibility results

## CS-030 — conservative simulation stepping

`SimulationManager.runCircuit(..., fixedSteps)` bypasses wall-clock pacing only when explicitly invoked by the paused `advanceSteps` API. Normal interactive pacing is unchanged. The API checks bounded counts, circuit stamping and solver errors. The fixture uses an actual AVR8js ATmega328P running compiled `spikes/pwm-adc.c`: Timer0 OC0A at 976.5625 Hz feeds a CircuitJS 1 kΩ / 1 µF filter, whose voltage feeds ADC0.

Both domains read the previous quantum's inputs, advance, then commit outputs at the boundary. Thus an output produced during a quantum is not fed backward into its analog interval. Quantum is 1 µs / 16 CPU cycles. AVR instructions may overshoot a boundary by an instruction; edge exchange is quantized. The result has a bounded sampling/transport approximation, not cycle-perfect analog coupling. ADC polling is used: this AVR8js ADC implementation does not automatically restart free-running conversions, and that limitation is retained explicitly.

12 ms / 12,000 analog steps produce identical full sampled voltage/ADC traces and PWM edges in a tight loop and in 100-step chunks with repeated 20 ms UI stalls. The reference RC output and actual ADC values remain in the expected steady-state envelope. Data: [trace](../evidence/scheduler-trace.json). Tests also verify total simulated time; rendering does not determine time.

**Decision:** proceed with an event/quantum adapter for CS-031; add edge-boundary splitting, explicit input/output drive resolution, convergence/error propagation and peripheral event deadlines before integrating the normal Run buttons. This experiment does not complete CS-031/033 or synchronize the existing firmware interface.

## CS-060 — desktop runtime comparison

Reproduce with a running local test server:

```sh
STUDIO_URL=http://127.0.0.1:PORT/ ELECTRON_BIN=/path/to/electron TEST_OUTPUT=.test-output node spikes/runtime.cjs
```

[Raw measurements](../evidence/runtime-benchmark.json), three fresh processes each, on the recorded i5-12450H / 15 GiB Linux machine. All non-local web requests were blocked. Both candidates loaded all 15 initial schematic elements, executed the solver and completed token-authenticated project API calls; neither exposed Node.js to renderer code.

| Median | System Chrome 156 | Electron 41.0.0 / Chromium 146 |
|---|---:|---:|
| Startup to engine ready | 579 ms | 1,728 ms |
| 50,000 canvas line operations | 63.4 ms | 14.4 ms |
| Project API round trip | 7.88 ms | 7.08 ms |
| 1,000 solver steps | 4.1 ms | 4.4 ms |

Chrome ran headless; Electron used a hidden native window. Different Chromium versions and rendering paths mean the canvas values are not a controlled performance ranking. These are feasibility measurements on one machine, not release performance guarantees. Electron's extracted test runtime was 296 MiB. Electron is a separate optional development dependency, not included in this release.

**Decision:** select sandboxed Electron as the first bundled-runtime candidate for CS-061, using existing HTTP IPC and no privileged renderer preload. Keep the small system-Chromium launcher in v0.3 until installer, runtime update, download handling, crash recovery and clean-uninstall gates pass. The prototype sets `sandbox: true`, `contextIsolation: true`, `nodeIntegration: false`, denies new windows and blocks non-local navigation/requests. These follow the [official BrowserWindow options](https://www.electronjs.org/docs/latest/api/browser-window) and [sandbox documentation](https://www.electronjs.org/docs/latest/tutorial/sandbox). QtWebEngine/Tauri remain unmeasured alternatives; no comparative performance claim is made for them.

## CS-070 — restricted ngspice analysis

Five reproducible fixtures are in `examples/analysis`. `test_analysis.py` compares against divider, exponential RC/RL and AC transfer equations, plus a generic diode's expected forward voltage interval. `tests/analysis.cjs` checks API/UI, saving results and CSV export. The Analysis tab uses an independent SPICE text document, not a schematic translator.

Supported syntax: R/C/L, independent V sources (DC, AC, simple PULSE), diode and BJT plus local `.model D/NPN/PNP` declarations with an explicit parameter whitelist. Unsupported directives, external includes, subcircuits, behavioral expressions and user control blocks are rejected before spawning ngspice. The server generates analysis commands and writes bounded results in a temporary directory, with a 15-second process timeout, input/output limits and one analysis at a time. No general-purpose SPICE command execution endpoint is exposed.

DC, AC and transient results are retained in v2 projects and export to CSV; plots show the first probe (AC magnitude). References: [ngspice manual](https://ngspice.sourceforge.io/docs/ngspice-manual.pdf). The bundled ngspice 42 Ubuntu binary has matching source archives and Debian build recipe under `sources/ngspice`. `NGSPICE` overrides it; a system installation is preferred when available.

**Decision:** viable standalone analysis adapter. Expand model dialect support and add a reviewed schematic translator in a future ticket; do not silently accept a vendor model that the importer cannot interpret.
