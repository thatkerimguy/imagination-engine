@echo off
rem Publishes everything in two steps:
rem   1. Merges the current branch into "main" and pushes both to GitHub.
rem   2. Builds the Player from that and pushes it to the "deploy" branch.
rem The deploy branch holds only the files a host needs (index.html, assets, icons, service
rem worker), with no history of the source. Point the hosting site at that branch.
rem Merging happens in a separate folder, so this working tree only ever moves forward.
setlocal
cd /d "%~dp0"
set "BRANCH=deploy"
set "OUT=%~dp0.deploy"
set "MERGE=%~dp0.merge"
rem Opened by a double-click, the window would close before the result can be read.
set "HOLD="
echo %cmdcmdline% | find /i "/c" >nul && set "HOLD=1"

where git >nul 2>nul || (echo git was not found. & goto :failed)
where pnpm >nul 2>nul || (echo pnpm was not found. Run run.bat once to install it. & goto :failed)

for /f "delims=" %%b in ('git rev-parse --abbrev-ref HEAD') do set "CUR=%%b"
if "%CUR%"=="HEAD" (echo Check out a branch first: this is a detached HEAD. & goto :failed)
git diff --quiet HEAD -- || (echo There are uncommitted changes. Commit them first, so they reach main too. & goto :failed)

echo Getting the latest from GitHub...
git fetch -q origin || (echo Fetching from GitHub failed. & goto :failed)

if /i "%CUR%"=="main" (
  git merge -q --ff-only origin/main || (echo main on GitHub has changes this copy doesn't, and they can't be combined automatically. & goto :failed)
  git push -q origin main || (echo Pushing main failed. & goto :failed)
) else (
  call :merge_to_main || goto :failed
)
echo main is up to date on GitHub.

if not exist node_modules (
  call pnpm install || goto :failed
)
for /f %%i in ('git rev-parse --short HEAD') do set "SOURCE=%%i"

echo Building the Player...
call pnpm --filter @ie/player build || (echo Build failed. & goto :failed)

rem Check out the deploy branch in its own folder, so the working tree here is never touched.
if exist "%OUT%" git worktree remove --force "%OUT%" >nul 2>nul
if exist "%OUT%" rd /s /q "%OUT%"
git worktree prune
git fetch -q origin %BRANCH% >nul 2>nul
git show-ref --verify --quiet refs/remotes/origin/%BRANCH%
if not errorlevel 1 (
  git worktree add -q -B %BRANCH% "%OUT%" origin/%BRANCH% || goto :failed
) else (
  git show-ref --verify --quiet refs/heads/%BRANCH%
  if not errorlevel 1 (
    git worktree add -q "%OUT%" %BRANCH% || goto :failed
  ) else (
    git worktree add -q --orphan -b %BRANCH% "%OUT%" || goto :failed
  )
)

rem Mirror the build into it (source maps stay out; .git is the worktree link and must stay).
robocopy "apps\player\dist" "%OUT%" /MIR /XD .git /XF .git *.map /NFL /NDL /NJH /NJS /NP >nul
if errorlevel 8 (echo Copying the build failed. & goto :cleanup_failed)
rem No Jekyll on GitHub Pages: serve the files exactly as built.
type nul > "%OUT%\.nojekyll"
rem Store the built files byte for byte (no line-ending conversion).
echo * -text> "%OUT%\.gitattributes"

pushd "%OUT%"
git add -A
git diff --cached --quiet
if not errorlevel 1 (
  echo The built Player hasn't changed since the last publish.
  popd
  goto :cleanup
)
git commit -q -m "Publish Player from %SOURCE%" || (popd & goto :cleanup_failed)
git push -q -u origin %BRANCH% || (echo Pushing the deploy branch failed. & popd & goto :cleanup_failed)
popd
echo Published: main and the built "%BRANCH%" branch (Player from %SOURCE%).

:cleanup
git worktree remove --force "%OUT%" >nul 2>nul
if defined HOLD pause
endlocal
exit /b 0

:cleanup_failed
git worktree remove --force "%OUT%" >nul 2>nul
goto :failed

rem Merges %CUR% into main in a folder of its own, pushes both, then moves %CUR% up to main.
:merge_to_main
if exist "%MERGE%" git worktree remove --force "%MERGE%" >nul 2>nul
if exist "%MERGE%" rd /s /q "%MERGE%"
git worktree prune
git show-ref --verify --quiet refs/heads/main
if errorlevel 1 (
  git worktree add -q -b main "%MERGE%" origin/main || (echo Couldn't check out main. & exit /b 1)
) else (
  git worktree add -q "%MERGE%" main || (echo Couldn't check out main; is it open in another folder? & exit /b 1)
)
pushd "%MERGE%"
git merge -q --ff-only origin/main || (echo main here and main on GitHub have both changed; combine them by hand. & popd & goto :merge_failed)
echo Merging %CUR% into main...
git merge -q --no-edit "%CUR%" || (git merge --abort & echo %CUR% and main change the same lines; nothing was pushed. Merge them by hand. & popd & goto :merge_failed)
git push -q origin main || (echo Pushing main failed. & popd & goto :merge_failed)
popd
git worktree remove --force "%MERGE%" >nul 2>nul
rem Bring this branch up to main, so the build below is exactly what main holds.
git merge -q --ff-only main || (echo Couldn't move %CUR% up to main. & exit /b 1)
git push -q -u origin %CUR% || (echo Pushing %CUR% failed. & exit /b 1)
exit /b 0

:merge_failed
git worktree remove --force "%MERGE%" >nul 2>nul
exit /b 1

:failed
echo.
echo Nothing more was published; see the messages above.
if defined HOLD pause
endlocal
exit /b 1
