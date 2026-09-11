$ErrorActionPreference = 'Stop'

$Root = Split-Path -Parent $PSScriptRoot
$Bootstrap = Join-Path $PSScriptRoot 'bootstrap-electron.ps1'
$RuntimeDir = Join-Path $Root '.runtime\electron-v6.1.12-win32-ia32'
$FlashDll = Join-Path $Root 'Flash\pepflashplayer.dll'
$Config = Join-Path $Root 'config.ini'
$ConfigExample = Join-Path $Root 'config.example.ini'
$AppSource = Join-Path $Root 'src\app'
$AppManifest = Join-Path $AppSource 'package.json'
$DistRoot = Join-Path $Root 'dist'
$OutputDir = Join-Path $DistRoot 'DKFlashBrowser-win32-ia32'

if (-not (Test-Path $AppManifest)) {
    Write-Error "Missing app manifest: $AppManifest"
}

$Manifest = Get-Content $AppManifest -Raw | ConvertFrom-Json
$Version = [string]$Manifest.version
if (-not $Version) {
    Write-Error 'Application version is missing from src\app\package.json'
}

$ZipPath = Join-Path $DistRoot ("DKFlashBrowser-{0}-win32-ia32.zip" -f $Version)

& $Bootstrap

if (-not (Test-Path $FlashDll)) {
    Write-Error "Missing Flash DLL: $FlashDll"
}

if (Test-Path $OutputDir) {
    Remove-Item -Recurse -Force $OutputDir
}
if (Test-Path $ZipPath) {
    Remove-Item -Force $ZipPath
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
Copy-Item (Join-Path $Root 'README.md') (Join-Path $OutputDir 'README.md') -Force
Set-Content -Path (Join-Path $OutputDir 'VERSION.txt') -Value $Version -Encoding ASCII

Compress-Archive -Path (Join-Path $OutputDir '*') -DestinationPath $ZipPath -CompressionLevel Optimal -Force

Write-Host "Package ready: $OutputDir"
Write-Host "Executable: $BrowserExe"
Write-Host "Version: $Version"
Write-Host "Portable ZIP: $ZipPath"
