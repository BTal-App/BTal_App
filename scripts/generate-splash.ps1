Add-Type -AssemblyName System.Drawing

$publicDir = Join-Path $PSScriptRoot '..\public'
$splashDir = Join-Path $publicDir 'splash'
$logoPath  = Join-Path $publicDir 'favicon.png'
$bgColor   = [System.Drawing.ColorTranslator]::FromHtml('#0a0e0c')

# Logo width as a fraction of min(splash width, splash height).
# 0.32 matches the in-browser HTML splash (clamp(110px, 32vw, 170px)).
# Instagram/X-style: small, centered on dark background.
$ratio = 0.34

$logo = [System.Drawing.Image]::FromFile($logoPath)

Get-ChildItem -Path $splashDir -Filter 'apple-splash-*.png' | ForEach-Object {
    if ($_.Name -match 'apple-splash-(\d+)-(\d+)\.png') {
        $w = [int]$matches[1]
        $h = [int]$matches[2]

        $bmp = New-Object System.Drawing.Bitmap($w, $h)
        $g   = [System.Drawing.Graphics]::FromImage($bmp)
        $g.Clear($bgColor)
        $g.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
        $g.SmoothingMode     = [System.Drawing.Drawing2D.SmoothingMode]::HighQuality
        $g.PixelOffsetMode   = [System.Drawing.Drawing2D.PixelOffsetMode]::HighQuality

        $logoSize = [int]([Math]::Min($w, $h) * $ratio)
        # Keep aspect ratio of the source logo (favicon is square, but be safe).
        $logoW = $logoSize
        $logoH = [int]($logoSize * ($logo.Height / $logo.Width))
        $x = [int](($w - $logoW) / 2)
        $y = [int](($h - $logoH) / 2)

        $g.DrawImage($logo, $x, $y, $logoW, $logoH)
        $g.Dispose()
        $bmp.Save($_.FullName, [System.Drawing.Imaging.ImageFormat]::Png)
        $bmp.Dispose()

        Write-Output "  ${w}x${h}  logo=${logoW}px  -> $($_.Name)"
    }
}

$logo.Dispose()
Write-Output 'Done.'
