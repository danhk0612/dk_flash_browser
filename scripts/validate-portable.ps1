param(
    [string]$PackageDir,
    [switch]$PrepareIsolationCopies
)

$ErrorActionPreference = 'Stop'

$Root = Split-Path -Parent $PSScriptRoot
if (-not $PackageDir) {
    $PackageDir = Join-Path $Root 'dist\DKFlashBrowser-win32-ia32'
}
$PackageDir = [System.IO.Path]::GetFullPath($PackageDir)

function Assert-Exists([string]$Path, [string]$Label) {
    if (-not (Test-Path $Path)) {
        throw "Missing $Label`: $Path"
    }
    Write-Host "[OK] $Label`: $Path"
}

function Get-PeMachine([string]$Path) {
    $stream = [System.IO.File]::Open($Path, 'Open', 'Read', 'ReadWrite')
    try {
        $reader = New-Object System.IO.BinaryReader($stream)
        if ($reader.ReadUInt16() -ne 0x5A4D) {
            throw "Not an MZ executable: $Path"
        }
        $stream.Position = 0x3C
        $peOffset = $reader.ReadInt32()
        $stream.Position = $peOffset
        if ($reader.ReadUInt32() -ne 0x00004550) {
            throw "Invalid PE signature: $Path"
        }
        return $reader.ReadUInt16()
    }
    finally {
        $stream.Dispose()
    }
}

function Assert-X86Pe([string]$Path, [string]$Label) {
    Assert-Exists $Path $Label
    $machine = Get-PeMachine $Path
    if ($machine -ne 0x014C) {
        throw ("{0} is not x86/PE32. Machine=0x{1:X4}" -f $Label, $machine)
    }
    Write-Host "[OK] $Label is x86 (IMAGE_FILE_MACHINE_I386 / 0x014C)"
}

Write-Host "Validating portable package: $PackageDir"
Assert-Exists $PackageDir 'package directory'

$BrowserExe = Join-Path $PackageDir 'DKFlashBrowser.exe'
$FlashDll = Join-Path $PackageDir 'Flash\pepflashplayer.dll'
$Config = Join-Path $PackageDir 'config.ini'
$UserData = Join-Path $PackageDir 'UserData'
$AppDir = Join-Path $PackageDir 'resources\app'
$MainJs = Join-Path $AppDir 'main.js'
$License = Join-Path $PackageDir 'LICENSE-DKFlashBrowser.txt'
$Notices = Join-Path $PackageDir 'THIRD_PARTY_NOTICES.md'

Assert-X86Pe $BrowserExe 'DKFlashBrowser.exe'
Assert-X86Pe $FlashDll 'Pepper Flash DLL'
Assert-Exists $Config 'config.ini'
Assert-Exists $UserData 'portable UserData directory'
Assert-Exists $MainJs 'packaged application main.js'
Assert-Exists $License 'project license'
Assert-Exists $Notices 'third-party notices'

$mainText = Get-Content $MainJs -Raw
if ($mainText -notmatch "app\.setPath\('userData',\s*userDataPath\)") {
    throw 'Packaged main.js does not explicitly redirect Electron userData to the portable UserData path.'
}
Write-Host '[OK] packaged app redirects userData to the portable package root'

if ($mainText -notmatch 'persist:dk-flash-browser') {
    throw 'Packaged main.js does not contain the expected persistent browser partition.'
}
Write-Host '[OK] persistent browser session partition is configured'

$flashInfo = Get-Item $FlashDll
if ($flashInfo.Length -le 0) {
    throw 'Pepper Flash DLL is empty.'
}
Write-Host ("[OK] Flash DLL size: {0:N0} bytes" -f $flashInfo.Length)

if ($PrepareIsolationCopies) {
    $ValidationRoot = Join-Path $Root 'dist\portable-validation'
    $CopyA = Join-Path $ValidationRoot 'portable-A'
    $CopyB = Join-Path $ValidationRoot 'portable-B'

    if (Test-Path $ValidationRoot) {
        Remove-Item -Recurse -Force $ValidationRoot
    }
    New-Item -ItemType Directory -Force -Path $ValidationRoot | Out-Null
    Copy-Item $PackageDir $CopyA -Recurse -Force
    Copy-Item $PackageDir $CopyB -Recurse -Force

    Write-Host '[OK] prepared two independent portable copies:'
    Write-Host "     A: $CopyA"
    Write-Host "     B: $CopyB"
    Write-Host 'Manual isolation test: configure/use A, close it, then launch B and verify A history/login/bookmarks are not present in B.'
}

Write-Host ''
Write-Host 'Static portable validation PASSED.'
Write-Host 'Runtime validation is still required on Windows: copied-folder launch, profile isolation, Flash, and x86 execution on target OS.'
