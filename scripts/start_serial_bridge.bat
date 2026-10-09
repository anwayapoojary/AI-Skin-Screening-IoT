@echo off
setlocal
cd /d "%~dp0\.."
python scripts\serial_bridge.py %*
