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

Status: complete and validated on Windows / real legacy site

- Use official Electron 6.1.12 Windows x86 runtime.
- Load a locally supplied 32-bit `pepflashplayer.dll` 29.0.0.140.
- Read the initial URL from `config.ini`.
- Use a portable `UserData` directory beside the executable/project.
- Provide local bootstrap, development-run, and x86 package scripts.
- Validate executable launch and Flash rendering on the actual legacy site.

## T02 — Browser UI baseline

Status: implementation complete; Windows revalidation required after input/bookmark fixes

- Custom application shell without Whale/Chrome UI.
- Product name: DK Flash Browser.
- Address bar.
- Back and forward.
- Normal reload.
- Hard reload / ignore cache.
- Home button.
- Local bookmark bar with add/remove.
- Bookmark right-click opens an explicit delete menu; right-click itself never deletes.
- Preserve user-entered address text while the current page is still loading or navigating.
- Explicit address-field text/caret colors.
- Keyboard shortcuts for address focus, bookmarks, reload, hard reload, and home.
- Guest shortcut interception only on non-composing key-down events to avoid interfering with text/IME input.
- Basic right-click download for direct link and image/media URLs.
- Standard cut/copy/paste/select-all context actions where applicable.
- Do not implement tabs in this task.

Revalidation before merge:

- Existing Flash content still renders and accepts input.
- Address text remains visible while typing and Enter navigates to the entered value.
- HTML input fields inside the legacy page accept normal text/IME input.
- Bookmark right-click shows `북마크 삭제` and does not remove the bookmark until selected.
- Home/back/forward/reload/hard reload work.
- Bookmark persistence works after restart.
- Browser shortcuts work while the page has focus.
- Link/image/SWF direct download works where the page exposes a downloadable URL.
- Packaged x86 build behaves the same as development run.

## T03 — Tabs

- Multiple independent tabs.
- New-tab button.
- Tab selection and close.
- URL/title synchronization.
- Preserve the T02 navigation, home, bookmarks, hard reload, and download behavior per active tab.

## T04 — Legacy popup / new-window behavior

- `target="_blank"`.
- `window.open()`.
- Required popup behavior for the target legacy solution.
- Preserve login/session state.

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
