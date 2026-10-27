# Discoverability and desktop identity — alpha.6

## Research and decisions

This is a heuristic review and automated usability regression check, not a user study or a claim of Proteus parity.

- [NN/g: Recognition rather than recall](https://www.nngroup.com/articles/recognition-and-recall/) recommends making available actions recognizable. The visible **Find command** button and **Ctrl+K** search expose workspaces, components, view controls, project saving, Coding Hub, and help. Results invoke existing handlers. Search never executes a command until the user chooses it.
- [NN/g: Visibility of system status](https://www.nngroup.com/articles/visibility-system-status/) supports feedback that reflects the current action. The schematic mode label now follows engine keyboard/menu changes and temporary/persistent panning, with the selected component reflected in the library.
- The prior Pan, Space-drag, middle-drag and click-based pan controls remain. Library/Inspector visibility is saved in this browser profile, with **Reset layout** always available above the schematic and in command search. Layout choices do not enter saved circuits or undo history.
- Search uses a labelled native modal, normal buttons, visible keyboard focus, arrow navigation, Enter, Escape and focus restoration. Existing modal editors keep their keyboard handling. The header adapts to smaller windows while keeping the footer visible.
- The [freedesktop desktop-entry specification](https://specifications.freedesktop.org/desktop-entry/latest-single/) defines `Icon` and matching `StartupWMClass`. The installer now uses an immutable release-specific PNG path and the runtime's actual window class. The PNG is rendered from the same slate/blue SVG as the header; no separate brand palette is introduced.
- [Electron app.setDesktopName](https://www.electronjs.org/docs/latest/api/app#appsetdesktopnamename-linux) associates the runtime with `circuit-studio.desktop`. An explicit BrowserWindow icon supplies the matching image to the window manager. Sandboxing, permissions and local-only renderer networking are unchanged.

## Verification

`tests/commands.cjs` checks iframe Ctrl+K, mode changes, Escape preserving the active tool, command activation, component search focus, panel persistence/reset, unchanged circuit geometry, and header/dialog/footer bounds at 390, 700, 1024 and 1440 pixels. `tests/navigation.cjs` retains circuit/PCB placement, undo, pending routes and live MCU pan checks. Installer tests cover Chrome and bundled Electron identities, immutable icon paths and upgrades. Full project regression tests remain required before release.

Remaining limitations: command search covers common entry points, not every advanced engine menu command. Panel preferences are local to a profile and origin. Desktop shells may retain the icon of an already running window until it is closed and reopened.
