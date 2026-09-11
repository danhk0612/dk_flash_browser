# DK Flash Browser 1.0.0 release checklist

## Release target

- Product: `DK Flash Browser`
- Version: `1.0.0`
- Runtime: Electron 6.1.12 / Chromium 76 generation
- Architecture: Windows x86 / PE32
- Flash baseline: Pepper Flash 29.0.0.140 x86, supplied locally by the user
- Branding: generated multi-size `DKFlashBrowser.ico`, embedded into the executable during packaging

## Build

From the repository root on Windows:

```powershell
Get-Process DKFlashBrowser -ErrorAction SilentlyContinue | Stop-Process -Force
powershell -ExecutionPolicy Bypass -File .\scripts\package-win32.ps1
```

Expected outputs:

```text
dist\DKFlashBrowser-win32-ia32\
dist\DKFlashBrowser-1.0.0-win32-ia32.zip
```

The packaging script generates the application ICO, downloads/caches Electron `rcedit` v2.0.0 x86 when needed, embeds the icon and version resources in `DKFlashBrowser.exe`, and copies `DKFlashBrowser.ico` beside the executable.

### Validation status

The pre-branding final Windows package build completed successfully on 2026-09-11. After the icon/resource change, one final rebuild is required to validate the branded executable/ZIP.

## Static validation

Run:

```powershell
powershell -ExecutionPolicy Bypass -File .\scripts\validate-portable.ps1
```

Required result:

```text
Static portable validation PASSED.
```

The validator must confirm:

- `DKFlashBrowser.exe` is x86/PE32;
- `Flash\pepflashplayer.dll` is x86/PE32;
- generated `DKFlashBrowser.ico` is a valid multi-size ICO;
- executable ProductName/FileVersion resources identify DK Flash Browser 1.0.0;
- `config.ini`, `UserData`, README, license/notices and application resources are present;
- `VERSION.txt` matches `resources\app\package.json`;
- portable user-data redirection is present;
- the persistent browser partition is present;
- packaged `main.js` references `DKFlashBrowser.ico` for the BrowserWindow.

### Previous validation status

The pre-branding package passed all prior static checks on 2026-09-11, including x86 executable/Flash validation, package version `1.0.0`, portable profile redirection, persistent session partition, and Flash DLL size 17,930,296 bytes.

The branded package must be rebuilt and the updated validator run once more before merge.

## Runtime smoke test

Launch:

```text
dist\DKFlashBrowser-win32-ia32\DKFlashBrowser.exe
```

Verify at minimum:

- startup succeeds with the valid Flash DLL;
- configured/default home page opens;
- ordinary page navigation works;
- Flash content renders and accepts normal interaction on the target legacy site;
- new/close/switch tab workflow works;
- bookmarks open, edit, create folders and close transient panels correctly;
- `Ctrl++`, `Ctrl+-`, `Ctrl+0` change/reset page zoom;
- toolbar zoom percentage follows the active tab;
- toolbar feature menu opens and shows image/Flash candidate download lists;
- window title follows the active tab page title;
- normal and hard reload work;
- browser closes without an unexpected native crash;
- Explorer executable icon, running-window/taskbar icon, and packaged ICO show the DK Flash Browser branding.

### Runtime status

The user confirmed the pre-branding 1.0.0 package workflows above were working correctly. After applying the final icon/resource branding, only a short regression run is required to confirm startup and branding did not disturb runtime behavior.

## Accepted limitations

- `Ctrl + mouse wheel` zoom is not supported in the target Electron 6 + BrowserView runtime.
- Pepper Flash native right-click menu is not extended; Flash download is provided only through the dedicated feature menu / `Ctrl+Shift+S` when an observable direct SWF URL exists.
- Flash-internal resources whose URLs are not visible to Chromium may not appear in the Flash download list.
- Current `_blank` / `window.open()` behavior routes requests into browser tabs.
- Real physical/VM 32-bit Windows execution is not claimed unless explicitly tested.

## Release approval

Do not merge T08 or publish/tag `v1.0.0` until the branded package rebuild, updated static validator, and short runtime/icon regression check are accepted.
