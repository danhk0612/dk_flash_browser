# DK Flash Browser

32-bit Windows legacy browser shell for internal systems that still require Adobe Flash (PPAPI).

## Project goal

- Windows x86 runtime, also runnable on x64 Windows through WoW64.
- Electron 6.1.12 / Chromium 76 generation.
- External Pepper Flash plug-in loading.
- Configurable start/home URL.
- Portable profile stored beside the application.
- Lightweight standalone browser UI without Whale/Chrome service integration.
- Tabs, navigation, bookmarks, normal/hard reload and best-effort direct resource download.

## Current status

T01 through T05 are complete and merged. T06 finalizes the external configuration contract.

The current popup implementation routes `target="_blank"` / `window.open()` into browser tabs. A future refinement may preserve true window requests as lightweight content-only windows if a real legacy workflow requires that distinction.

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
D:
cd \PortableApps\dk_flash_browser
git switch main
git pull --ff-only origin main
```

## Local setup

1. Place the locally supplied 32-bit PPAPI Flash DLL at:

   ```text
   D:\PortableApps\dk_flash_browser\Flash\pepflashplayer.dll
   ```

2. Create `config.ini` if it does not already exist:

   ```powershell
   Copy-Item .\config.example.ini .\config.ini
   notepad .\config.ini
   ```

3. Set the legacy site URL:

   ```ini
   [Browser]
   StartUrl=http://legacy-server/
   ```

   `StartUrl` is the only supported external runtime setting. It controls startup, Home/Alt+Home, and manually created new tabs. Editing `config.ini` does not require rebuilding; restart the browser to apply the change. See `docs\CONFIGURATION.md`.

4. Start the development browser:

   ```powershell
   powershell -ExecutionPolicy Bypass -File .\scripts\run-dev.ps1
   ```

The first development run downloads the official Electron 6.1.12 Windows x86 runtime into `.runtime`. No Node.js or npm installation is required.

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

## Portable validation

After packaging, run:

```powershell
powershell -ExecutionPolicy Bypass -File .\scripts\validate-portable.ps1
```

To prepare two independent portable copies for profile-isolation testing:

```powershell
powershell -ExecutionPolicy Bypass -File .\scripts\validate-portable.ps1 -PrepareIsolationCopies
```

Detailed procedure: `docs\PORTABLE_VALIDATION.md`.

The tested legacy login is preserved across restart by a portable compatibility layer for session cookies. Each portable copy keeps its own data under its own `UserData` directory.

A real 32-bit Windows machine or VM is still required to claim physical 32-bit Windows runtime validation. Static x86 PE inspection alone is not treated as a runtime pass.

## Browser controls

- Address bar: `Ctrl+L`
- Back / forward
- Normal reload: `F5` / `Ctrl+R`
- Hard reload ignoring cache: `Ctrl+F5` / `Ctrl+Shift+R`
- Home: `Alt+Home`
- Bookmark add/remove: `Ctrl+D`
- New tab: `Ctrl+T`
- Close active tab: `Ctrl+W`
- Next/previous tab: `Ctrl+Tab` / `Ctrl+Shift+Tab`
- Right-click direct download for links and image/media URLs when exposed by the page

Bookmarks and browser data are local to the portable profile. No Chrome sign-in, synchronization, Web Store, or Google service is used.

## Diagnostics

Runtime diagnostics are written under:

```text
Logs\browser.log
```

The log includes main-process exceptions and renderer/GPU crash information intended for troubleshooting the intentionally old Chromium/Electron runtime.

## Important licensing note

This repository does **not** distribute Adobe Flash Player binaries. `pepflashplayer.dll` must be supplied locally by an authorized user. See `THIRD_PARTY_NOTICES.md`.

## Security note

This project intentionally uses end-of-life browser and plug-in technology for isolated legacy systems. It is not intended for general Internet browsing.
