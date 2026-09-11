# Third-party notices

DK Flash Browser source code is licensed under the MIT License in this repository.

## Electron

The project uses the official Electron 6.1.12 Windows x86 runtime. Electron is distributed under its own MIT License. The downloaded Electron runtime also contains Chromium and other third-party components with their respective license notices.

The build scripts intentionally preserve the license files shipped in the official Electron runtime archive.

## Chromium

Chromium and its bundled components are subject to their respective open-source licenses. Those notices are supplied with the Electron runtime distribution.

## Electron rcedit

The Windows packaging script uses Electron's `rcedit` v2.0.0 x86 build as a **build-time tool only** to apply the DK Flash Browser icon and Windows version resources to `DKFlashBrowser.exe`.

The tool is downloaded into the local ignored `.runtime\tools` directory and is not copied into the portable package or release ZIP. `rcedit` is distributed by the Electron project under its own open-source license.

## Adobe Flash Player / Pepper Flash

Adobe Flash Player is not part of this repository's MIT-licensed source code.

This repository does not include, redistribute, or grant a license to `pepflashplayer.dll` or other Adobe Flash Player binaries. A user who is authorized to use an existing binary must place the 32-bit PPAPI plug-in locally at:

`Flash/pepflashplayer.dll`

Local build scripts may copy that user-supplied file into a local test/package output. It must not be committed to this repository or attached to public releases from this repository.
