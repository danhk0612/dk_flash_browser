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

Status: configuration behavior validated; merge is temporarily blocked by browser-process crash investigation

- External configuration contract is intentionally minimal:
  - `[Browser] StartUrl=...`
- `StartUrl` controls startup, Home / Alt+Home, and manually created new tabs.
- Editing packaged `config.ini` requires only an application restart, not a rebuild.
- Unknown sections/keys are ignored; missing/empty value falls back to `about:blank`.

### Stability blocker discovered during T06 validation

The user reported intermittent full-process exits while:

- operating a Flash page;
- opening tabs / pressing Home on Naver Cafe;
- navigating between other Naver pages.

The exact action immediately before exit is not reliably reproducible. Because both Flash and ordinary modern pages can trigger it, T06 must not be merged as final until the browser-level crash is characterized.

Added diagnostic hardening:

- application now starts through `src/app/bootstrap.js`;
- Electron Crash Reporter is initialized before browser renderers are created;
- native crash dumps are stored locally under `CrashDumps/`;
- Electron 6 `renderer-process-crashed` events are logged globally;
- GPU crashes and main-process exit codes are logged;
- existing `Logs/browser.log` diagnostics remain active.

Relevant log tags:

- `CRASH-REPORTER`
- `RENDERER-PROCESS-CRASHED`
- `GPU-PROCESS-CRASHED`
- `PROCESS-EXIT`
- existing `RENDERER-CRASH`, `GPU-CRASH`, `MAIN-UNCAUGHT`, `MAIN-REJECTION`

Next validation:

- rebuild the packaged browser from the latest T06 branch;
- use the Flash site and ordinary external pages normally until either a crash occurs or reasonable use remains stable;
- if a full exit occurs, preserve `Logs/browser.log` and the contents of `CrashDumps/`;
- do not require an exact click sequence if it cannot be determined.

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
