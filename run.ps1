# Smart AI Notes Assistant - Run Script
Write-Host "Starting Smart AI Notes Assistant..." -ForegroundColor Cyan

# Check if node_modules exists in backend, if not install
if (-Not (Test-Path "backend\node_modules")) {
    Write-Host "Installing backend dependencies..." -ForegroundColor Yellow
    cd backend
    npm install
    cd ..
}

# Start the server and open browser
Write-Host "Launching server on http://localhost:5000" -ForegroundColor Green
Start-Process "http://localhost:5000"
cd backend
npm start
