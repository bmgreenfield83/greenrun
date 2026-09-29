@echo off
setlocal
cd /d "%~dp0"

where npm.cmd >nul 2>nul
if errorlevel 1 (
  echo npm.cmd was not found. Install Node.js 22.12 or newer and try again.
  exit /b 1
)

where py.exe >nul 2>nul
if errorlevel 1 (
  echo The Windows Python launcher was not found. Install Python 3.12 with the launcher enabled and try again.
  exit /b 1
)

py.exe -3.12 -c "import uvicorn" >nul 2>nul
if errorlevel 1 (
  echo Python 3.12 backend dependencies are missing.
  echo Run: py -3.12 -m pip install -e "backend[dev]"
  exit /b 1
)

echo Starting frontend and backend on all network interfaces...
echo Local frontend: http://localhost:5173
npm.cmd run dev
