@echo off
rem Runs the Player and the Studio locally for testing, in their own console window with the
rem server logs. Closing that window stops the servers.
rem   run.bat           dev servers with live reload (Player :5173, Studio :5174)
rem   run.bat preview   production build, served like a host would (Player :4173, Studio :4174)
setlocal
cd /d "%~dp0"

rem First pass: open a dedicated console window that runs this script again, then return.
rem conhost gives a plain window of its own, so closing it ends everything started in it.
if not "%IE_RUN_WINDOW%"=="1" (
  set "IE_RUN_WINDOW=1"
  start "" conhost.exe cmd /c ""%~f0" %*"
  exit /b 0
)

if /i "%~1"=="preview" (
  set "URL=http://127.0.0.1:4173/"
  set "TASK=preview"
) else (
  set "URL=http://127.0.0.1:5173/"
  set "TASK=dev"
)
title Imagination Engine - %TASK% - close this window to stop

where pnpm >nul 2>nul || (echo pnpm was not found. Install Node.js 24+ and run: corepack enable & goto :failed)
if not exist node_modules (
  call pnpm install || goto :failed
)
if "%TASK%"=="preview" (
  call pnpm build || goto :failed
)

rem Open the Player once the server has had a moment to start.
start "" /b cmd /c "ping -n 4 127.0.0.1 >nul & start "" %URL%"
echo Player: %URL%
echo Close this window (or press Ctrl+C) to stop the servers.
echo.
call pnpm %TASK%
set "CODE=%errorlevel%"
rem Stopping with Ctrl+C isn't an error (130, or STATUS_CONTROL_C_EXIT as a signed or unsigned code).
for %%c in (0 130 -1073741510 3221225786) do if "%CODE%"=="%%c" exit /b 0
goto :failed

:failed
rem Keep the window open so the error can be read.
echo.
echo Something went wrong; see the messages above.
pause
exit /b 1
