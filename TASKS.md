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
- Best-effort right-click download for links and image/media source URLs.
- Best-effort Flash download through the dedicated feature menu / `Ctrl+Shift+S` when direct SWF URLs are observable; Pepper Flash's native context menu is not extended.
- No Chrome sign-in, Google synchronization, Chrome Web Store, or other Chrome service dependency.

## T01 — Flash PoC

Status: complete and validated

## T02 — Browser UI baseline

Status: complete, validated, and merged

## T03 — Tabs

Status: complete, user-accepted, and merged

- One independent `BrowserView` per tab.
- All tabs share `persist:dk-flash-browser` cookies/storage/session.
- Runtime crash logging remains available under `Logs/browser.log`.

## T04 — Legacy popup / new-window behavior

Status: complete, user-accepted in current form, and merged

- Current implementation routes legacy `target="_blank"` / `window.open()` requests into DK Flash Browser tabs.
- User clarified that a future implementation may keep real window requests as lightweight content-only windows while ordinary tab requests remain tabs.
- No T04 rewrite is required unless a real legacy workflow breaks or the product is later refined to preserve the tab/window distinction.
- All routed content shares the same `persist:dk-flash-browser` session.
- Link and bookmark context menus include new-tab actions.

## T05 — Portable runtime validation

Status: complete, user-validated, and merged

- Static x86 package validation passed.
- Portable A/B profile separation passed.
- Login persistence after restart passed after adding session-cookie compatibility storage.
- A real 32-bit Windows physical/VM runtime test is still `NOT AVAILABLE` unless performed later.

## T06 — Configuration finalization

Status: complete; user requested progression to T07

- `[Browser] StartUrl=...` controls startup, Home / Alt+Home, and manually created new tabs.
- Missing or empty `StartUrl` falls back to `https://html.duckduckgo.com/html` and is written into `config.ini`.
- Default packaged/example configuration:
  - `StartUrl=https://html.duckduckgo.com/html`
  - `Bookmark1=DuckDuckGo|https://html.duckduckgo.com/html`
  - `Bookmark2=Duck.ai|https://duck.ai/`
- `[DefaultBookmarks] BookmarkN=Title|URL` seeds root bookmarks only when `UserData\bookmarks.json` does not exist.
- An existing but empty bookmark file is treated as an intentional user state and is not reseeded.
- Deleting/resetting the bookmark file causes config defaults to be seeded again on the next launch.
- Startup Flash preflight validates `Flash\pepflashplayer.dll` existence, plausible size, PE header, and x86 machine type before normal browser code is loaded.
- Flash preflight failure displays an error and exits without loading any browser page.
- Editing packaged `config.ini` requires only an application restart, not a rebuild.

### Stability work completed during T06 validation

The user previously reported intermittent full-process exits while using both Flash and ordinary web pages. Two Crashpad dumps showed identical main/browser-process access violations at `DKFlashBrowser.exe+0x0189A4F6`.

Runtime BrowserView `webContents.destroy()` is therefore suppressed during normal use and cleanup is deferred to application/OS shutdown. After this change, the user reported that the forced exits no longer appeared during the tested workflows.

Additional T06 browser UI work includes:

- Chrome-like shrinking tab widths with favicon/title behavior;
- persistent bookmark favicon/address favicon support;
- bookmark folder tree, editing, dragging/reordering, and folder moves;
- bookmark-bar expansion UI rather than separate popup windows;
- bookmark storage in `UserData\bookmarks.json`;
- reduced tab/address visual flicker during navigation;
- bookmark panels close when interacting outside the bookmark UI, including page focus.

Diagnostic log tags remain available:

- `CRASH-REPORTER`
- `FLASH-CHECK`
- `BROWSERVIEW-LIFECYCLE`
- `RENDERER-PROCESS-CRASHED`
- `GPU-PROCESS-CRASHED`
- `PROCESS-EXIT`
- existing `RENDERER-CRASH`, `GPU-CRASH`, `MAIN-UNCAUGHT`, `MAIN-REJECTION`

T06 startup-default/Flash preflight runtime checks are carried forward into T07's real-system validation checklist rather than blocking progression.

## T07 — Real legacy-system validation

Status: complete and user-accepted; ready to merge

Validated/accepted outcomes:

- basic ordinary-page and Flash browsing behavior works in the user's target environment;
- bookmark transient panels close correctly for browser-chrome and BrowserView page interactions;
- bookmark edit/folder UI remains usable after the outside-click fix;
- active page title is synchronized to the native window title;
- `Ctrl + +`, `Ctrl + -`, and `Ctrl + 0` zoom controls work and the toolbar zoom indicator is synchronized to actual BrowserView zoom;
- the feature menu provides zoom controls plus Flash/image download candidate lists;
- Flash native right-click download injection was removed as unsupported; dedicated Flash download remains best-effort through the feature menu / `Ctrl+Shift+S`;
- `Ctrl + mouse wheel` zoom was tested and explicitly dropped because the Electron 6 + BrowserView runtime does not provide a reliable input path in the target environment;
- root bookmark drag/drop handlers no longer accumulate across repeated bookmark re-renders;
- no recurrence of the previously reported full-process BrowserView crash was reported during the accepted T07 usage.

Environment-dependent items that were not explicitly exercised are not claimed as validated. A real 32-bit Windows physical/VM runtime test remains `NOT AVAILABLE` unless performed later.

See `docs/T07_VALIDATION.md` for the retained validation checklist and limitations.

## T08 — Final packaging

Status: next after T07 merge

- Remove unnecessary development artifacts.
- Final product name/icon.
- Produce portable ZIP layout.
- Final usage/build documentation.
- Version 1.0.0.
