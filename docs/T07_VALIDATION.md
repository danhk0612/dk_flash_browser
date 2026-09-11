# T07 — Real legacy-system validation

T07 validates the current browser against real legacy/Flash workflows before final packaging. This task is primarily runtime validation; changes should be limited to defects discovered by the checks below.

## Build baseline

Start from `task/t07-legacy-validation` and build the portable package:

```powershell
powershell -ExecutionPolicy Bypass -File .\scripts\package-win32.ps1
```

Use the generated `dist\DKFlashBrowser-win32-ia32` directory as the test package.

## A. Startup / Flash preflight

1. Normal package with valid `Flash\pepflashplayer.dll`:
   - browser starts;
   - no Flash error dialog;
   - homepage loads.
2. Rename/remove `Flash\pepflashplayer.dll`:
   - Flash error dialog appears;
   - normal browser window/page does not load;
   - `Logs\browser.log` contains `FLASH-CHECK`.
3. Restore the DLL and launch again:
   - browser starts normally.

Corrupt/wrong-architecture DLL can be recorded as `NOT TESTED` if no safe substitute DLL is available.

## B. Default configuration / first-run profile

For a clean package/profile, verify the default `config.ini` values are:

```ini
[Browser]
StartUrl=https://html.duckduckgo.com/html

[DefaultBookmarks]
Bookmark1=DuckDuckGo|https://html.duckduckgo.com/html
Bookmark2=Duck.ai|https://duck.ai/
```

Checks:

1. With no `UserData\bookmarks.json`, launch the browser.
   - DuckDuckGo and Duck.ai appear in the root bookmark bar.
2. Delete both bookmarks through the UI and restart.
   - they remain deleted because the existing empty bookmarks file represents intentional user state.
3. Delete `UserData\bookmarks.json` itself and restart.
   - both defaults are seeded again.
4. Blank/remove `StartUrl` in `config.ini` and restart.
   - browser uses `https://html.duckduckgo.com/html`;
   - fallback is written into `config.ini`.

## C. Legacy Flash system

Use the actual target legacy site/system.

Record PASS / FAIL / NOT USED for each applicable item:

- Flash area renders instead of showing a missing-plugin placeholder.
- Mouse interaction inside Flash works.
- Keyboard input/IME works where the application needs it.
- Flash navigation/action buttons work.
- Login succeeds.
- Login/session remains valid after ordinary navigation.
- Login/session survives full browser restart if expected by the site.
- Audio works when the legacy application uses audio.
- File upload works when required.
- Downloads work when required.
- Direct image/media downloads work when exposed by the page.
- `Ctrl+Shift+S` opens the detected Flash list rather than silently choosing one SWF.
- Multiple SWFs loaded through DOM or network requests appear as separate selectable entries when their URLs can be observed.
- The toolbar function menu exposes Flash and image download lists.

Pepper Flash's own native right-click menu is owned by the plugin. The attempted custom Flash-download injection into that menu was removed because it does not work reliably. Flash download is available only through the dedicated feature menu / `Ctrl+Shift+S`, and remains best-effort when a direct SWF URL is observable.

## D. Tabs / popup / zoom behavior

- Open several ordinary tabs.
- Open several legacy/Flash pages in separate tabs.
- Switch rapidly between tabs.
- Close tabs in different orders.
- Confirm no full-process exit occurs.
- Confirm address/title/favicons remain synchronized with the active tab.
- Confirm the native window title follows the active page as `페이지 제목 - DK Flash Browser`.
- Confirm each tab starts at 100% zoom.
- Confirm `Ctrl + +`, `Ctrl + -`, and `Ctrl + 0` adjust/reset zoom while the browser window is focused.
- Confirm the toolbar indicator follows the active BrowserView's actual zoom factor. The indicator is refreshed immediately on app-driven zoom and also polls the active BrowserView as a safety net.
- Confirm clicking the zoom indicator resets the active tab to 100%.
- Confirm the function menu can zoom in, zoom out, and reset to 100%.
- Confirm zoom remains independent when switching between tabs.
- Exercise target `_blank` / `window.open()` workflows used by the actual legacy site.

`Ctrl + mouse wheel` is best-effort only on this Electron 6 + Pepper Flash runtime. Electron can handle it only when Chromium receives a `zoom-changed` event; Pepper Flash may consume the wheel first, so Flash-area wheel zoom is not a completion requirement.

If a real legacy workflow requires a separate popup window rather than the current tab routing, record the exact workflow and URL/action; do not redesign popup behavior preemptively.

## E. Stability soak

Use the browser normally for at least 20–30 minutes with a mixture of:

- Flash interaction;
- page navigation;
- zoom changes;
- tab create/switch/close;
- Home/reload/hard reload;
- bookmark use;
- feature-menu Flash/image download list opening.

If the process exits unexpectedly, preserve:

```text
Logs\browser.log
```

and the newest Crashpad `.dmp` files reported by the runtime. Do not clean/rebuild the package before collecting them.

## F. 32-bit Windows runtime

If a real 32-bit Windows physical machine or VM is available, repeat at minimum startup + Flash rendering + login there.

If no such environment is available, record:

```text
NOT AVAILABLE
```

Do not claim physical 32-bit Windows validation from static PE inspection alone.

## Completion rule

T07 is complete when all applicable checks are PASS, or an explicitly accepted `NOT USED` / `NOT AVAILABLE`, and no unresolved full-process crash remains. Any discovered defect should be fixed on the T07 branch and rechecked before merging into `main`.
