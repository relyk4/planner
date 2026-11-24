@echo off
rem Start Planner on this machine. Open the address it prints in your browser.
cd /d "%~dp0"
where py >nul 2>nul
if %errorlevel%==0 (
  py -3 server.py %*
) else (
  python server.py %*
)
pause
