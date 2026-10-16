@echo off
setlocal

cd /d "%~dp0" || exit /b 1

if /I "%~1"=="" goto prerequisites
if /I "%~1"=="dev" goto prerequisites
if /I "%~1"=="check" goto prerequisites

echo Usage: run-local.cmd [dev^|check]
echo   dev    Start the app for manual browser testing ^(default^)
echo   check  Run lint and a production build without changing dist
exit /b 2

:prerequisites
where node >nul 2>&1
if errorlevel 1 (
    echo Node.js was not found. Install Node.js, then try again.
    exit /b 1
)
where npm.cmd >nul 2>&1
if errorlevel 1 (
    echo npm was not found. Install Node.js with npm, then try again.
    exit /b 1
)
if not exist "node_modules\vite\bin\vite.js" (
    echo Dependencies are missing. Run npm ci in this folder, then try again.
    exit /b 1
)

if /I "%~1"=="check" goto check
goto dev

:dev
if not exist ".env" echo Warning: .env is missing. Firebase sign-in and data will not work until it is configured.
echo.
echo Starting ClusterEye. Open the Local URL printed by Vite below.
echo It is usually http://localhost:3000/ but may use another port.
echo Press Ctrl+C to stop the server.
echo.
echo Manual smoke test: sign in, create a cluster, disk, node, and container;
echo then try search, sorting, editing, deleting, and the network view.
echo.
call npm.cmd run dev
exit /b %errorlevel%

:check
echo Running ESLint...
call npm.cmd run lint
if errorlevel 1 exit /b 1
echo.
echo Building into ignored node_modules\.clustereye-check ^(leaves dist unchanged^)...
call npm.cmd run build -- --outDir node_modules/.clustereye-check
if errorlevel 1 exit /b 1
echo.
echo Checks passed. Run run-local.cmd dev for manual browser testing.
exit /b 0
