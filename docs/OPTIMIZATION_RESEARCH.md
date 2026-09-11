# Optimization research

Status: research only / deferred

This document records the current package-size and memory observations so future optimization work can resume from measured data without turning it into an active implementation task now.

## Current observation

User-observed comparison on the same Windows system:

- DK Flash Browser installed/extracted size: approximately **161 MB**
- Whale comparison size: approximately **224 MB**
- DK Flash Browser memory on the same site: approximately **127 MB**
- Whale memory on the same site: approximately **105 MB**

Interpretation:

- package size is already materially smaller than the comparison browser;
- the memory gap is approximately 22 MB in the observed single-site case;
- the current Electron shell uses a renderer for the browser UI plus a BrowserView renderer for page content, so part of the difference is likely structural fixed overhead rather than easily removable application code;
- the current BrowserView destruction guard is intentionally retained because explicit runtime destruction previously caused native `0xC0000005` crashes in the target Electron 6 environment.

## Candidate work if optimization is revisited

1. Add repeatable process-level memory measurement using Electron process metrics and compare total child-process memory under fixed conditions.
2. Record startup, loaded-page, idle, multi-tab, and open/close-cycle memory baselines.
3. Analyze packaged file sizes and test removal of demonstrably unused locale/resources only when compatibility is preserved.
4. Investigate soft disposal of closed BrowserViews without reintroducing explicit runtime `webContents.destroy()`.
5. Measure background-tab timer/media/Flash behavior before considering throttling changes.
6. Test Chromium process-model flags only in isolated experiments; reject any option that affects Flash, login/session behavior, popup handling, IME, or stability.
7. Treat GPU disabling or aggressive process limitation as experimental only, not default behavior.

## Decision

No optimization implementation is scheduled at this time because the expected gain is modest relative to regression risk in a legacy Flash compatibility browser. Reopen this research only if one of the following becomes true:

- measurable memory growth or leak is reproduced during long sessions;
- closed tabs fail to release a meaningful amount of memory;
- package size becomes a practical distribution problem;
- a low-risk optimization with a clearly measured benefit is identified.

Any future optimization must be benchmarked before/after and must preserve the validated Flash, popup, session/login, IME, tab, and shutdown behavior.
