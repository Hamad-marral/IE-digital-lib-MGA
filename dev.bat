@echo off
REM Development mode: API with auto-reload on :8000, Vite dev server with hot reload on :5173
cd /d "%~dp0"
start "IE API" cmd /k "cd backend && python -m uvicorn app.main:app --reload --port 8000"
start "IE UI" cmd /k "cd frontend && npm run dev"
