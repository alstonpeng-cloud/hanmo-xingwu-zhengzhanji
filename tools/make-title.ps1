Add-Type -AssemblyName System.Drawing

$src = 'c:\Users\haoch\.trae-cn\attachments\30e02494-4587-4183-b022-ab7be5b5477d_96f6208c-8d79-4f6e-b4f6-35cff1f3fd5f_image.png'
$dstDir = Join-Path $PSScriptRoot '..\assets\ui'
New-Item -ItemType Directory -Force -Path $dstDir | Out-Null
$dst = Join-Path $dstDir 'title.png'

$img = [System.Drawing.Bitmap]::new($src)
$w = $img.Width
$h = $img.Height
$bmp = New-Object System.Drawing.Bitmap $w, $h, ([System.Drawing.Imaging.PixelFormat]::Format32bppArgb)

$minX = $w; $minY = $h; $maxX = -1; $maxY = -1
for ($y = 0; $y -lt $h; $y++) {
  for ($x = 0; $x -lt $w; $x++) {
    $c = $img.GetPixel($x, $y)
    $r = [int]$c.R; $g = [int]$c.G; $b = [int]$c.B
    $mx = [Math]::Max($r, [Math]::Max($g, $b))
    $mn = [Math]::Min($r, [Math]::Min($g, $b))
    $sat = $mx - $mn
    $a = 0
    if ($mn -lt 246 -or $sat -gt 12) {
      # 灰黑投影：低饱和且不亮 → 丢弃
      if ($sat -lt 22 -and $mx -lt 212) {
        $a = 0
      } else {
        # 以蓝通道估算金色笔画的白底透明度（纯白 b=255 → 0）
        $a = [Math]::Round((255 - $b) / (255 - 66) * 255)
        if ($sat -lt 26) {
          # 极浅的灰边再压一档，避免深色底上出现灰雾
          $a = [Math]::Round($a * 0.35)
        }
      }
    }
    if ($a -lt 0) { $a = 0 }
    if ($a -gt 255) { $a = 255 }
    if ($a -le 2) {
      $bmp.SetPixel($x, $y, [System.Drawing.Color]::FromArgb(0, $r, $g, $b))
    } else {
      $bmp.SetPixel($x, $y, [System.Drawing.Color]::FromArgb($a, $r, $g, $b))
      if ($x -lt $minX) { $minX = $x }
      if ($x -gt $maxX) { $maxX = $x }
      if ($y -lt $minY) { $minY = $y }
      if ($y -gt $maxY) { $maxY = $y }
    }
  }
}
$img.Dispose()

$pad = 3
$minX = [Math]::Max(0, $minX - $pad)
$minY = [Math]::Max(0, $minY - $pad)
$maxX = [Math]::Min($w - 1, $maxX + $pad)
$maxY = [Math]::Min($h - 1, $maxY + $pad)
$cw = $maxX - $minX + 1
$ch = $maxY - $minY + 1
$crop = $bmp.Clone([System.Drawing.Rectangle]::new($minX, $minY, $cw, $ch), $bmp.PixelFormat)
$bmp.Dispose()

# 放大 2 倍，保证手机 DPR 2~3 下标题边缘平滑
$ow = $cw * 2
$oh = $ch * 2
$out = New-Object System.Drawing.Bitmap $ow, $oh, ([System.Drawing.Imaging.PixelFormat]::Format32bppArgb)
$gfx = [System.Drawing.Graphics]::FromImage($out)
$gfx.CompositingMode = [System.Drawing.Drawing2D.CompositingMode]::SourceCopy
$gfx.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
$gfx.PixelOffsetMode = [System.Drawing.Drawing2D.PixelOffsetMode]::HighQuality
$gfx.DrawImage($crop, 0, 0, $ow, $oh)
$gfx.Dispose()
$crop.Dispose()
$out.Save($dst, [System.Drawing.Imaging.ImageFormat]::Png)
$out.Dispose()

"title.png = ${ow}x${oh} -> $dst"
