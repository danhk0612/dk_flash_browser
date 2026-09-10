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

T01 Flash PoC is being implemented. The first validation target is whether the existing 32-bit `pepflashplayer.dll` used by the working Whale legacy package can run correctly inside Electron 6.1.12 x86.

## Important licensing note

This repository does **not** distribute Adobe Flash Player binaries. `pepflashplayer.dll` must be supplied locally by an authorized user. See `THIRD_PARTY_NOTICES.md`.

## Security note

This project intentionally uses end-of-life browser and plug-in technology for isolated legacy systems. It is not intended for general Internet browsing.
