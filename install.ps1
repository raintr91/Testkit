param(
  [string]$InstallDir = "$HOME\.testkit",
  [string]$Ref = "main",
  [ValidateSet("tests", "fe")]
  [string]$Type = "tests",
  [switch]$Uninstall
)

$ErrorActionPreference = "Stop"
$BinDir = "$HOME\.local\bin"

if ($Uninstall) {
  Remove-Item "$BinDir\testkit.cmd" -Force -ErrorAction SilentlyContinue
  Remove-Item "$BinDir\testkit-mcp.cmd" -Force -ErrorAction SilentlyContinue
  Remove-Item $InstallDir -Recurse -Force -ErrorAction SilentlyContinue
  Write-Host "Testkit uninstalled."
  exit 0
}

$TempDir = Join-Path ([System.IO.Path]::GetTempPath()) ("testkit-" + [guid]::NewGuid())
git clone --depth 1 --branch $Ref "https://github.com/raintr91/Testkit.git" $TempDir
Remove-Item $InstallDir -Recurse -Force -ErrorAction SilentlyContinue
Move-Item $TempDir $InstallDir
Push-Location $InstallDir
if (Get-Command pnpm -ErrorAction SilentlyContinue) {
  pnpm install
  pnpm build
} else {
  npm install
  npm run build
}
Pop-Location

New-Item -ItemType Directory -Force $BinDir | Out-Null
"@node `"$InstallDir\bin\testkit.mjs`" %*" |
  Set-Content "$BinDir\testkit.cmd"
"@node `"$InstallDir\bin\testkit-mcp.mjs`" %*" |
  Set-Content "$BinDir\testkit-mcp.cmd"

Write-Host "Installed Testkit. Next:"
Write-Host "  testkit init --type=$Type --yes"
