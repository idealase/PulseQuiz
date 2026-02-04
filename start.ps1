# PulseQuiz Startup Script
# Launches backend with either Cloudflare Tunnel (corporate-friendly) or ngrok

param(
    [switch]$UseNgrok,        # Use ngrok instead of Cloudflare Tunnel
    [switch]$SkipDeploy,      # Skip GitHub Pages deploy (ngrok mode only)
    [switch]$SkipBuild,       # Skip frontend build
    [int]$Port = 8000,
    [string]$Message = ""     # Custom message to display on home page
)

$ErrorActionPreference = "Stop"
$ScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path

Write-Host "`n🎮 PulseQuiz Startup Script" -ForegroundColor Cyan
Write-Host "==========================`n" -ForegroundColor Cyan

# Refresh PATH for cloudflared
$env:Path = [System.Environment]::GetEnvironmentVariable("Path","Machine") + ";" + [System.Environment]::GetEnvironmentVariable("Path","User")

if ($UseNgrok) {
    Write-Host "📡 Mode: ngrok + GitHub Pages" -ForegroundColor Yellow
} else {
    Write-Host "📡 Mode: Cloudflare Tunnel (corporate-friendly)" -ForegroundColor Green
}

# Check for required tools
if (-not $UseNgrok) {
    if (-not (Get-Command cloudflared -ErrorAction SilentlyContinue)) {
        Write-Host "❌ cloudflared not found. Install with: winget install Cloudflare.cloudflared" -ForegroundColor Red
        Write-Host "   Or use -UseNgrok flag to use ngrok instead" -ForegroundColor Yellow
        exit 1
    }
} else {
    if (-not (Get-Command ngrok -ErrorAction SilentlyContinue)) {
        Write-Host "❌ ngrok not found. Install with: winget install ngrok.ngrok" -ForegroundColor Red
        exit 1
    }
}

if (-not (Get-Command python -ErrorAction SilentlyContinue)) {
    Write-Host "❌ Python not found. Please install Python." -ForegroundColor Red
    exit 1
}

# Build frontend if needed (for Cloudflare mode)
if (-not $UseNgrok -and -not $SkipBuild) {
    $distPath = Join-Path $ScriptDir "dist"
    if (-not (Test-Path $distPath)) {
        Write-Host "📦 Building frontend..." -ForegroundColor Yellow
        Set-Location $ScriptDir
        npm install
        npm run build
        Write-Host "✅ Frontend built!" -ForegroundColor Green
    } else {
        Write-Host "✅ Frontend already built (use -SkipBuild or delete dist/ to rebuild)" -ForegroundColor Gray
    }
}

# Update config.json for self-hosted mode (empty = same-origin)
if (-not $UseNgrok) {
    $configPath = Join-Path $ScriptDir "public\config.json"
    $config = @{ apiBaseUrl = ""; customMessage = $Message } | ConvertTo-Json
    Set-Content -Path $configPath -Value $config -Encoding UTF8
    
    # Also update dist config if it exists
    $distConfigPath = Join-Path $ScriptDir "dist\config.json"
    if (Test-Path (Split-Path $distConfigPath)) {
        Set-Content -Path $distConfigPath -Value $config -Encoding UTF8
    }
    
    if ($Message) {
        Write-Host "📝 Custom message: $Message" -ForegroundColor Magenta
    }
}

# Step 1: Start the backend
Write-Host "`n🚀 Starting backend server on port $Port..." -ForegroundColor Yellow

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
    $response = Invoke-WebRequest -Uri "http://localhost:$Port/health" -TimeoutSec 5 -ErrorAction SilentlyContinue
    Write-Host "✅ Backend is running" -ForegroundColor Green
} catch {
    Write-Host "⚠️  Backend may still be starting..." -ForegroundColor Yellow
}

# ============================================
# CLOUDFLARE TUNNEL MODE (Corporate-friendly)
# ============================================
if (-not $UseNgrok) {
    Write-Host "`n🌐 Starting Cloudflare Tunnel..." -ForegroundColor Yellow
    
    # Start cloudflared tunnel
    $cloudflaredProcess = Start-Process cloudflared -ArgumentList "tunnel", "run", "--url", "http://localhost:$Port", "pulsequiz" -PassThru -WindowStyle Hidden
    
    Start-Sleep -Seconds 3
    
    Write-Host "✅ Cloudflare Tunnel connected" -ForegroundColor Green
    
    # Summary
    Write-Host "`n" + "=" * 50 -ForegroundColor Cyan
    Write-Host "🎉 PulseQuiz is ready!" -ForegroundColor Green
    Write-Host "=" * 50 -ForegroundColor Cyan
    Write-Host "`n📍 Local:   http://localhost:$Port"
    Write-Host "📍 Public:  https://quiz.sandford.systems" -ForegroundColor Green
    Write-Host "`n✅ Works on corporate networks (Zscaler)" -ForegroundColor Green
    Write-Host "⚠️  Keep this window open to maintain the connection"
    Write-Host "   Press Ctrl+C to stop everything`n"
    
    # Keep script running
    try {
        while ($true) {
            if ($cloudflaredProcess.HasExited) {
                Write-Host "❌ Cloudflare Tunnel has stopped" -ForegroundColor Red
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
        
        Stop-Process -Id $cloudflaredProcess.Id -Force -ErrorAction SilentlyContinue
        Stop-Job $backendJob -ErrorAction SilentlyContinue
        Remove-Job $backendJob -ErrorAction SilentlyContinue
        
        Write-Host "✅ Cleanup complete" -ForegroundColor Green
    }
}

# ============================================
# NGROK MODE (Original behavior)
# ============================================
else {
    Write-Host "`n🌐 Starting ngrok tunnel..." -ForegroundColor Yellow
    
    # Kill any existing ngrok processes
    Get-Process ngrok -ErrorAction SilentlyContinue | Stop-Process -Force -ErrorAction SilentlyContinue
    Start-Sleep -Seconds 1
    
    # Start ngrok in background
    $ngrokProcess = Start-Process ngrok -ArgumentList "http", $Port -PassThru -WindowStyle Hidden
    
    # Wait for ngrok to establish tunnel
    Start-Sleep -Seconds 3
    
    # Get ngrok URL from API
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
    
    # Update config.json
    Write-Host "`n📝 Updating config.json..." -ForegroundColor Yellow
    
    $configPath = Join-Path $ScriptDir "public\config.json"
    $config = @{
        apiBaseUrl = $ngrokUrl
    } | ConvertTo-Json -Depth 10
    
    Set-Content -Path $configPath -Value $config -Encoding UTF8
    Write-Host "✅ Config updated with ngrok URL" -ForegroundColor Green
    
    # Commit and push (unless skipped)
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
    Write-Host "📍 Public API:     $ngrokUrl"
    Write-Host "📍 Frontend:       https://idealase.github.io/PulseQuiz/"
    Write-Host "`n⚠️  May NOT work on corporate networks (Zscaler)" -ForegroundColor Yellow
    Write-Host "   Use without -UseNgrok for corporate compatibility"
    Write-Host "`n⚠️  Keep this window open to maintain the tunnel"
    Write-Host "   Press Ctrl+C to stop everything`n"
    
    # Keep script running
    try {
        while ($true) {
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
}
