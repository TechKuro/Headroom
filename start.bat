@echo off
cd /d "%~dp0"
start "" http://localhost:5173
npx vite --port 5173 --open
