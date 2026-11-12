@echo off
cd /d "%~dp0"
echo.
echo =========================================
echo      Die Lerninsel - Unterrichtsserver
 echo =========================================
echo.
echo Starte Server auf http://localhost:3000
 echo Dieses Fenster waehrend der Stunde offen lassen.
echo.
start "" "http://localhost:3000"
node server.mjs
pause
