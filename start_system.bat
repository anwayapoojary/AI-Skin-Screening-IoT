@echo off
title AI Health Screening IoT System
echo ========================================================
echo       AI Health Screening IoT System Launcher
echo ========================================================
echo.

if exist .venv\Scripts\activate.bat (
    call .venv\Scripts\activate.bat
)

echo 1. Checking Python and dependencies...
python -c "import fastapi, uvicorn" 2>nul
if %errorlevel% neq 0 (
    echo [ERROR] Required packages not found. Please run: pip install -r backend\requirements.txt
    pause
    exit /b 1
)

echo 2. Getting Local IP Address for Web Access...
for /f "tokens=4" %%a in ('route print ^| findstr 0.0.0.0 ^| findstr /v "Default"') do set LOCAL_IP=%%a
echo.
echo ========================================================
echo  Access the Screening Web App from any browser/mobile:
echo    Local:   http://localhost:8000
echo    Network: http://%LOCAL_IP%:8000
echo ========================================================
echo.

echo 3. Starting Single-Port Server (Web App + REST API + WebSocket + USB)...
python -m uvicorn backend.app.main:app --host 0.0.0.0 --port 8000 --reload
pause
