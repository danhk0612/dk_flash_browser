# DK Flash Browser

32-bit Windows legacy browser shell for internal systems that still require Adobe Flash (PPAPI).

## Project goal

- Windows x86 runtime (also runnable on x64 Windows)
- Electron 6.1.12 / Chromium 76 generation
- External Pepper Flash plug-in loading
- Configurable start URL
- Portable profile stored beside the application
- Lightweight standalone browser UI without Whale/Chrome service integration

## Current status

T01 Flash PoC is complete and validated on the real Windows legacy environment.

T02 browser UI is implemented on `task/t02-browser-ui` and is awaiting revalidation after two fixes:

- bookmark right-click now opens an explicit delete menu instead of deleting immediately;
- address edits are no longer overwritten by page navigation/loading events, and guest shortcut handling avoids IME composition events.

## T02 browser controls

- Address bar
- Back / forward
- Normal reload: `F5` / `Ctrl+R`
- Hard reload ignoring cache: `Ctrl+F5` / `Ctrl+Shift+R`
- Home: `Alt+Home`, using `Browser.StartUrl`
- Local bookmark bar: `Ctrl+D`
- Bookmark right-click: explicit `북마크 삭제` menu
- Basic right-click direct download for links and image/media URLs where exposed by the page

Bookmarks are stored only in the portable local profile. No Chrome sign-in, synchronization, Web Store, or Google service is used.

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

### Test the current T02 branch

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

3. Set the legacy site URL:

   ```ini
   [Browser]
   StartUrl=http://legacy-server/
   ```

4. Start the browser:

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

## Important licensing note

This repository does **not** distribute Adobe Flash Player binaries. `pepflashplayer.dll` must be supplied locally by an authorized user. See `THIRD_PARTY_NOTICES.md`.

## Security note

This project intentionally uses end-of-life browser and plug-in technology for isolated legacy systems. It is not intended for general Internet browsing.
