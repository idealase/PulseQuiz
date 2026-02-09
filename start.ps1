# PulseQuiz Startup Script
# Launches backend with either Cloudflare Tunnel (corporate-friendly) or ngrok

param(
    [switch]$UseNgrok,        # Use ngrok instead of Cloudflare Tunnel
    [switch]$SkipDeploy,      # Skip GitHub Pages deploy (ngrok mode only)
    [switch]$SkipBuild,       # Skip frontend build
    [switch]$CleanRefresh,    # Force clean refresh of frontend/backend dependencies
    [switch]$VerboseLogging,  # Enable verbose backend + access logs
    [int]$Port = 8000,
    [string]$Message = ""     # Custom message to display on home page
)

$ErrorActionPreference = "Stop"
$ScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path

Write-Host "`n🎮 PulseQuiz Startup Script" -ForegroundColor Cyan
Write-Host "==========================`n" -ForegroundColor Cyan

# Load .env file if it exists
$envFile = Join-Path $ScriptDir ".env"
if (Test-Path $envFile) {
    Write-Host "📄 Loading .env file..." -ForegroundColor Gray
    Get-Content $envFile | ForEach-Object {
        if ($_ -match '^\s*([^#][^=]+)=(.*)$') {
            $name = $matches[1].Trim()
            $value = $matches[2].Trim()
            # Remove surrounding quotes if present
            if ($value -match '^["''](.*)["'']$') {
                $value = $matches[1]
            }
            [Environment]::SetEnvironmentVariable($name, $value)
            Write-Host "   Loaded: $name" -ForegroundColor DarkGray
        }
    }
}

# Refresh PATH for cloudflared
$env:Path = [System.Environment]::GetEnvironmentVariable("Path","Machine") + ";" + [System.Environment]::GetEnvironmentVariable("Path","User")

if ($UseNgrok) {
    Write-Host "📡 Mode: ngrok + GitHub Pages" -ForegroundColor Yellow
} else {
    Write-Host "📡 Mode: Cloudflare Tunnel (corporate-friendly)" -ForegroundColor Green
}

if ($VerboseLogging) {
    Write-Host "🗣️  Verbose logging: ENABLED" -ForegroundColor Magenta
}

# --- Environment Diagnostics ---
Write-Host "`n🔍 Environment Diagnostics" -ForegroundColor Cyan
Write-Host "─────────────────────────" -ForegroundColor Gray

# Python version
$pythonVersion = python --version 2>&1
Write-Host "🐍 Python: $pythonVersion" -ForegroundColor White

# Check for venv
$venvPath = Join-Path $ScriptDir "backend\venv"
if (Test-Path $venvPath) {
    Write-Host "📦 Virtual env: ✅ Found at backend/venv" -ForegroundColor Green
} else {
    Write-Host "📦 Virtual env: ⚠️ Not found (using system Python)" -ForegroundColor Yellow
}

# Check Copilot CLI
$copilotCli = Get-Command copilot -ErrorAction SilentlyContinue
if ($copilotCli) {
    $copilotVersion = copilot --version 2>&1
    Write-Host "🤖 Copilot CLI: ✅ $copilotVersion" -ForegroundColor Green
} else {
    Write-Host "🤖 Copilot CLI: ❌ Not found (AI features disabled)" -ForegroundColor Red
    Write-Host "   Install: https://docs.github.com/en/copilot/how-tos/set-up/install-copilot-cli" -ForegroundColor Gray
}

# Check environment variables
Write-Host "`n🔑 Environment Variables" -ForegroundColor Cyan
Write-Host "─────────────────────────" -ForegroundColor Gray

if ($env:QUIZ_AUTH_SECRET) {
    Write-Host "   QUIZ_AUTH_SECRET: ✅ Set (${($env:QUIZ_AUTH_SECRET.Length)} chars)" -ForegroundColor Green
} else {
    Write-Host "   QUIZ_AUTH_SECRET: ⚠️ Not set (AI endpoints unprotected!)" -ForegroundColor Yellow
}

