# DK Flash Browser task plan

Work is performed sequentially. Do not advance to the next task until the current task is validated or explicitly accepted.

## T01 — Flash PoC

Status: in progress

- Use official Electron 6.1.12 Windows x86 runtime.
- Load a locally supplied 32-bit `pepflashplayer.dll` 29.0.0.140.
- Read the initial URL from `config.ini`.
- Use a portable `UserData` directory beside the executable/project.
- Provide local bootstrap, development-run, and x86 package scripts.
- Validate executable launch and Flash rendering on the actual legacy site.
- Do not implement custom browser chrome or tabs yet.

## T02 — Minimal browser UI

- Custom application shell without Whale/Chrome UI.
- Address bar.
- Back, forward, reload.
- Custom product name and icon.

## T03 — Tabs

- Multiple independent tabs.
- New-tab button.
- Tab selection and close.
- URL/title synchronization.

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
- Keep the start URL editable without rebuilding.

## T07 — Real legacy-system validation

- Flash rendering and interaction.
- Login/session.
- Audio if used by the solution.
- Required upload/download behavior if used.
- New tabs/windows and long-running usage.

## T08 — Final packaging

- Remove unnecessary development artifacts.
- Final product name/icon.
- Produce portable ZIP layout.
- Final usage/build documentation.
- Version 1.0.0.
