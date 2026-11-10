@echo off
rem Builds the Player and pushes it to the "deploy" branch on GitHub.
rem The deploy branch holds only the files a host needs (index.html, assets, icons, service
rem worker), with no history of the source. Point the hosting site at that branch.
setlocal
cd /d "%~dp0"
set "BRANCH=deploy"
set "OUT=%~dp0.deploy"

where pnpm >nul 2>nul || (echo pnpm was not found. & exit /b 1)
if not exist node_modules (
  call pnpm install || exit /b 1
)

for /f %%i in ('git rev-parse --short HEAD') do set "SOURCE=%%i"
git diff --quiet HEAD -- || set "SOURCE=%SOURCE% plus uncommitted changes"

echo Building the Player...
call pnpm --filter @ie/player build || (echo Build failed. & exit /b 1)

rem Check out the deploy branch in its own folder, so the working tree here is never touched.
if exist "%OUT%" git worktree remove --force "%OUT%" >nul 2>nul
if exist "%OUT%" rd /s /q "%OUT%"
git worktree prune
git fetch -q origin %BRANCH% >nul 2>nul
git show-ref --verify --quiet refs/remotes/origin/%BRANCH%
if not errorlevel 1 (
  git worktree add -q -B %BRANCH% "%OUT%" origin/%BRANCH% || exit /b 1
) else (
  git show-ref --verify --quiet refs/heads/%BRANCH%
  if not errorlevel 1 (
    git worktree add -q "%OUT%" %BRANCH% || exit /b 1
  ) else (
    git worktree add -q --orphan -b %BRANCH% "%OUT%" || exit /b 1
  )
)

rem Mirror the build into it (source maps stay out; .git is the worktree link and must stay).
robocopy "apps\player\dist" "%OUT%" /MIR /XD .git /XF .git *.map /NFL /NDL /NJH /NJS /NP >nul
if errorlevel 8 (echo Copying the build failed. & goto :cleanup)
rem No Jekyll on GitHub Pages: serve the files exactly as built.
type nul > "%OUT%\.nojekyll"
rem Store the built files byte for byte (no line-ending conversion).
echo * -text> "%OUT%\.gitattributes"

pushd "%OUT%"
git add -A
git diff --cached --quiet
if not errorlevel 1 (
  echo Nothing changed since the last publish.
  popd
  goto :cleanup
)
git commit -q -m "Publish Player from %SOURCE%" || (popd & goto :cleanup)
git push -q -u origin %BRANCH% || (echo Push failed. & popd & goto :cleanup)
popd
echo Published to the "%BRANCH%" branch (Player from %SOURCE%).

:cleanup
git worktree remove --force "%OUT%" >nul 2>nul
endlocal
