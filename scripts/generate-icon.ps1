param(
    [string]$OutputPath
)

$ErrorActionPreference = 'Stop'

$Root = Split-Path -Parent $PSScriptRoot
if (-not $OutputPath) {
    $OutputPath = Join-Path $Root '.runtime\branding\DKFlashBrowser.ico'
}
$OutputPath = [System.IO.Path]::GetFullPath($OutputPath)
$OutputDir = Split-Path -Parent $OutputPath
New-Item -ItemType Directory -Force -Path $OutputDir | Out-Null

Add-Type -AssemblyName System.Drawing

function New-DkFlashIconPngBytes([int]$Size) {
    $bitmap = [System.Drawing.Bitmap]::new($Size, $Size, [System.Drawing.Imaging.PixelFormat]::Format32bppArgb)
    $graphics = [System.Drawing.Graphics]::FromImage($bitmap)
    try {
        $graphics.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::AntiAlias
        $graphics.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
        $graphics.PixelOffsetMode = [System.Drawing.Drawing2D.PixelOffsetMode]::HighQuality
        $graphics.Clear([System.Drawing.Color]::Transparent)

        $pad = [Math]::Max(1.0, $Size * 0.055)
        $outer = [System.Drawing.RectangleF]::new($pad, $pad, $Size - (2 * $pad), $Size - (2 * $pad))
        $outerBrush = [System.Drawing.Drawing2D.LinearGradientBrush]::new(
            $outer,
            [System.Drawing.Color]::FromArgb(255, 16, 54, 108),
            [System.Drawing.Color]::FromArgb(255, 5, 20, 52),
            45.0
        )
        try { $graphics.FillEllipse($outerBrush, $outer) } finally { $outerBrush.Dispose() }

        $ringInset = $Size * 0.105
        $ringRect = [System.Drawing.RectangleF]::new($ringInset, $ringInset, $Size - (2 * $ringInset), $Size - (2 * $ringInset))
        $ringWidth = [Math]::Max(1.0, $Size * 0.045)
        $ringPen = [System.Drawing.Pen]::new([System.Drawing.Color]::FromArgb(235, 112, 211, 255), $ringWidth)
        try { $graphics.DrawEllipse($ringPen, $ringRect) } finally { $ringPen.Dispose() }

        $globeInset = $Size * 0.18
        $globeRect = [System.Drawing.RectangleF]::new($globeInset, $globeInset, $Size - (2 * $globeInset), $Size - (2 * $globeInset))
        $globeBrush = [System.Drawing.Drawing2D.LinearGradientBrush]::new(
            $globeRect,
            [System.Drawing.Color]::FromArgb(255, 42, 176, 255),
            [System.Drawing.Color]::FromArgb(255, 0, 73, 170),
            90.0
        )
        try { $graphics.FillEllipse($globeBrush, $globeRect) } finally { $globeBrush.Dispose() }

        if ($Size -ge 24) {
            $gridWidth = [Math]::Max(1.0, $Size * 0.012)
            $gridPen = [System.Drawing.Pen]::new([System.Drawing.Color]::FromArgb(135, 205, 240, 255), $gridWidth)
            try {
                $graphics.DrawEllipse($gridPen, $globeRect)
                $middleY = $Size * 0.50
                $graphics.DrawArc($gridPen, $globeRect.X, $middleY - ($Size * 0.11), $globeRect.Width, $Size * 0.22, 0, 180)
                $graphics.DrawArc($gridPen, $globeRect.X, $middleY - ($Size * 0.11), $globeRect.Width, $Size * 0.22, 180, 180)
                $narrowX = $Size * 0.35
                $narrowWidth = $Size * 0.30
                $graphics.DrawEllipse($gridPen, $narrowX, $globeRect.Y, $narrowWidth, $globeRect.Height)
            } finally { $gridPen.Dispose() }
        }

        $shadow = [System.Drawing.SolidBrush]::new([System.Drawing.Color]::FromArgb(95, 0, 0, 0))
        try {
            $shadowRect = [System.Drawing.RectangleF]::new($Size * 0.43, $Size * 0.43, $Size * 0.42, $Size * 0.42)
            $graphics.FillEllipse($shadow, $shadowRect)
        } finally { $shadow.Dispose() }

        # Generic lightning conveys legacy/Flash content support without copying
        # the retired Adobe Flash Player logo.
        $points = [System.Drawing.PointF[]]@(
            [System.Drawing.PointF]::new($Size * 0.59, $Size * 0.29),
            [System.Drawing.PointF]::new($Size * 0.42, $Size * 0.55),
            [System.Drawing.PointF]::new($Size * 0.54, $Size * 0.55),
            [System.Drawing.PointF]::new($Size * 0.43, $Size * 0.80),
            [System.Drawing.PointF]::new($Size * 0.73, $Size * 0.48),
            [System.Drawing.PointF]::new($Size * 0.59, $Size * 0.48)
        )
        $boltRect = [System.Drawing.RectangleF]::new($Size * 0.40, $Size * 0.28, $Size * 0.35, $Size * 0.53)
        $boltBrush = [System.Drawing.Drawing2D.LinearGradientBrush]::new(
            $boltRect,
            [System.Drawing.Color]::FromArgb(255, 255, 231, 87),
            [System.Drawing.Color]::FromArgb(255, 255, 126, 30),
            90.0
        )
        try { $graphics.FillPolygon($boltBrush, $points) } finally { $boltBrush.Dispose() }

        $boltOutline = [System.Drawing.Pen]::new(
            [System.Drawing.Color]::FromArgb(235, 255, 255, 255),
            [Math]::Max(1.0, $Size * 0.018)
        )
        try { $graphics.DrawPolygon($boltOutline, $points) } finally { $boltOutline.Dispose() }

        $stream = [System.IO.MemoryStream]::new()
        try {
            $bitmap.Save($stream, [System.Drawing.Imaging.ImageFormat]::Png)
            return $stream.ToArray()
        } finally { $stream.Dispose() }
    }
    finally {
        $graphics.Dispose()
        $bitmap.Dispose()
    }
}

$sizes = @(16, 24, 32, 48, 64, 128, 256)
$images = @()
foreach ($size in $sizes) {
    $images += ,(New-DkFlashIconPngBytes $size)
}

$file = [System.IO.File]::Open($OutputPath, [System.IO.FileMode]::Create, [System.IO.FileAccess]::Write)
$writer = [System.IO.BinaryWriter]::new($file)
try {
    # ICONDIR
    $writer.Write([UInt16]0)
    $writer.Write([UInt16]1)
    $writer.Write([UInt16]$sizes.Count)

    $offset = 6 + (16 * $sizes.Count)
    for ($i = 0; $i -lt $sizes.Count; $i++) {
        $size = $sizes[$i]
        $bytes = $images[$i]
        $dimension = if ($size -ge 256) { 0 } else { $size }
        $writer.Write([Byte]$dimension)
        $writer.Write([Byte]$dimension)
        $writer.Write([Byte]0)
        $writer.Write([Byte]0)
        $writer.Write([UInt16]1)
        $writer.Write([UInt16]32)
        $writer.Write([UInt32]$bytes.Length)
        $writer.Write([UInt32]$offset)
        $offset += $bytes.Length
    }

    foreach ($bytes in $images) {
        $writer.Write([Byte[]]$bytes)
    }
}
finally {
    $writer.Dispose()
    $file.Dispose()
}

Write-Host "Generated DK Flash Browser icon: $OutputPath"
