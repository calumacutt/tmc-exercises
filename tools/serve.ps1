# Local dev server. ES modules need an HTTP origin - file:// will not work.
# See CLAUDE.md section 3.
$root = Split-Path -Parent $PSScriptRoot
Write-Host "Serving $root at http://localhost:8000/" -ForegroundColor Green
Write-Host "  hub     http://localhost:8000/"
Write-Host "  wheel   http://localhost:8000/wheel/"
Write-Host "  builder http://localhost:8000/builder/"
Set-Location $root
python -m http.server 8000
