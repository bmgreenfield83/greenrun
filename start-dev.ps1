$ErrorActionPreference = "Stop"
$RepositoryRoot = Split-Path -Parent $MyInvocation.MyCommand.Path
Set-Location -LiteralPath $RepositoryRoot

if (-not (Get-Command npm.cmd -ErrorAction SilentlyContinue)) {
    Write-Error "npm.cmd was not found. Install Node.js 22.12 or newer and try again."
}

if (-not (Get-Command py.exe -ErrorAction SilentlyContinue)) {
    Write-Error "The Windows Python launcher was not found. Install Python 3.12 with the launcher enabled and try again."
}

& py.exe -3.12 -c "import uvicorn" 2>$null
if ($LASTEXITCODE -ne 0) {
    Write-Error 'Python 3.12 backend dependencies are missing. Run: py -3.12 -m pip install -e "backend[dev]"'
}

Write-Host "Starting frontend and backend on all network interfaces..."
Write-Host "Local frontend: http://localhost:5173"
npm.cmd run dev
