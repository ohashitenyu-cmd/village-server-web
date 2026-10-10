# Build village-server.html from src/ and vendor/ (Beer CSS 5.0.3, MIT).
# Artifacts cannot load external stylesheets, so Beer CSS is inlined into the page.
$ErrorActionPreference = 'Stop'
$root = $PSScriptRoot
$utf8 = New-Object System.Text.UTF8Encoding($false)

$css = [IO.File]::ReadAllText("$root\vendor\beer.min.css", $utf8)
# Drop the bundled icon font faces (blocked in artifacts); the page loads Material Symbols Rounded from Google Fonts.
$css = [regex]::Replace($css, '@font-face\{[^}]*\}', '')
# Inline the mask used by the M3 wavy progress indicator.
$wavy = [IO.File]::ReadAllBytes("$root\vendor\wavy.svg")
$css = $css.Replace('url(wavy.svg)', 'url("data:image/svg+xml;base64,' + [Convert]::ToBase64String($wavy) + '")')

# Mugi, the chat avatar (mura-neko.js, a dependency-free Web Component). Inlined so the page stays one file;
# "</script" inside the file is escaped so it cannot close the inline script tag.
$neko = [IO.File]::ReadAllText("$root\vendor\mura-neko.js", $utf8).Replace('</script', '<\/script')

$tpl = [IO.File]::ReadAllText("$root\src\village-server.src.html", $utf8)
$page = $tpl.Replace('/*__BEERCSS__*/', $css).Replace('/*__MURANEKO__*/', $neko)
[IO.File]::WriteAllText("$root\village-server.html", $page, $utf8)
"village-server.html: " + (Get-Item "$root\village-server.html").Length + " bytes"

# index.html for GitHub Pages: the same page wrapped in the document skeleton the artifact host adds
# (doctype, charset, viewport and the same small reset), so both look the same.
$head = '<!doctype html><html lang="ja"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">' +
  '<meta name="description" content="ARK:SAとパルワールドのコミュニティ「Village Server」の公式サイト案（プロトタイプ）">' +
  '<link rel="icon" type="image/svg+xml" href="img/favicon.svg">' +
  '<style>:root{color-scheme:light;box-sizing:border-box;padding-top:env(safe-area-inset-top,0px);padding-bottom:env(safe-area-inset-bottom,0px)}body{margin:0;padding:0;font:14px -apple-system,BlinkMacSystemFont,sans-serif;background:#faf9f5;color:#141413}img{max-width:100%}[hidden]{display:none!important}</style></head><body>'
[IO.File]::WriteAllText("$root\index.html", $head + $page + '</body></html>', $utf8)
"index.html: " + (Get-Item "$root\index.html").Length + " bytes"
