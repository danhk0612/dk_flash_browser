# DK Flash Browser 1.0.1

DK Flash Browser 1.0.1 is a maintenance release focused on public-package correctness and legacy popup compatibility.

## Changes

- Restored Pepper Flash registration at the earliest Electron startup stage so a valid user-supplied `Flash\pepflashplayer.dll` is actually loaded by Chromium.
- Public packages now always ship the repository default `config.ini` instead of accidentally copying a developer-local configuration.
- Public-package validation now checks both the default configuration and Pepper Flash startup registration.
- Legacy popup handling no longer forces every new-window request into a browser tab.
  - ordinary tab-style requests still open as DK Flash Browser tabs;
  - real `window.open()`/popup-style requests open as separate content-only windows;
  - popup windows share the same persistent browser session and Flash environment.
- Public release archives continue to exclude Adobe Flash Player / `pepflashplayer.dll`.

## Flash requirement

Adobe Flash Player is not included with DK Flash Browser. To use Flash content, the user must lawfully obtain a compatible 32-bit PPAPI `pepflashplayer.dll` and place it at:

```text
Flash\pepflashplayer.dll
```

The validated development baseline is Pepper Flash `29.0.0.140` x86.

## Security

DK Flash Browser intentionally uses end-of-life browser and Flash technology for legacy-system compatibility. It is not intended for general web browsing. Security assessment, isolation, and use of the software remain the user's responsibility.
