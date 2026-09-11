param(
    [switch]$PublicRelease
)

$ErrorActionPreference = 'Stop'

$Root = Split-Path -Parent $PSScriptRoot
$Bootstrap = Join-Path $PSScriptRoot 'bootstrap-electron.ps1'
$GenerateIcon = Join-Path $PSScriptRoot 'generate-icon.ps1'
$RuntimeDir = Join-Path $Root '.runtime\electron-v6.1.12-win32-ia32'
$ToolsDir = Join-Path $Root '.runtime\tools'
$BrandingDir = Join-Path $Root '.runtime\branding'
$IconPath = Join-Path $BrandingDir 'DKFlashBrowser.ico'
$RcEdit = Join-Path $ToolsDir 'rcedit-v2.0.0-x86.exe'
$RcEditUrl = 'https://github.com/electron/rcedit/releases/download/v2.0.0/rcedit-x86.exe'
$FlashDll = Join-Path $Root 'Flash\pepflashplayer.dll'
$Config = Join-Path $Root 'config.ini'
$ConfigExample = Join-Path $Root 'config.example.ini'
$AppSource = Join-Path $Root 'src\app'
$AppManifest = Join-Path $AppSource 'package.json'
$DistRoot = Join-Path $Root 'dist'

if (-not (Test-Path $AppManifest)) {
    Write-Error "Missing app manifest: $AppManifest"
}

$Manifest = Get-Content $AppManifest -Raw | ConvertFrom-Json
$Version = [string]$Manifest.version
if (-not $Version) {
    Write-Error 'Application version is missing from src\app\package.json'
}

if ($PublicRelease) {
    $OutputDir = Join-Path $DistRoot 'DKFlashBrowser-public-win32-ia32'
    $ZipPath = Join-Path $DistRoot ("DKFlashBrowser-{0}-win32-ia32-public.zip" -f $Version)
} else {
    $OutputDir = Join-Path $DistRoot 'DKFlashBrowser-win32-ia32'
    $ZipPath = Join-Path $DistRoot ("DKFlashBrowser-{0}-win32-ia32.zip" -f $Version)
}

& $Bootstrap
& $GenerateIcon -OutputPath $IconPath

if (-not $PublicRelease -and -not (Test-Path $FlashDll)) {
    Write-Error "Missing Flash DLL: $FlashDll"
}
if (-not (Test-Path $IconPath)) {
    Write-Error "Icon generation failed: $IconPath"
}

New-Item -ItemType Directory -Force -Path $ToolsDir | Out-Null
if (-not (Test-Path $RcEdit)) {
    Write-Host "Downloading Electron rcedit v2.0.0 x86: $RcEditUrl"
    $oldSecurityProtocol = [Net.ServicePointManager]::SecurityProtocol
    try {
        [Net.ServicePointManager]::SecurityProtocol = $oldSecurityProtocol -bor [Net.SecurityProtocolType]::Tls12
        Invoke-WebRequest -UseBasicParsing -Uri $RcEditUrl -OutFile $RcEdit
    }
    finally {
        [Net.ServicePointManager]::SecurityProtocol = $oldSecurityProtocol
    }
}
if (-not (Test-Path $RcEdit) -or (Get-Item $RcEdit).Length -lt 100000) {
    Write-Error "Invalid rcedit tool: $RcEdit"
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

Write-Host 'Applying DK Flash Browser executable icon and version resources...'
& $RcEdit $BrowserExe `
    --set-icon $IconPath `
    --set-version-string 'ProductName' 'DK Flash Browser' `
    --set-version-string 'FileDescription' 'DK Flash Browser' `
    --set-version-string 'InternalName' 'DKFlashBrowser' `
    --set-version-string 'OriginalFilename' 'DKFlashBrowser.exe' `
    --set-file-version $Version `
    --set-product-version $Version
if ($LASTEXITCODE -ne 0) {
    Write-Error "rcedit failed with exit code $LASTEXITCODE"
}

Copy-Item $IconPath (Join-Path $OutputDir 'DKFlashBrowser.ico') -Force

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
if ($PublicRelease) {
    $FlashNotice = @'
DK Flash Browser does not include Adobe Flash Player / Pepper Flash.

To use Flash content, the user must lawfully obtain a compatible 32-bit PPAPI
pepflashplayer.dll and place it in this folder with the exact filename:

    Flash\pepflashplayer.dll

The validated development baseline was Pepper Flash 29.0.0.140 x86.
Adobe Flash Player is third-party software and is not licensed or redistributed
under the DK Flash Browser MIT License.
'@
    Set-Content -Path (Join-Path $PackagedFlashDir 'README.txt') -Value $FlashNotice -Encoding UTF8
    Set-Content -Path (Join-Path $OutputDir 'PUBLIC_RELEASE.txt') -Value 'This public package intentionally excludes Adobe Flash Player / pepflashplayer.dll.' -Encoding UTF8
} else {
    Copy-Item $FlashDll (Join-Path $PackagedFlashDir 'pepflashplayer.dll') -Force
}

New-Item -ItemType Directory -Force -Path (Join-Path $OutputDir 'UserData') | Out-Null
Copy-Item (Join-Path $Root 'LICENSE') (Join-Path $OutputDir 'LICENSE-DKFlashBrowser.txt') -Force
Copy-Item (Join-Path $Root 'THIRD_PARTY_NOTICES.md') (Join-Path $OutputDir 'THIRD_PARTY_NOTICES.md') -Force
Copy-Item (Join-Path $Root 'README.md') (Join-Path $OutputDir 'README.md') -Force
Set-Content -Path (Join-Path $OutputDir 'VERSION.txt') -Value $Version -Encoding ASCII

Compress-Archive -Path (Join-Path $OutputDir '*') -DestinationPath $ZipPath -CompressionLevel Optimal -Force

Write-Host "Package ready: $OutputDir"
Write-Host "Executable: $BrowserExe"
Write-Host "Application icon: $(Join-Path $OutputDir 'DKFlashBrowser.ico')"
Write-Host "Version: $Version"
if ($PublicRelease) {
    Write-Host 'Mode: PUBLIC RELEASE (Flash DLL intentionally excluded)'
} else {
    Write-Host 'Mode: LOCAL VALIDATED PACKAGE (user-supplied Flash DLL included locally)'
}
Write-Host "Portable ZIP: $ZipPath"
