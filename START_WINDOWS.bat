@echo off
cd /d "%~dp0"
where node >nul 2>&1
if errorlevel 1 (
  echo Node.js is required. Install Node.js from https://nodejs.org/
  pause
  exit /b 1
)
start "Vexelbound Online" "http://localhost:3000"
node server.js
pause
