# PulseQuiz Self-Hosted Server Launcher
# Run this script to start the server

$ErrorActionPreference = "Stop"

Write-Host "`n🎮 PulseQuiz Server Setup" -ForegroundColor Cyan
Write-Host "========================`n" -ForegroundColor Cyan

# Check if we're in the right directory
$rootDir = Split-Path -Parent $MyInvocation.MyCommand.Path
Set-Location $rootDir

# Check if frontend is built
if (-not (Test-Path "dist")) {
    Write-Host "📦 Building frontend..." -ForegroundColor Yellow
    npm install
    npm run build
    Write-Host "✅ Frontend built!`n" -ForegroundColor Green
}

# Check if Python venv exists
if (-not (Test-Path "backend/venv")) {
    Write-Host "🐍 Creating Python virtual environment..." -ForegroundColor Yellow
    python -m venv backend/venv
    & backend/venv/Scripts/Activate.ps1
    pip install -r backend/requirements.txt
    Write-Host "✅ Python environment ready!`n" -ForegroundColor Green
} else {
    & backend/venv/Scripts/Activate.ps1
}

# Refresh PATH for cloudflared
$env:Path = [System.Environment]::GetEnvironmentVariable("Path","Machine") + ";" + [System.Environment]::GetEnvironmentVariable("Path","User")

# Check for --local flag
$useCloudflare = $args -notcontains "--local"

if ($useCloudflare -and (Get-Command cloudflared -ErrorAction SilentlyContinue)) {
    Write-Host "🚀 Starting PulseQuiz with Cloudflare Tunnel..." -ForegroundColor Green
    Write-Host "   Public URL: https://quiz.sandford.systems" -ForegroundColor White
    Write-Host "   Local URL:  http://localhost:8000`n" -ForegroundColor Gray
    
    # Start server in background
    $serverJob = Start-Job -ScriptBlock {
        Set-Location $using:rootDir
        & backend/venv/Scripts/Activate.ps1
        Set-Location backend
        python main.py
    }
    
    # Give server time to start
    Start-Sleep 2
    
    # Run tunnel (this blocks)
    try {
        cloudflared tunnel run --url http://localhost:8000 pulsequiz
    } finally {
        Stop-Job $serverJob -ErrorAction SilentlyContinue
        Remove-Job $serverJob -ErrorAction SilentlyContinue
    }
} else {
    Write-Host "🚀 Starting PulseQuiz (local only)..." -ForegroundColor Green
    Write-Host "   URL: http://localhost:8000`n" -ForegroundColor White
    
    Set-Location backend
    python main.py
}
