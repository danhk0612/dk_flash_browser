# Third-party notices

DK Flash Browser source code is licensed under the MIT License in this repository.

## Electron

The project uses the official Electron 6.1.12 Windows x86 runtime. Electron is distributed under its own MIT License. The downloaded Electron runtime also contains Chromium and other third-party components with their respective license notices.

The build scripts intentionally preserve the license files shipped in the official Electron runtime archive.

## Chromium

Chromium and its bundled components are subject to their respective open-source licenses. Those notices are supplied with the Electron runtime distribution.

## Adobe Flash Player / Pepper Flash

Adobe Flash Player is not part of this repository's MIT-licensed source code.

This repository does not include, redistribute, or grant a license to `pepflashplayer.dll` or other Adobe Flash Player binaries. A user who is authorized to use an existing binary must place the 32-bit PPAPI plug-in locally at:

`Flash/pepflashplayer.dll`

Local build scripts may copy that user-supplied file into a local test/package output. It must not be committed to this repository or attached to public releases from this repository.
