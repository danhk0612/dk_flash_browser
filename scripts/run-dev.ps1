$ErrorActionPreference = 'Stop'

$Root = Split-Path -Parent $PSScriptRoot
$Bootstrap = Join-Path $PSScriptRoot 'bootstrap-electron.ps1'
$ElectronExe = Join-Path $Root '.runtime\electron-v6.1.12-win32-ia32\electron.exe'
$FlashDll = Join-Path $Root 'Flash\pepflashplayer.dll'
$Config = Join-Path $Root 'config.ini'
$ConfigExample = Join-Path $Root 'config.example.ini'
$AppDir = Join-Path $Root 'src\app'

& $Bootstrap

if (-not (Test-Path $FlashDll)) {
    Write-Error "Missing Flash DLL: $FlashDll"
}

if (-not (Test-Path $Config)) {
    Copy-Item $ConfigExample $Config
    Write-Host "Created config.ini from config.example.ini"
}

& $ElectronExe $AppDir
