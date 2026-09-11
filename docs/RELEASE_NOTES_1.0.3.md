# DK Flash Browser 1.0.3

DK Flash Browser 1.0.3 fixes the bookmark favicon regression introduced in 1.0.2 and integrates media downloads directly into the feature menu.

## Changes

- Integrated downloads into the feature menu as nested submenus.
  - `다운로드` now contains `Flash 다운로드` and `이미지 다운로드` candidate submenus.
  - Existing DOM and network candidate detection remains available.
  - `Ctrl+Shift+S` Flash download support remains available.
- Fixed bookmark favicon persistence and refresh behavior.
  - Removed the competing renderer-side direct writer for `UserData\bookmarks.json`.
  - Bookmark favicon persistence is again owned by the normal browser bookmark state path.
  - Page-declared favicon URLs are detected and forwarded through the existing `browser:favicon` update flow.
  - `/favicon.ico` is used only as a fallback when a matching bookmark has no stored favicon.
  - A generic fallback no longer overwrites an existing known/custom favicon.
  - Electron `page-favicon-updated` handling remains available for normal favicon changes.

## Flash requirement

Adobe Flash Player is not included with DK Flash Browser. To use Flash content, the user must lawfully obtain a compatible 32-bit PPAPI `pepflashplayer.dll` and place it at:

```text
Flash\pepflashplayer.dll
```

The validated development baseline is Pepper Flash `29.0.0.140` x86.

## Security

DK Flash Browser intentionally uses end-of-life browser and Flash technology for legacy-system compatibility. It is not intended for general web browsing. Security assessment, isolation, and use of the software remain the user's responsibility.
