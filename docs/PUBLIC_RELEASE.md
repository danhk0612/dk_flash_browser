# Public release packaging

Public GitHub release assets must **not** redistribute Adobe Flash Player / Pepper Flash.

DK Flash Browser source is MIT-licensed, but `pepflashplayer.dll` is third-party software and is not included under that license.

## Build a public package

From the repository root on Windows:

```powershell
Get-Process DKFlashBrowser -ErrorAction SilentlyContinue | Stop-Process -Force
powershell -ExecutionPolicy Bypass -File .\scripts\package-win32.ps1 -PublicRelease
```

Expected output:

```text
dist\DKFlashBrowser-public-win32-ia32\
dist\DKFlashBrowser-1.0.0-win32-ia32-public.zip
```

The public package intentionally contains:

```text
Flash\README.txt
PUBLIC_RELEASE.txt
```

and intentionally does **not** contain:

```text
Flash\pepflashplayer.dll
```

Users must lawfully obtain a compatible 32-bit PPAPI Flash DLL themselves and place it at `Flash\pepflashplayer.dll` after extracting the public package.

## Validate the public package

```powershell
powershell -ExecutionPolicy Bypass -File .\scripts\validate-portable.ps1 -PublicRelease
```

Required result:

```text
Static PUBLIC release validation PASSED.
```

The validator fails if `Flash\pepflashplayer.dll` is present in the public package, reducing the risk of accidentally publishing the locally supplied Flash binary.

## Local validated package

The existing local build remains available for development/validation:

```powershell
powershell -ExecutionPolicy Bypass -File .\scripts\package-win32.ps1
powershell -ExecutionPolicy Bypass -File .\scripts\validate-portable.ps1
```

That mode copies the user's local `Flash\pepflashplayer.dll` into the local output and must **not** be uploaded as a public GitHub release asset.
