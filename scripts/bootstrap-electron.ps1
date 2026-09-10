$ErrorActionPreference = 'Stop'

$Root = Split-Path -Parent $PSScriptRoot
$RuntimeBase = Join-Path $Root '.runtime'
$RuntimeDir = Join-Path $RuntimeBase 'electron-v6.1.12-win32-ia32'
$ZipPath = Join-Path $RuntimeBase 'electron-v6.1.12-win32-ia32.zip'
$ElectronExe = Join-Path $RuntimeDir 'electron.exe'
$DownloadUrl = 'https://github.com/electron/electron/releases/download/v6.1.12/electron-v6.1.12-win32-ia32.zip'

if (Test-Path $ElectronExe) {
    Write-Host "Electron runtime already exists: $RuntimeDir"
    exit 0
}

New-Item -ItemType Directory -Force -Path $RuntimeBase | Out-Null

if (-not (Test-Path $ZipPath)) {
    [Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12
    Write-Host 'Downloading Electron 6.1.12 win32-ia32...'
    Invoke-WebRequest -Uri $DownloadUrl -OutFile $ZipPath
}

if (Test-Path $RuntimeDir) {
    Remove-Item -Recurse -Force $RuntimeDir
}

New-Item -ItemType Directory -Force -Path $RuntimeDir | Out-Null
Expand-Archive -Path $ZipPath -DestinationPath $RuntimeDir -Force

Write-Host "Electron runtime ready: $RuntimeDir"
