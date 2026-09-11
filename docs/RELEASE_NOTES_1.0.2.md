# DK Flash Browser 1.0.2

DK Flash Browser 1.0.2 is a usability and compatibility update focused on browser identity, feature-menu controls, popup routing preferences, and bookmark favicon maintenance.

## Changes

- Added explicit browser identity tokens to the User-Agent while preserving the compatibility-critical Chromium `Chrome/<version>` token.
  - `DKFlashBrowser/1.0.2`
  - `Chromium/<version>`
- Moved the feature-menu button to the far right of the toolbar, immediately after the bookmark button.
- Expanded the feature menu with common browser actions:
  - Back / Forward
  - Reload
  - Hard reload / ignore cache
  - Home
  - New tab
  - Focus address bar
  - Toggle current-page bookmark
  - existing zoom controls
  - Flash download candidates
  - image download candidates
- Added a persistent `새창을 항상 새 탭으로 열기` option.
  - OFF: ordinary tab dispositions open as tabs and real popup/window.open requests keep separate popup windows.
  - ON: all new-window requests are forced into DK Flash Browser tabs.
  - The setting is stored under portable `UserData/browser-preferences.json`.
- Improved bookmark favicon maintenance.
  - Normal Chromium favicon updates continue to replace stored favicon URLs.
  - When a bookmarked HTTP/HTTPS site is visited, the browser also retries `<origin>/favicon.ico` if needed.
  - Retry requests use cache-busting so changed icons can be refreshed even when the URL itself is unchanged.
- Added `docs/OPTIMIZATION_RESEARCH.md` to retain the current package-size and memory observations as deferred research rather than an active optimization task.

## Flash requirement

Adobe Flash Player is not included with DK Flash Browser. To use Flash content, the user must lawfully obtain a compatible 32-bit PPAPI `pepflashplayer.dll` and place it at:

```text
Flash\pepflashplayer.dll
```

The validated development baseline is Pepper Flash `29.0.0.140` x86.

## Security

DK Flash Browser intentionally uses end-of-life browser and Flash technology for legacy-system compatibility. It is not intended for general web browsing. Security assessment, isolation, and use of the software remain the user's responsibility.
