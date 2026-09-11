# DK Flash Browser task plan

Work is performed sequentially. Do not advance to the next task until the current task is validated or explicitly accepted.

## Browser baseline requirements

The finished application must behave like a normal lightweight desktop browser while remaining independent of Chrome/Google services.

- Address bar with direct URL navigation.
- Back and forward navigation.
- Normal reload.
- Hard reload that reloads the current page while ignoring cache.
- Home button; Home uses `Browser.StartUrl` from `config.ini`.
- Local bookmark bar and local bookmark storage only; no account or sync service.
- Multiple tabs and new-tab workflow.
- Legacy `target="_blank"` / `window.open()` handling.
- Standard text edit/copy context actions where applicable.
- Best-effort right-click download for links and image/media source URLs, including `.swf` links when a direct URL is exposed.
- No Chrome sign-in, Google synchronization, Chrome Web Store, or other Chrome service dependency.

## T01 — Flash PoC

Status: complete and validated

## T02 — Browser UI baseline

Status: complete, validated, and merged

- Custom browser shell with address bar, navigation, normal/hard reload, Home, local bookmarks, context download and browser shortcuts.
- Native `BrowserView` page rendering preserves the input-stable path established after T01.
- Shared persistent browser session: `persist:dk-flash-browser`.

## T03 — Tabs

Status: implementation complete; awaiting Windows validation

- One independent `BrowserView` per tab.
- All tabs share `persist:dk-flash-browser` cookies/storage/session.
- `+` new-tab button; new tabs open `Browser.StartUrl`.
- Tab selection and close.
- Active-tab URL/title/back/forward/loading state synchronization.
- T02 Home, bookmarks, normal/hard reload, Flash, context download and input behavior preserved per active tab.
- Ctrl+T: new tab.
- Ctrl+W: close active tab; closing the final tab closes the browser window.
- Ctrl+Tab / Ctrl+Shift+Tab: cycle tabs.

Windows validation before merge:

- Create 3+ tabs and switch between them repeatedly.
- Confirm each tab preserves its own URL/history/page state.
- Confirm address/title/back/forward state changes with the active tab.
- Confirm Home, normal reload and hard reload act only on the active tab.
- Confirm Flash works in multiple tabs.
- Confirm legacy HTML/IME inputs remain stable in each tab.
- Confirm login/session is shared between tabs.
- Confirm bookmarks are shared browser-wide and open in the active tab.
- Confirm Ctrl+T, Ctrl+W, Ctrl+Tab and Ctrl+Shift+Tab work while the page has focus.
- Confirm closing the active tab selects the adjacent remaining tab.
- Confirm final-tab close exits the browser window.
- Confirm packaged x86 build behaves the same as development run.

## T04 — Legacy popup / new-window behavior

- `target="_blank"`.
- `window.open()`.
- Decide/open required requests as DK Flash Browser tab or managed browser window.
- Preserve shared login/session state.

## T05 — Portable runtime validation

- Verify copied-folder execution.
- Verify portable profile isolation.
- Verify on 32-bit Windows.
- Verify on 64-bit Windows using the same x86 build.

## T06 — Configuration finalization

- Finalize the minimal external configuration contract.
- Keep the start/home URL editable without rebuilding.

## T07 — Real legacy-system validation

- Flash rendering and interaction.
- Login/session.
- Audio if used by the solution.
- Required upload/download behavior if used.
- Right-click direct download for required SWF/image resources where the page exposes a downloadable URL.
- New tabs/windows and long-running usage.

## T08 — Final packaging

- Remove unnecessary development artifacts.
- Final product name/icon.
- Produce portable ZIP layout.
- Final usage/build documentation.
- Version 1.0.0.
