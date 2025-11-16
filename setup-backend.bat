@echo off
echo =====================================
echo Knowledge Search MVP - Quick Setup
echo =====================================
echo.

echo Step 1: Installing backend dependencies...
cd /d "%~dp0backend"
npm install

if %errorlevel% neq 0 (
    echo.
    echo ERROR: Backend installation failed!
    echo Please check if Node.js is installed and try again.
    pause
    exit /b 1
)

echo.
echo Step 2: Please add your OpenAI API key to backend\.env
echo.
echo 1. Open backend\.env in a text editor
echo 2. Replace 'your_openai_api_key_here' with your actual API key
echo 3. Save the file
echo.
echo You can get your API key from: https://platform.openai.com/api-keys
echo.
echo Press any key after you've added your API key...
pause >nul

echo.
echo Step 3: Starting backend server...
echo Backend will run on: http://localhost:4000
echo.
npm start

echo.
echo Backend stopped.
pause