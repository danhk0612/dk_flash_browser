# DK Flash Browser 1.0.0 release checklist

## Release target

- Product: `DK Flash Browser`
- Version: `1.0.0`
- Runtime: Electron 6.1.12 / Chromium 76 generation
- Architecture: Windows x86 / PE32
- Flash baseline: Pepper Flash 29.0.0.140 x86, supplied locally by the user

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

### Validation status

Final Windows packaging was run successfully on 2026-09-11.

Confirmed output:

- `dist\DKFlashBrowser-win32-ia32` created;
- `dist\DKFlashBrowser-1.0.0-win32-ia32.zip` created;
- packaged version reported as `1.0.0`.

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
- `config.ini`, `UserData`, README, license/notices and application resources are present;
- `VERSION.txt` matches `resources\app\package.json`;
- portable user-data redirection is present;
- the persistent browser partition is present.

### Validation status

PASS on 2026-09-11.

Confirmed by the final Windows package validator:

- `DKFlashBrowser.exe` x86 / `IMAGE_FILE_MACHINE_I386 (0x014C)`;
- Pepper Flash DLL x86 / `IMAGE_FILE_MACHINE_I386 (0x014C)`;
- `config.ini` present;
- portable `UserData` directory present;
- packaged `main.js` and `package.json` present;
- `VERSION.txt`, README, license, and third-party notices present;
- package version metadata matches `1.0.0`;
- portable userData redirect present;
- persistent browser session partition present;
- Flash DLL size confirmed as 17,930,296 bytes;
- final result: `Static portable validation PASSED.`

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
- browser closes without an unexpected native crash.

Status: **PENDING final 1.0.0 packaged-runtime confirmation.**

## Accepted limitations

- `Ctrl + mouse wheel` zoom is not supported in the target Electron 6 + BrowserView runtime.
- Pepper Flash native right-click menu is not extended; Flash download is provided only through the dedicated feature menu / `Ctrl+Shift+S` when an observable direct SWF URL exists.
- Flash-internal resources whose URLs are not visible to Chromium may not appear in the Flash download list.
- Current `_blank` / `window.open()` behavior routes requests into browser tabs.
- Real physical/VM 32-bit Windows execution is not claimed unless explicitly tested.

## Release approval

Do not merge T08 or publish/tag `v1.0.0` until the final Windows packaged-runtime smoke test is accepted.
