$ErrorActionPreference = 'Stop'

$Root = Split-Path -Parent $PSScriptRoot
$Bootstrap = Join-Path $PSScriptRoot 'bootstrap-electron.ps1'
$RuntimeDir = Join-Path $Root '.runtime\electron-v6.1.12-win32-ia32'
$FlashDll = Join-Path $Root 'Flash\pepflashplayer.dll'
$Config = Join-Path $Root 'config.ini'
$ConfigExample = Join-Path $Root 'config.example.ini'
$AppSource = Join-Path $Root 'src\app'
$DistRoot = Join-Path $Root 'dist'
$OutputDir = Join-Path $DistRoot 'DKFlashBrowser-win32-ia32'

& $Bootstrap

if (-not (Test-Path $FlashDll)) {
    Write-Error "Missing Flash DLL: $FlashDll"
}

if (Test-Path $OutputDir) {
    Remove-Item -Recurse -Force $OutputDir
}

New-Item -ItemType Directory -Force -Path $OutputDir | Out-Null
Copy-Item (Join-Path $RuntimeDir '*') $OutputDir -Recurse -Force

$ElectronExe = Join-Path $OutputDir 'electron.exe'
$BrowserExe = Join-Path $OutputDir 'DKFlashBrowser.exe'
Rename-Item -Path $ElectronExe -NewName 'DKFlashBrowser.exe'

$PackagedAppDir = Join-Path $OutputDir 'resources\app'
New-Item -ItemType Directory -Force -Path $PackagedAppDir | Out-Null
Copy-Item (Join-Path $AppSource '*') $PackagedAppDir -Recurse -Force

if (Test-Path $Config) {
    Copy-Item $Config (Join-Path $OutputDir 'config.ini') -Force
} else {
    Copy-Item $ConfigExample (Join-Path $OutputDir 'config.ini') -Force
}

$PackagedFlashDir = Join-Path $OutputDir 'Flash'
New-Item -ItemType Directory -Force -Path $PackagedFlashDir | Out-Null
Copy-Item $FlashDll (Join-Path $PackagedFlashDir 'pepflashplayer.dll') -Force

New-Item -ItemType Directory -Force -Path (Join-Path $OutputDir 'UserData') | Out-Null
Copy-Item (Join-Path $Root 'LICENSE') (Join-Path $OutputDir 'LICENSE-DKFlashBrowser.txt') -Force
Copy-Item (Join-Path $Root 'THIRD_PARTY_NOTICES.md') (Join-Path $OutputDir 'THIRD_PARTY_NOTICES.md') -Force

Write-Host "Package ready: $OutputDir"
Write-Host "Executable: $BrowserExe"