if ($env:GITHUB_TOKEN) {
    Write-Host "   GITHUB_TOKEN: ✅ Set" -ForegroundColor Green
} elseif ($env:GH_TOKEN) {
    Write-Host "   GH_TOKEN: ✅ Set" -ForegroundColor Green
} else {
    Write-Host "   GITHUB_TOKEN: ℹ️ Not set (using Copilot CLI auth)" -ForegroundColor Gray
}

# Check for required tools
Write-Host "`n🛠️ Required Tools" -ForegroundColor Cyan
Write-Host "─────────────────────────" -ForegroundColor Gray

if (-not $UseNgrok) {
    if (-not (Get-Command cloudflared -ErrorAction SilentlyContinue)) {
        Write-Host "❌ cloudflared not found. Install with: winget install Cloudflare.cloudflared" -ForegroundColor Red
        Write-Host "   Or use -UseNgrok flag to use ngrok instead" -ForegroundColor Yellow
        exit 1
    }
    $cfVersion = cloudflared --version 2>&1
    Write-Host "☁️ Cloudflared: ✅ $cfVersion" -ForegroundColor Green
} else {
    if (-not (Get-Command ngrok -ErrorAction SilentlyContinue)) {
        Write-Host "❌ ngrok not found. Install with: winget install ngrok.ngrok" -ForegroundColor Red
        exit 1
    }
    $ngrokVersion = ngrok --version 2>&1
    Write-Host "🔗 ngrok: ✅ $ngrokVersion" -ForegroundColor Green
}

if (-not (Get-Command python -ErrorAction SilentlyContinue)) {
    Write-Host "❌ Python not found. Please install Python." -ForegroundColor Red
    exit 1
}

