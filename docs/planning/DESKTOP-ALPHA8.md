# Desktop close and Applications icon fixes — alpha.8

The editor's `beforeunload` handler vetoed closing with unsaved changes, but
Electron does not display Chromium's usual confirmation automatically. The
desktop wrapper now handles `will-prevent-unload` with a parented native dialog.
Keep editing and dialog dismissal preserve the window; only Close without saving
overrides the veto. Recovery and renderer isolation remain enabled.

The Applications shortcut now uses a named hicolor icon with six small raster
sizes, the existing 256-pixel raster and the same scalable slate-blue SVG as the
application. The installer refreshes available Linux desktop/icon caches and
tracks icon checksums for safe upgrades and removal. An unrelated existing icon
blocks installation; a customized installed icon survives uninstall.

Validation:

- Node regression checks the default, dismissal and explicit close choices.
- Real bundled Electron checks the actual renderer unload lifecycle: cancel
  preserves project name and circuit, explicit close exits, recovery persists
  across restart, and Save locally permits closing without a prompt.
- Installer tests cover themed icon identity, upgrade, ownership conflicts and
  preservation of customized icons on uninstall.
- Full application regression and fresh packaged install/backend/uninstall checks
  run before release. The user's open instance is not restarted by installation.

Run the native lifecycle test with the bundled Electron executable:

```sh
STUDIO_ELECTRON=/path/to/electron node tests/run.cjs desktop-close.cjs
```

The test runner starts the server automatically. The test uses a temporary browser
profile and automates only the native dialog response; real Electron window and
renderer close events execute throughout.

References: [Electron will-prevent-unload](https://www.electronjs.org/docs/latest/api/web-contents#event-will-prevent-unload),
[Freedesktop icon theme specification](https://specifications.freedesktop.org/icon-theme/latest/).
