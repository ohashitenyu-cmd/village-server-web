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
[IO.File]::WriteAllText("$root\village-server.html", $tpl.Replace('/*__BEERCSS__*/', $css).Replace('/*__MURANEKO__*/', $neko), $utf8)
"village-server.html: " + (Get-Item "$root\village-server.html").Length + " bytes"
