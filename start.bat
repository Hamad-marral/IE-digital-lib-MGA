@echo off
REM Folder and Gauge Set Library - one-click start (serves API + UI on http://localhost:8000)
cd /d "%~dp0"
python -m pip install -q -r backend\requirements.txt
if not exist frontend\dist\index.html (
  pushd frontend
  call npm install
  call npm run build
  popd
)
cd backend
echo.
echo  Folder and Gauge Set Library running at http://localhost:8000   (login: admin@ie.local / admin123)
echo  Phones / other PCs on the same Wi-Fi or LAN can open (and QR codes use):
for /f "tokens=2 delims=:" %%a in ('ipconfig ^| findstr /c:"IPv4"') do for /f "tokens=*" %%b in ("%%a") do echo     http://%%b:8000
echo.
python -m uvicorn app.main:app --host 0.0.0.0 --port 8000
