@echo off
cd /d "%~dp0"
if not exist node_modules (
  echo Installing packages, first time only...
  call npm install
)
start "" /min cmd /c "timeout /t 8 >nul & start http://localhost:5050"
call npm start
pause
