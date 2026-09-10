# DK Flash Browser

32-bit Windows legacy browser shell for internal systems that still require Adobe Flash (PPAPI).

## Project goal

- Windows x86 runtime (also runnable on x64 Windows)
- Electron 6.1.12 / Chromium 76 generation
- External Pepper Flash plug-in loading
- Configurable start/home URL
- Portable profile stored beside the application
- Lightweight browser UI independent of Whale/Chrome services
- Address navigation, home, bookmarks, normal reload, hard reload, and direct-resource download support
- Later stages: multiple tabs and legacy popup/new-window handling

## Current status

T01 Flash PoC is complete and validated on the real Windows legacy environment.

T02 browser UI is implemented on `task/t02-browser-ui` and awaits Windows validation before merge.

## Browser behavior in T02

The current single-tab browser shell provides:

- Address bar with direct URL entry
- Back / forward
- Normal reload
- Hard reload that ignores cache
- Home button using `Browser.StartUrl`
- Local bookmark bar
- Bookmark add/remove using the star button or `Ctrl+D`
- Bookmark removal by right-clicking a bookmark-bar entry
- `Ctrl+L` address focus
- `F5` / `Ctrl+R` normal reload
- `Ctrl+F5` / `Ctrl+Shift+R` hard reload
- `Alt+Home` home navigation
- Basic right-click direct download for links and image/media source URLs
- Basic cut/copy/paste/select-all context actions

Bookmarks are stored locally in the portable `UserData` profile. No Chrome/Google account, synchronization, Chrome Web Store, or other Chrome service is used.

The right-click download feature depends on Chromium exposing a direct resource URL. Direct `.swf` links and normal image/media URLs can be saved when that URL is available. Flash content that does not expose a downloadable URL may not be capturable through the context menu.

## Local development folder

Recommended local path:

```text
D:\PortableApps\dk_flash_browser
```

### First clone

```bat
D:
cd \PortableApps
git clone https://github.com/danhk0612/dk_flash_browser.git
cd dk_flash_browser
```

### Update main

```bat
cd /d D:\PortableApps\dk_flash_browser
git switch main
git pull --ff-only origin main
```

### Test the current T02 branch before merge

```bat
cd /d D:\PortableApps\dk_flash_browser
git fetch origin
git switch task/t02-browser-ui
git pull --ff-only origin task/t02-browser-ui
```

## Local setup

1. Place the locally supplied 32-bit PPAPI Flash DLL at:

   ```text
   D:\PortableApps\dk_flash_browser\Flash\pepflashplayer.dll
   ```

2. Create the local configuration file if it does not already exist:

   ```powershell
   Copy-Item .\config.example.ini .\config.ini
   notepad .\config.ini
   ```

3. Set the legacy site URL. This is also the Home button target:

   ```ini
   [Browser]
   StartUrl=http://legacy-server/
   ```

4. Start the development build:

   ```powershell
   powershell -ExecutionPolicy Bypass -File .\scripts\run-dev.ps1
   ```

The first run downloads the official Electron 6.1.12 Windows x86 runtime into `.runtime`. No Node.js or npm installation is required.

## Build the local x86 portable package

```powershell
powershell -ExecutionPolicy Bypass -File .\scripts\package-win32.ps1
```

Output:

```text
dist\DKFlashBrowser-win32-ia32\
  DKFlashBrowser.exe
  config.ini
  Flash\pepflashplayer.dll
  UserData\
  resources\app\
  ... Electron runtime files
```

The generated package is local build output and is ignored by Git.

## T02 validation checklist

1. Existing Flash page still renders and accepts input.
2. Address bar loads a directly entered internal URL.
3. Back and forward buttons follow navigation history.
4. Home returns to `StartUrl`.
5. Normal reload works.
6. Hard reload button and `Ctrl+F5` / `Ctrl+Shift+R` reload the same page while ignoring cache.
7. Bookmark star adds/removes the current page and the bookmark bar survives restart through `UserData`.
8. `Ctrl+L`, `Ctrl+D`, reload shortcuts, and `Alt+Home` work while the web page itself has focus.
9. Right-click a direct image URL or link and confirm the download/save dialog works.
10. If the legacy system exposes a direct `.swf` link, right-click that link and confirm it can be saved.
11. Build the portable package and confirm the same behavior from `dist\DKFlashBrowser-win32-ia32\DKFlashBrowser.exe`.

## Important licensing note

This repository does **not** distribute Adobe Flash Player binaries. `pepflashplayer.dll` must be supplied locally by an authorized user. See `THIRD_PARTY_NOTICES.md`.

## Security note

This project intentionally uses end-of-life browser and plug-in technology for isolated legacy systems. It is not intended for general Internet browsing.
