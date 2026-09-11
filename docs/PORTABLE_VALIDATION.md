# Portable runtime validation

T05 validates that DK Flash Browser behaves as a real portable x86 application and keeps its browser profile beside the executable instead of writing the active profile into the user's normal Electron/Chrome locations.

## 1. Build the portable package

From the repository root:

```powershell
powershell -ExecutionPolicy Bypass -File .\scripts\package-win32.ps1
```

Expected output:

```text
dist\DKFlashBrowser-win32-ia32\
```

## 2. Run the static validator

```powershell
powershell -ExecutionPolicy Bypass -File .\scripts\validate-portable.ps1
```

The validator checks:

- `DKFlashBrowser.exe` exists and is x86 PE (`IMAGE_FILE_MACHINE_I386`, machine `0x014C`).
- `Flash\pepflashplayer.dll` exists and is x86 PE.
- `config.ini`, `UserData`, packaged `resources\app\main.js`, project license and third-party notices exist.
- the packaged application explicitly redirects Electron `userData` to the portable package directory.
- the shared persistent browser partition is configured.

A pass here does not replace actual Windows runtime testing.

## 3. Copied-folder execution

Copy the whole package directory to a different writable location, for example:

```text
D:\PortableApps\DKFlashBrowser-test\
```

Run only:

```text
DKFlashBrowser.exe
```

Do not run it from the source repository during this check.

Pass criteria:

- browser launches without Node, npm, PowerShell or the source repository.
- configured Home URL opens.
- Flash content still renders and accepts input.
- tabs, bookmarks, navigation, normal reload and hard reload work.
- `UserData` and `Logs` are created/updated inside the copied package directory.
- moving the folder again and launching from the new path still works.

## 4. Portable profile isolation

The validator can prepare two identical copies:

```powershell
powershell -ExecutionPolicy Bypass -File .\scripts\validate-portable.ps1 -PrepareIsolationCopies
```

This creates:

```text
dist\portable-validation\portable-A\
dist\portable-validation\portable-B\
```

Test procedure:

1. Launch `portable-A\DKFlashBrowser.exe`.
2. Add an obvious bookmark and, if safe, log into the legacy test site.
3. Close A completely.
4. Launch `portable-B\DKFlashBrowser.exe` without copying A's `UserData` over it.
5. Verify A's bookmark/history/login state is not present in B.
6. Close B and reopen A.
7. Verify A's state is still present in A.

This proves each portable directory owns its own browser profile.

## 5. 64-bit Windows host

Run the x86 package on a normal 64-bit Windows installation.

Pass criteria:

- `DKFlashBrowser.exe` launches normally under WoW64.
- Flash loads and works.
- no separate x64 runtime is required.
- browser features behave the same as the development validation already performed.

## 6. 32-bit Windows host

A real 32-bit Windows machine or VM is required for definitive validation. The package and bundled Electron runtime are x86, but that alone does not prove every runtime dependency behaves on the target OS.

Pass criteria:

- executable launches.
- Flash loads.
- target legacy site is usable.
- tabs/navigation/bookmarks/input/downloads operate normally.
- no x64 dependency error appears.

If no 32-bit Windows environment is available now, record this item as `not yet physically validated`; do not claim it passed based only on PE architecture inspection.

## 7. Acceptance record

Record these separately:

- Static x86/layout validation: PASS / FAIL
- Copied-folder launch: PASS / FAIL
- Profile isolation A/B: PASS / FAIL
- Windows x64 runtime: PASS / FAIL
- Windows x86 runtime: PASS / FAIL / NOT AVAILABLE
- Flash on packaged build: PASS / FAIL

T05 can be accepted with x86 runtime marked `NOT AVAILABLE` only if the limitation is explicitly carried forward to T07/T08 and the project does not claim physical 32-bit Windows validation.