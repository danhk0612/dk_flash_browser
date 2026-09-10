# DK Flash Browser

32-bit Windows legacy browser shell for internal systems that still require Adobe Flash (PPAPI).

## Project goal

- Windows x86 runtime (also runnable on x64 Windows)
- Electron 6.1.12 / Chromium 76 generation
- External Pepper Flash plug-in loading
- Configurable start URL
- Portable profile stored beside the application
- Later stages: custom address bar, navigation controls, tabs, and legacy popup/new-window handling

## Current status

T01 Flash PoC is implemented on `task/t01-flash-poc` and is awaiting real Windows/legacy-site validation.

The first validation target is whether the existing 32-bit `pepflashplayer.dll` 29.0.0.140 used by the working Whale legacy package can run correctly inside Electron 6.1.12 x86.

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

### Update main later

```bat
cd /d D:\PortableApps\dk_flash_browser
git switch main
git pull --ff-only origin main
```

### Test the current T01 branch before merge

```bat
cd /d D:\PortableApps\dk_flash_browser
git fetch origin
git switch task/t01-flash-poc
git pull --ff-only origin task/t01-flash-poc
```

## T01 setup

1. Place the locally supplied 32-bit PPAPI Flash DLL at:

   ```text
   D:\PortableApps\dk_flash_browser\Flash\pepflashplayer.dll
   ```

2. Create the local configuration file:

   ```powershell
   Copy-Item .\config.example.ini .\config.ini
   notepad .\config.ini
   ```

3. Set the legacy site URL:

   ```ini
   [Browser]
   StartUrl=http://legacy-server/
   ```

4. Start the PoC:

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
