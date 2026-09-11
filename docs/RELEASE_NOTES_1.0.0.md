# DK Flash Browser 1.0.0

DK Flash Browser is a portable Windows x86 browser intended for isolated legacy environments that still depend on Adobe Flash / Pepper Flash.

## Important before use

- This application intentionally uses end-of-life browser and Flash technology. It is not intended for general-purpose Internet browsing.
- Security, deployment, network exposure, and use of the application are the user's responsibility.
- Adobe Flash Player / Pepper Flash is **not included** in this repository or release assets.
- Flash functionality requires the user to lawfully obtain a compatible 32-bit PPAPI `pepflashplayer.dll` and place it at:

```text
Flash\pepflashplayer.dll
```

The validated baseline used during development was Pepper Flash `29.0.0.140` x86.

## Highlights

- Portable 32-bit Windows browser package.
- Native PPAPI/Pepper Flash support through a user-provided DLL.
- Address bar, Back/Forward, normal reload, hard reload, Home, tabs, bookmarks, and local persistent session data.
- Bookmark folders, editing, drag/reorder, favicon handling, and outside-click panel closing.
- Page zoom with `Ctrl++`, `Ctrl+-`, and `Ctrl+0`, plus toolbar zoom display and menu controls.
- Best-effort image/media download support.
- Best-effort direct SWF candidate download through the feature menu / `Ctrl+Shift+S`.
- Custom DK Flash Browser executable/window/taskbar icon.
- Portable browser profile under `UserData\`.
- Command-line launch support:

```text
DKFlashBrowser.exe --start-maximized
DKFlashBrowser.exe "http://legacy-server/"
DKFlashBrowser.exe --start-maximized "http://legacy-server/"
```

A command-line URL affects only the initial tab. Home and later new tabs continue to use `[Browser] StartUrl` from `config.ini`.

## Configuration

Default configuration format:

```ini
[Browser]
StartUrl=https://html.duckduckgo.com/html

[DefaultBookmarks]
Bookmark1=DuckDuckGo|https://html.duckduckgo.com/html
Bookmark2=Duck.ai|https://duck.ai/
```

## Validated release baseline

The final 1.0.0 Windows package was built and statically validated as x86 / PE32. The accepted runtime validation covered ordinary navigation, real Flash rendering/interaction, tabs, bookmarks, zoom, reload, feature menu behavior, session persistence, launch arguments, and the previously addressed BrowserView stability issue.

## Known limitations

- `Ctrl + mouse wheel` zoom is not supported reliably in the target Electron 6 + BrowserView runtime.
- Pepper Flash's native right-click menu is not extended.
- Flash downloads are best-effort and require Chromium to observe the direct SWF URL.
- `_blank` / `window.open()` requests currently open as DK Flash Browser tabs.
- Physical/VM 32-bit Windows execution is not claimed unless separately tested.

## License

DK Flash Browser source code is licensed under the MIT License. See `LICENSE`.

Adobe Flash Player, Electron, Chromium, rcedit, and other third-party components are not relicensed by this project's MIT License and remain subject to their respective licenses and distribution terms. See `THIRD_PARTY_NOTICES.md`.
