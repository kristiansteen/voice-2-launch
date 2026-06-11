@echo off
echo Starting vimpl local dev servers...
echo.
echo  Backend  -> http://localhost:3001
echo  Frontend -> open frontend/index.html in Live Server (port 5500)
echo  Voice    -> http://localhost:5173
echo.

start "vimpl backend" cmd /k "cd /d %~dp0backend && npm run dev:local"
start "voice-2-launch" cmd /k "cd /d %~dp0voice-2-bpmn && npm run dev"

echo Done. Two terminal windows opened.
echo For the frontend, open frontend/index.html with VS Code Live Server.
pause
