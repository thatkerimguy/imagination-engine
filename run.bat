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
  set "PORTS=4173 4174"
) else (
  set "URL=http://127.0.0.1:5173/"
  set "TASK=dev"
  set "PORTS=5173 5174"
)
title Imagination Engine - %TASK% - close this window to stop

call :need_node || goto :failed
call :need_pnpm || goto :failed

rem Servers left running (another run.bat window, a test run) hold the ports, and vite would
rem stop with "Port is already in use". If both answer, they are ours: just open the Player.
call :busy_ports %PORTS%
if errorlevel 2 (
  echo The servers are already running in another window. Opening the Player.
  start "" %URL%
  ping -n 4 127.0.0.1 >nul
  exit /b 0
)
if errorlevel 1 (
  echo One of the ports %PORTS% is taken by another program.
  echo Close it, or the other run.bat window, and run this again.
  goto :failed
)
rem Always install: it takes under a second when nothing changed, and picks up packages added
rem since the last run (a new workspace package or dependency), not just a missing node_modules.
call pnpm install --prefer-offline || goto :failed
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

rem Node.js 24 or newer (package.json "engines"). Offers to install the LTS release with winget.
:need_node
where node >nul 2>nul && node -e "process.exit(+process.versions.node.split('.')[0] < 24 ? 1 : 0)" && exit /b 0
where node >nul 2>nul && (echo Node.js 24 or newer is needed; this computer has:& node -v) || echo Node.js was not found.
where winget >nul 2>nul || (echo Install Node.js 24+ from https://nodejs.org and run this again.& exit /b 1)
choice /m "Install Node.js LTS with winget now"
if errorlevel 2 exit /b 1
winget install --id OpenJS.NodeJS.LTS --exact --source winget || exit /b 1
rem The installer changes PATH for new windows only, so add its folders to this one by hand.
set "PATH=%ProgramFiles%\nodejs;%APPDATA%\npm;%PATH%"
where node >nul 2>nul && node -e "process.exit(+process.versions.node.split('.')[0] < 24 ? 1 : 0)" && exit /b 0
echo Node.js was installed, but this window can't see it yet. Run this again.
exit /b 1

rem How many of the given ports on 127.0.0.1 already accept connections (as the exit code).
:busy_ports
node -e "const net=require('net');const ports=process.argv.slice(1);let busy=0,left=ports.length;const done=()=>{if(--left===0)process.exit(busy)};for(const p of ports){const s=net.connect(+p,'127.0.0.1');s.setTimeout(800);s.on('connect',()=>{busy++;s.destroy();done()});s.on('timeout',()=>{s.destroy();done()});s.on('error',done)}" %*
exit /b %errorlevel%

rem pnpm, at the version package.json names. npm installs it for this user, so no admin rights
rem are needed (corepack would need them, and newer Node releases no longer ship it).
:need_pnpm
where pnpm >nul 2>nul && exit /b 0
set "PM="
for /f "delims=" %%v in ('node -p "require('./package.json').packageManager.split('+')[0]"') do set "PM=%%v"
if not defined PM set "PM=pnpm"
echo pnpm was not found; installing %PM%.
rem pnpm runs fine without its install scripts, which newer npm skips with a long warning.
call npm install --global --loglevel=error %PM% || exit /b 1
set "PATH=%APPDATA%\npm;%PATH%"
where pnpm >nul 2>nul && exit /b 0
echo pnpm was installed, but this window can't see it yet. Run this again.
exit /b 1

:failed
rem Keep the window open so the error can be read.
echo.
echo Something went wrong; see the messages above.
pause
exit /b 1
