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

Status: complete, user-accepted, and merged

- One independent `BrowserView` per tab.
- All tabs share `persist:dk-flash-browser` cookies/storage/session.
- `+` new-tab button; new tabs open `Browser.StartUrl`.
- Tab selection and close.
- Active-tab URL/title/back/forward/loading state synchronization.
- T02 Home, bookmarks, normal/hard reload, Flash, context download and input behavior preserved per active tab.
- Ctrl+T: new tab.
- Ctrl+W: close active tab; closing the final tab closes the browser window.
- Ctrl+Tab / Ctrl+Shift+Tab: cycle tabs.
- Runtime stability logging/guards added for renderer/GPU/main-process failures.
- External modern-site crash reproduction was explicitly deferred by the user; diagnostics remain available under `Logs/browser.log`.

## T04 — Legacy popup / new-window behavior

Status: implementation complete; awaiting Windows validation

- Intercept legacy Chromium/Electron `new-window` requests from each tab.
- Route `target="_blank"` and `window.open()` requests into a DK Flash Browser tab instead of an unmanaged Electron window.
- Preserve the same `persist:dk-flash-browser` session, cookies and login state in routed tabs.
- Page link context menu includes `새 탭에서 링크 열기`.
- Bookmark context menu includes `새 탭에서 열기` and `북마크 삭제`.
- Log routed requests with the `NEW-WINDOW` tag in `Logs/browser.log`.

Windows validation before merge:

- Click a normal `target="_blank"` link and confirm it opens as a DK Flash Browser tab.
- Trigger a legacy `window.open()` popup and confirm it opens as a DK Flash Browser tab.
- Confirm the original tab remains intact after the new tab opens.
- Confirm login/session state is shared in the routed tab.
- Confirm Flash content works in a routed tab where applicable.
- Confirm link right-click -> `새 탭에서 링크 열기`.
- Confirm bookmark right-click -> `새 탭에서 열기` and `북마크 삭제`.
- Confirm input, Home, navigation and reload behavior remain stable after popup routing.
- If a legacy popup depends on `window.opener` or a returned popup handle and behaves differently, record the exact workflow before merge so it can be handled explicitly.

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
