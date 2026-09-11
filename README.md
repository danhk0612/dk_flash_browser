# DK Flash Browser

Portable 32-bit Windows browser shell for isolated legacy systems that still require Adobe Flash (PPAPI/Pepper Flash).

## Version

Current release target: **1.0.0**

Runtime baseline:

- Electron 6.1.12
- Chromium 76 generation
- Windows x86 / 32-bit application
- Pepper Flash 29.0.0.140 supplied locally by the user

The application also runs on supported x64 Windows systems through WoW64.

## Main features

- Direct URL address bar
- Back / forward
- Normal reload and hard reload without cache
- Configurable Home/start page
- Multiple tabs
- Active page title synchronized to the native window title
- Portable local bookmark bar with folders, editing and drag/reorder
- Local portable browser profile and session persistence
- Best-effort image/media downloads
- Best-effort Flash SWF download list through the feature menu / `Ctrl+Shift+S` when direct SWF URLs are observable
- Page zoom with keyboard shortcuts and toolbar percentage display
- No Chrome sign-in, Google Sync, Chrome Web Store or account system

## Important limitations

- Pepper Flash owns its native right-click menu. DK Flash Browser does **not** inject a Flash-download action into that menu.
- `Ctrl + mouse wheel` zoom is not supported in the target Electron 6 + BrowserView environment. Use `Ctrl + +`, `Ctrl + -`, `Ctrl + 0`, or the toolbar feature menu.
- Flash download is best-effort. SWFs loaded internally by Flash without an observable direct URL may not appear in the download list.
- The current legacy popup implementation routes `target="_blank"` / `window.open()` into browser tabs.
- A physical/VM 32-bit Windows runtime test is not claimed unless explicitly performed.

## Security warning

This project intentionally uses end-of-life browser and plug-in technology for isolated legacy systems. It is **not intended for general Internet browsing**.

## Repository setup

Recommended local path:

```text
D:\PortableApps\dk_flash_browser
```

Clone:

```bat
D:
cd \PortableApps
git clone https://github.com/danhk0612/dk_flash_browser.git
cd dk_flash_browser
```

Update the main branch:

```bat
D:
cd \PortableApps\dk_flash_browser
git switch main
git pull --ff-only origin main
```

## Required local Flash component

This repository does **not** distribute Adobe Flash Player binaries.

Place the locally supplied 32-bit PPAPI Flash DLL at:

```text
Flash\pepflashplayer.dll
```

The expected release baseline is Pepper Flash `29.0.0.140` x86.

See `THIRD_PARTY_NOTICES.md` for licensing notes.

## Configuration

Create `config.ini` from the example when needed:

```powershell
Copy-Item .\config.example.ini .\config.ini
notepad .\config.ini
```

Default example:

```ini
[Browser]
StartUrl=https://html.duckduckgo.com/html

[DefaultBookmarks]
Bookmark1=DuckDuckGo|https://html.duckduckgo.com/html
Bookmark2=Duck.ai|https://duck.ai/
```

`StartUrl` controls startup, Home / `Alt+Home`, and manually created new tabs.

Default bookmarks are seeded only when `UserData\bookmarks.json` does not exist. An existing empty bookmark file is treated as intentional user state.

See `docs\CONFIGURATION.md` for the full supported configuration contract.

## Development run

```powershell
powershell -ExecutionPolicy Bypass -File .\scripts\run-dev.ps1
```

The bootstrap script downloads the official Electron 6.1.12 Windows x86 runtime into `.runtime`. Node.js and npm are not required for normal development runs or packaging.

## Build the portable Windows package

Close all running DK Flash Browser processes first, then run:

```powershell
Get-Process DKFlashBrowser -ErrorAction SilentlyContinue | Stop-Process -Force
powershell -ExecutionPolicy Bypass -File .\scripts\package-win32.ps1
```

For version 1.0.0, the build produces:

```text
dist\DKFlashBrowser-win32-ia32\
dist\DKFlashBrowser-1.0.0-win32-ia32.zip
```

The portable directory contains the executable, local configuration, Flash DLL, portable profile directory, application resources, README, license/notices, and `VERSION.txt`.

`dist\` is ignored by Git.

## Validate the portable package

After packaging:

```powershell
powershell -ExecutionPolicy Bypass -File .\scripts\validate-portable.ps1
```

The validator checks:

- `DKFlashBrowser.exe` is x86/PE32
- Pepper Flash DLL is x86/PE32
- required portable files/directories exist
- packaged application version matches `VERSION.txt`
- portable user-data redirection is present
- persistent browser partition is present

To prepare two independent copies for profile-isolation testing:

```powershell
powershell -ExecutionPolicy Bypass -File .\scripts\validate-portable.ps1 -PrepareIsolationCopies
```

See `docs\PORTABLE_VALIDATION.md` and `docs\T07_VALIDATION.md` for the retained validation procedures.

## Browser controls

- Focus address bar: `Ctrl+L`
- Back / forward: toolbar buttons
- Reload: `F5` / `Ctrl+R`
- Hard reload: `Ctrl+F5` / `Ctrl+Shift+R`
- Home: `Alt+Home`
- Add/remove bookmark: `Ctrl+D`
- New tab: `Ctrl+T`
- Close active tab: `Ctrl+W`
- Next tab: `Ctrl+Tab`
- Previous tab: `Ctrl+Shift+Tab`
- Zoom in: `Ctrl++`
- Zoom out: `Ctrl+-`
- Reset zoom: `Ctrl+0`
- Flash download candidate list: `Ctrl+Shift+S`
- Feature menu: toolbar `⋮` button

The address-bar zoom indicator reflects the active BrowserView's actual zoom factor and can be clicked to reset to 100%.

## Portable data

Browser data stays beside the application under:

```text
UserData\
```

Bookmarks are stored in:

```text
UserData\bookmarks.json
```

Session-cookie compatibility data is stored in the same portable profile so validated legacy login sessions can survive browser restart when required by the target system.

## Diagnostics

Runtime diagnostics:

```text
Logs\browser.log
```

Native Electron/Chromium crash dumps:

```text
CrashDumps\
```

Useful log tags include:

- `CRASH-REPORTER`
- `FLASH-CHECK`
- `BROWSERVIEW-LIFECYCLE`
- `RENDERER-PROCESS-CRASHED`
- `GPU-PROCESS-CRASHED`
- `PROCESS-EXIT`
- `MAIN-UNCAUGHT`
- `MAIN-REJECTION`
- `ZOOM-KEY`

If an unexpected full-process exit occurs, preserve `Logs\browser.log` and the newest Crashpad dump before rebuilding or cleaning the package.

## License

Project source: MIT License. See `LICENSE`.

Adobe Flash Player is not included in this repository and remains subject to its own licensing terms.
