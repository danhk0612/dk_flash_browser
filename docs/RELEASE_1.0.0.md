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

PASS on 2026-09-11.

The final branded Windows package build completed successfully and produced both the portable directory and `DKFlashBrowser-1.0.0-win32-ia32.zip`.

## Static validation

Run:

```powershell
powershell -ExecutionPolicy Bypass -File .\scripts\validate-portable.ps1
```

Required result:

```text
Static portable validation PASSED.
```

The final branded package validator confirmed:

- `DKFlashBrowser.exe` is x86/PE32 (`IMAGE_FILE_MACHINE_I386 / 0x014C`);
- `Flash\pepflashplayer.dll` is x86/PE32 (`IMAGE_FILE_MACHINE_I386 / 0x014C`);
- `DKFlashBrowser.ico` is a valid multi-size ICO with 7 images;
- executable ProductName/FileVersion resources identify `DK Flash Browser 1.0.0`;
- `config.ini`, portable `UserData`, README, license/notices and application resources are present;
- packaged `main.js`, `bootstrap.js`, and `package.json` are present;
- `VERSION.txt` matches application version `1.0.0`;
- portable user-data redirection is configured in `bootstrap.js`;
- the persistent browser partition is configured;
- packaged `main.js` references `DKFlashBrowser.ico` for the BrowserWindow;
- Pepper Flash DLL size is 17,930,296 bytes.

Final result: **`Static portable validation PASSED.`**

## Runtime smoke test

Launch:

```text
dist\DKFlashBrowser-win32-ia32\DKFlashBrowser.exe
```

Validated/accepted browser workflows for the 1.0.0 release include:

- startup with the valid Flash DLL;
- configured/default home page;
- ordinary page navigation;
- Flash rendering and interaction on the target legacy site;
- tab create/switch/close workflow;
- bookmark open/edit/folder/outside-click behavior;
- `Ctrl++`, `Ctrl+-`, `Ctrl+0` zoom controls;
- toolbar zoom percentage synchronization;
- toolbar feature menu;
- active page title synchronization to the native window title;
- normal and hard reload;
- no recurrence of the previously reported BrowserView full-process crash during the accepted validation workflow.

The final branding change was followed by a successful branded-package rebuild and full static validation. No additional code-path changes were made after that validation except the validator correction that moved the portable user-data assertion from `main.js` to the actual bootstrap location.

## Accepted limitations

- `Ctrl + mouse wheel` zoom is not supported in the target Electron 6 + BrowserView runtime.
- Pepper Flash native right-click menu is not extended; Flash download is provided only through the dedicated feature menu / `Ctrl+Shift+S` when an observable direct SWF URL exists.
- Flash-internal resources whose URLs are not visible to Chromium may not appear in the Flash download list.
- Current `_blank` / `window.open()` behavior routes requests into browser tabs.
- Real physical/VM 32-bit Windows execution is not claimed unless explicitly tested.

## Release approval

T08 final packaging and validation are accepted for merge. Tagging/publishing `v1.0.0` is a separate release action and is not performed automatically by this checklist.
