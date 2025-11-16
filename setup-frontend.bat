@echo off
echo ======================================
echo Knowledge Search MVP - Frontend Setup
echo ======================================
echo.

echo Step 1: Installing frontend dependencies...
cd /d "%~dp0frontend"
npm install

if %errorlevel% neq 0 (
    echo.
    echo ERROR: Frontend installation failed!
    echo Please check if Node.js is installed and try again.
    pause
    exit /b 1
)

echo.
echo Step 2: Starting frontend development server...
echo Frontend will run on: http://localhost:3000
echo Make sure the backend is running on: http://localhost:4000
echo.
echo Press Ctrl+C to stop the server
echo.
npm run dev

echo.
echo Frontend stopped.
pause