# Build frontend if needed (for Cloudflare mode)
if (-not $UseNgrok -and -not $SkipBuild) {
    $distPath = Join-Path $ScriptDir "dist"
    if ($CleanRefresh -and (Test-Path $distPath)) {
        Write-Host "Cleaning dist/ for fresh build..." -ForegroundColor Yellow
        Remove-Item -Recurse -Force $distPath
    }

    if (-not (Test-Path $distPath)) {
        Write-Host "📦 Building frontend..." -ForegroundColor Yellow
        Set-Location $ScriptDir
        if ($CleanRefresh) {
            Write-Host "Running npm install (clean refresh)..." -ForegroundColor Gray
        }
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

# Step 1: Kill any existing backend on this port, then start fresh
Write-Host "`n🚀 Starting Backend" -ForegroundColor Cyan
Write-Host "─────────────────────────" -ForegroundColor Gray

# Kill any existing process on the port
Write-Host "🔪 Checking for existing processes on port $Port..." -ForegroundColor Gray
$existingProcess = Get-NetTCPConnection -LocalPort $Port -ErrorAction SilentlyContinue | Select-Object -ExpandProperty OwningProcess -Unique
if ($existingProcess) {
    foreach ($procId in $existingProcess) {
        $proc = Get-Process -Id $procId -ErrorAction SilentlyContinue
        if ($proc) {
            Write-Host "   Killing process: $($proc.ProcessName) (PID: $procId)" -ForegroundColor Yellow
            Stop-Process -Id $procId -Force -ErrorAction SilentlyContinue
        }
    }
    Start-Sleep -Seconds 1  # Give it a moment to release the port
    Write-Host "   ✓ Port $Port cleared" -ForegroundColor Green
} else {
    Write-Host "   ✓ Port $Port is free" -ForegroundColor Green
}

$backendPath = Join-Path $ScriptDir "backend"
Write-Host "📂 Backend path: $backendPath" -ForegroundColor Gray

# Optional clean refresh for backend dependencies
if ($CleanRefresh) {
    Write-Host "Running backend dependency refresh..." -ForegroundColor Yellow
    $venvRoot = Join-Path $backendPath "venv"
    $venvPython = Join-Path $venvRoot "Scripts\python.exe"
    if (-not (Test-Path $venvPython)) {
        Write-Host "Creating backend virtual environment..." -ForegroundColor Gray
        Set-Location $backendPath
        python -m venv venv
    }

    $pipPath = Join-Path $venvRoot "Scripts\pip.exe"
    if (Test-Path $pipPath) {
        & $pipPath install -r (Join-Path $backendPath "requirements.txt")
    } else {
        Write-Host "Warning: venv pip not found; using system pip" -ForegroundColor Yellow
        pip install -r (Join-Path $backendPath "requirements.txt")
    }
}

# Check Python dependencies
Write-Host "📋 Checking Python dependencies..." -ForegroundColor Gray
$reqPath = Join-Path $backendPath "requirements.txt"
if (Test-Path $reqPath) {
    $reqs = Get-Content $reqPath | Where-Object { $_ -match "^\w" }
    Write-Host "   Dependencies in requirements.txt:" -ForegroundColor Gray
    foreach ($req in $reqs) {
        Write-Host "   - $req" -ForegroundColor DarkGray
    }
}

# Check if github-copilot-sdk is installed (package name is 'github-copilot-sdk' but imports as 'copilot')
Write-Host "📦 Checking Copilot SDK installation..." -ForegroundColor Gray
try {
    $venvPython = Join-Path $backendPath "venv\Scripts\python.exe"
    if (Test-Path $venvPython) {
        $sdkCheck = & $venvPython -c "import copilot; print(f'v{copilot.__version__}')" 2>&1
    } else {
        $sdkCheck = python -c "import copilot; print(f'v{copilot.__version__}')" 2>&1
    }
    if ($LASTEXITCODE -eq 0) {
        Write-Host "   ✅ Copilot SDK (github-copilot-sdk): $sdkCheck" -ForegroundColor Green
    } else {
        Write-Host "   ⚠️ Copilot SDK: Not installed" -ForegroundColor Yellow
        Write-Host "   Run: pip install github-copilot-sdk" -ForegroundColor Gray
        Write-Host "   Error: $sdkCheck" -ForegroundColor DarkGray
    }
} catch {
    Write-Host "   ⚠️ Could not check Copilot SDK: $_" -ForegroundColor Yellow
}

Write-Host "`n⚡ Starting uvicorn on port $Port..." -ForegroundColor Yellow

# Capture env vars to pass to job
$authSecret = $env:QUIZ_AUTH_SECRET
$githubToken = $env:GITHUB_TOKEN
$ghToken = $env:GH_TOKEN

$uvicornLogLevel = if ($VerboseLogging) { "debug" } else { "info" }
$uvicornAccessLog = $VerboseLogging

$backendJob = Start-Job -ScriptBlock {
    param($path, $port, $authSecret, $githubToken, $ghToken, $logLevel, $accessLog)
    Set-Location $path
    
    # Set environment variables in the job
    if ($authSecret) { $env:QUIZ_AUTH_SECRET = $authSecret }
    if ($githubToken) { $env:GITHUB_TOKEN = $githubToken }
    if ($ghToken) { $env:GH_TOKEN = $ghToken }
    
    # Activate venv if it exists
    $venvActivate = Join-Path $path "venv\Scripts\Activate.ps1"
    if (Test-Path $venvActivate) {
        & $venvActivate
    }
    
    $uvicornArgs = @(
        "main:app",
        "--host", "0.0.0.0",
        "--port", $port,
        "--log-level", $logLevel
    )

    if ($accessLog) {
        $uvicornArgs += "--access-log"
    }

    python -m uvicorn @uvicornArgs
} -ArgumentList $backendPath, $Port, $authSecret, $githubToken, $ghToken, $uvicornLogLevel, $uvicornAccessLog

# Wait for backend to start
Write-Host "⏳ Waiting for backend to initialize..." -ForegroundColor Gray
Start-Sleep -Seconds 3

# Check if backend is running
try {
    $response = Invoke-WebRequest -Uri "http://localhost:$Port/health" -TimeoutSec 5 -ErrorAction SilentlyContinue
    Write-Host "✅ Backend health check passed" -ForegroundColor Green
    
    # Try to hit the root to verify full startup
    try {
        $rootResponse = Invoke-WebRequest -Uri "http://localhost:$Port/" -TimeoutSec 3 -ErrorAction SilentlyContinue
        $rootJson = $rootResponse.Content | ConvertFrom-Json
        Write-Host "   API Version: $($rootJson.version)" -ForegroundColor Gray
    } catch {}
} catch {
    Write-Host "⚠️  Backend may still be starting... (health check failed)" -ForegroundColor Yellow
    Write-Host "   Check backend logs for errors" -ForegroundColor Gray
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
