# PulseQuiz Startup Script
# Launches backend, starts ngrok, updates config, and deploys

param(
    [switch]$SkipDeploy,
    [int]$Port = 8000
)

$ErrorActionPreference = "Stop"
$ScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path

Write-Host "`n🎮 PulseQuiz Startup Script" -ForegroundColor Cyan
Write-Host "==========================`n" -ForegroundColor Cyan

# Check for ngrok
if (-not (Get-Command ngrok -ErrorAction SilentlyContinue)) {
    Write-Host "❌ ngrok not found. Install with: winget install ngrok.ngrok" -ForegroundColor Red
    exit 1
}

# Check for Python
if (-not (Get-Command python -ErrorAction SilentlyContinue)) {
    Write-Host "❌ Python not found. Please install Python." -ForegroundColor Red
    exit 1
}

# Step 1: Start the backend
Write-Host "🚀 Starting backend server on port $Port..." -ForegroundColor Yellow

$backendPath = Join-Path $ScriptDir "backend"
$backendJob = Start-Job -ScriptBlock {
    param($path, $port)
    Set-Location $path
    
    # Activate venv if it exists
    $venvActivate = Join-Path $path "venv\Scripts\Activate.ps1"
    if (Test-Path $venvActivate) {
        & $venvActivate
    }
    
    python -m uvicorn main:app --host 0.0.0.0 --port $port
} -ArgumentList $backendPath, $Port

# Wait for backend to start
Start-Sleep -Seconds 3

# Check if backend is running
try {
    $response = Invoke-WebRequest -Uri "http://localhost:$Port" -TimeoutSec 5 -ErrorAction SilentlyContinue
    Write-Host "✅ Backend is running" -ForegroundColor Green
} catch {
    Write-Host "⚠️  Backend may still be starting..." -ForegroundColor Yellow
}

# Step 2: Start ngrok
Write-Host "`n🌐 Starting ngrok tunnel..." -ForegroundColor Yellow

# Kill any existing ngrok processes
Get-Process ngrok -ErrorAction SilentlyContinue | Stop-Process -Force -ErrorAction SilentlyContinue
Start-Sleep -Seconds 1

# Start ngrok in background
$ngrokProcess = Start-Process ngrok -ArgumentList "http", $Port -PassThru -WindowStyle Hidden

# Wait for ngrok to establish tunnel
Start-Sleep -Seconds 3

# Step 3: Get ngrok URL from API
Write-Host "📡 Fetching ngrok URL..." -ForegroundColor Yellow

$maxRetries = 10
$ngrokUrl = $null

for ($i = 0; $i -lt $maxRetries; $i++) {
    try {
        $tunnels = Invoke-RestMethod -Uri "http://localhost:4040/api/tunnels" -TimeoutSec 5
        $ngrokUrl = ($tunnels.tunnels | Where-Object { $_.proto -eq "https" } | Select-Object -First 1).public_url
        
        if ($ngrokUrl) {
            break
        }
    } catch {
        Start-Sleep -Seconds 1
    }
}

if (-not $ngrokUrl) {
    Write-Host "❌ Failed to get ngrok URL. Make sure ngrok is authenticated." -ForegroundColor Red
    Write-Host "   Run: ngrok config add-authtoken <your-token>" -ForegroundColor Yellow
    Stop-Process -Id $ngrokProcess.Id -Force -ErrorAction SilentlyContinue
    Stop-Job $backendJob -ErrorAction SilentlyContinue
    exit 1
}

Write-Host "✅ ngrok URL: $ngrokUrl" -ForegroundColor Green

# Step 4: Update config.json
Write-Host "`n📝 Updating config.json..." -ForegroundColor Yellow

$configPath = Join-Path $ScriptDir "public\config.json"
$config = @{
    apiBaseUrl = $ngrokUrl
} | ConvertTo-Json -Depth 10

Set-Content -Path $configPath -Value $config -Encoding UTF8
Write-Host "✅ Config updated with ngrok URL" -ForegroundColor Green

# Step 5: Commit and push (unless skipped)
if (-not $SkipDeploy) {
    Write-Host "`n🚢 Deploying to GitHub Pages..." -ForegroundColor Yellow
    
    Set-Location $ScriptDir
    
    git add public/config.json
    $commitResult = git commit -m "Update API URL to $ngrokUrl" 2>&1
    
    if ($LASTEXITCODE -eq 0) {
        git push
        Write-Host "✅ Pushed to GitHub - deployment will start automatically" -ForegroundColor Green
        Write-Host "   View at: https://idealase.github.io/PulseQuiz/" -ForegroundColor Cyan
    } else {
        Write-Host "⚠️  No changes to commit (URL may be the same)" -ForegroundColor Yellow
    }
} else {
    Write-Host "`n⏭️  Skipping deploy (use without -SkipDeploy to auto-deploy)" -ForegroundColor Yellow
}

# Summary
Write-Host "`n" + "=" * 50 -ForegroundColor Cyan
Write-Host "🎉 PulseQuiz is ready!" -ForegroundColor Green
Write-Host "=" * 50 -ForegroundColor Cyan
Write-Host "`n📍 Local Backend:  http://localhost:$Port"
Write-Host "📍 Public URL:     $ngrokUrl"
Write-Host "📍 Frontend:       https://idealase.github.io/PulseQuiz/"
Write-Host "`n⚠️  Keep this window open to maintain the tunnel"
Write-Host "   Press Ctrl+C to stop everything`n"

# Keep script running and handle cleanup on exit
try {
    while ($true) {
        # Check if processes are still running
        if ($ngrokProcess.HasExited) {
            Write-Host "❌ ngrok has stopped" -ForegroundColor Red
            break
        }
        
        $jobState = Get-Job -Id $backendJob.Id | Select-Object -ExpandProperty State
        if ($jobState -eq "Failed" -or $jobState -eq "Stopped") {
            Write-Host "❌ Backend has stopped" -ForegroundColor Red
            break
        }
        
        Start-Sleep -Seconds 5
    }
} finally {
    Write-Host "`n🛑 Shutting down..." -ForegroundColor Yellow
    
    Stop-Process -Id $ngrokProcess.Id -Force -ErrorAction SilentlyContinue
    Stop-Job $backendJob -ErrorAction SilentlyContinue
    Remove-Job $backendJob -ErrorAction SilentlyContinue
    
    Write-Host "✅ Cleanup complete" -ForegroundColor Green
}
