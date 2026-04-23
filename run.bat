@echo off
echo Starting Smart AI Notes Assistant...
cd backend
if not exist node_modules (
    echo Installing dependencies...
    call npm install
)
echo Launching server on http://localhost:5000
start http://localhost:5000
npm start
pause
