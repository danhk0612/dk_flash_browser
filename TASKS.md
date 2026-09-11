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
- The user explicitly deferred reproduction of the external modern-site crash.

## T04 — Legacy popup / new-window behavior

Status: complete, user-accepted in current form, and merged

- Current implementation routes legacy `target="_blank"` / `window.open()` requests into DK Flash Browser tabs.
- User clarified that a future implementation may keep real window requests as lightweight content-only windows while ordinary tab requests remain tabs.
- No T04 rewrite is required unless a real legacy workflow breaks or the product is later refined to preserve the tab/window distinction.
- All routed content shares the same `persist:dk-flash-browser` session.
- Link and bookmark context menus include new-tab actions.

## T05 — Portable runtime validation

Status: complete, user-accepted, and merged

- Packaged executable and Flash DLL statically validated as x86 (`0x014C`).
- Portable package layout validation passed.
- Independent A/B portable profile isolation passed.
- Session-cookie compatibility layer added under each portable profile so tested legacy login survives restart.
- Physical 32-bit Windows validation: `NOT AVAILABLE` unless a real 32-bit machine/VM is later provided.
- Detailed validation procedure: `docs/PORTABLE_VALIDATION.md`.

## T06 — Configuration finalization

Status: implementation complete; awaiting acceptance

External configuration contract is intentionally minimal:

```ini
[Browser]
StartUrl=http://legacy-server/
```

- `Browser.StartUrl` controls startup, Home/Alt+Home, and the initial URL for manually created new tabs.
- Default is `about:blank` if the setting is absent or empty.
- `config.ini` is read at application startup from beside the portable executable/project root.
- Editing `config.ini` does not require rebuilding.
- Unknown sections/keys are ignored.
- Full contract: `docs/CONFIGURATION.md`.

No additional runtime knobs are exposed in T06. Flash/runtime/profile/session behavior stays fixed to avoid unsupported legacy-runtime combinations.

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
