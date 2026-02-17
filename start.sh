#!/usr/bin/env bash
# PulseQuiz Startup Script (Linux)
# Launches backend with either Cloudflare Tunnel (corporate-friendly) or ngrok

set -euo pipefail

# ============================================
# Defaults
# ============================================
USE_NGROK=false
SKIP_DEPLOY=false
SKIP_BUILD=false
CLEAN_REFRESH=false
VERBOSE_LOGGING=false
PORT=8000
MESSAGE=""
COPILOT_MODEL=""
SHOW_HELP=false

# ============================================
# Color helpers
# ============================================
CYAN='\033[0;36m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
MAGENTA='\033[0;35m'
GRAY='\033[0;90m'
WHITE='\033[1;37m'
NC='\033[0m' # No Color

info()    { echo -e "${CYAN}$*${NC}"; }
success() { echo -e "${GREEN}$*${NC}"; }
warn()    { echo -e "${YELLOW}$*${NC}"; }
error()   { echo -e "${RED}$*${NC}"; }
gray()    { echo -e "${GRAY}$*${NC}"; }
white()   { echo -e "${WHITE}$*${NC}"; }
magenta() { echo -e "${MAGENTA}$*${NC}"; }

# ============================================
# Parse arguments
# ============================================
while [[ $# -gt 0 ]]; do
    case "$1" in
        --help|-h)         SHOW_HELP=true; shift ;;
        --use-ngrok)       USE_NGROK=true; shift ;;
        --skip-deploy)     SKIP_DEPLOY=true; shift ;;
        --skip-build)      SKIP_BUILD=true; shift ;;
        --clean-refresh)   CLEAN_REFRESH=true; shift ;;
        --verbose)         VERBOSE_LOGGING=true; shift ;;
        --port)            PORT="$2"; shift 2 ;;
        --message)         MESSAGE="$2"; shift 2 ;;
        --copilot-model)   COPILOT_MODEL="$2"; shift 2 ;;
        *)
            error "Unknown option: $1"
            echo "Use --help to see available options."
            exit 1
            ;;
    esac
done

# ============================================
# Help
# ============================================
if $SHOW_HELP; then
    info "PulseQuiz startup"
    white "Usage:"
    gray "  ./start.sh [--use-ngrok] [--skip-deploy] [--skip-build] [--clean-refresh] [--verbose]"
    gray "             [--port 8000] [--message \"...\"] [--copilot-model <model>]"
    echo ""
    white "Options:"
    gray "  --help, -h           Show this help"
    gray "  --use-ngrok          Use ngrok instead of Cloudflare Tunnel"
    gray "  --skip-deploy        Skip GitHub Pages deploy (ngrok mode only)"
    gray "  --skip-build         Skip frontend build"
    gray "  --clean-refresh      Reinstall frontend/backend dependencies"
    gray "  --verbose            Enable verbose backend + access logs"
    gray "  --port <int>         Backend port (default 8000)"
    gray "  --message <string>   Custom home page message"
    gray "  --copilot-model <str> Sets QUIZ_COPILOT_MODEL for AI endpoints"
    echo ""
    white "Valid Copilot models:"
    gray "  claude-sonnet-4.5"
    gray "  claude-haiku-4.5"
    gray "  claude-opus-4.5"
    gray "  claude-sonnet-4"
    gray "  gemini-3-pro-preview"
    gray "  gpt-5.2-codex"
    gray "  gpt-5.2"
    gray "  gpt-5.1-codex-max"
    gray "  gpt-5.1-codex"
    gray "  gpt-5.1"
    gray "  gpt-5"
    gray "  gpt-5.1-codex-mini"
    gray "  gpt-5-mini"
    gray "  gpt-4.1"
    echo ""
    white "Example:"
    gray "  ./start.sh --copilot-model gpt-5.2-codex"
    exit 0
fi

# ============================================
# Script directory
# ============================================
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
BACKEND_DIR="$SCRIPT_DIR/backend"

echo ""
info "🎮 PulseQuiz Startup Script"
info "=========================="
echo ""

# ============================================
# Load .env file
# ============================================
ENV_FILE="$SCRIPT_DIR/.env"
if [[ -f "$ENV_FILE" ]]; then
    gray "📄 Loading .env file..."
    while IFS= read -r line || [[ -n "$line" ]]; do
        # Skip comments and blank lines
        [[ "$line" =~ ^[[:space:]]*# ]] && continue
        [[ -z "${line// /}" ]] && continue
        if [[ "$line" =~ ^[[:space:]]*([^#][^=]+)=(.*)$ ]]; then
            name="${BASH_REMATCH[1]}"
            value="${BASH_REMATCH[2]}"
            # Trim whitespace
            name="$(echo "$name" | xargs)"
            value="$(echo "$value" | xargs)"
            # Remove surrounding quotes
            value="${value%\"}"
            value="${value#\"}"
            value="${value%\'}"
            value="${value#\'}"
            export "$name=$value"
            gray "   Loaded: $name"
        fi
    done < "$ENV_FILE"
fi

# ============================================
# Mode display
# ============================================
if $USE_NGROK; then
    warn "📡 Mode: ngrok + GitHub Pages"
else
    success "📡 Mode: Cloudflare Tunnel (corporate-friendly)"
fi

if $VERBOSE_LOGGING; then
    magenta "🗣️  Verbose logging: ENABLED"
fi

# ============================================
# Environment Diagnostics
# ============================================
echo ""
info "🔍 Environment Diagnostics"
gray "─────────────────────────"

# Python version
PYTHON_CMD=""
if command -v python3 &>/dev/null; then
    PYTHON_CMD="python3"
elif command -v python &>/dev/null; then
    PYTHON_CMD="python"
fi

if [[ -n "$PYTHON_CMD" ]]; then
    PYTHON_VERSION="$($PYTHON_CMD --version 2>&1)"
    white "🐍 Python: $PYTHON_VERSION"
else
    error "🐍 Python: ❌ Not found"
    error "   Please install Python 3."
    exit 1
fi

# Check for venv (Linux paths: .venv or venv)
VENV_DIR=""
if [[ -d "$BACKEND_DIR/.venv" ]]; then
    VENV_DIR="$BACKEND_DIR/.venv"
    success "📦 Virtual env: ✅ Found at backend/.venv"
elif [[ -d "$BACKEND_DIR/venv" ]]; then
    VENV_DIR="$BACKEND_DIR/venv"
    success "📦 Virtual env: ✅ Found at backend/venv"
else
    warn "📦 Virtual env: ⚠️ Not found (using system Python)"
fi

# Determine the python/pip to use
if [[ -n "$VENV_DIR" ]]; then
    VENV_PYTHON="$VENV_DIR/bin/python"
    VENV_PIP="$VENV_DIR/bin/pip"
else
    VENV_PYTHON="$PYTHON_CMD"
    VENV_PIP="pip3"
fi

# Check Copilot CLI
if command -v gh &>/dev/null; then
    COPILOT_VERSION="$(gh copilot --version 2>&1 || true)"
    if [[ "$COPILOT_VERSION" == version* ]]; then
        success "🤖 Copilot CLI: ✅ $COPILOT_VERSION"
    else
        error "🤖 Copilot CLI: ❌ Not found (AI features disabled)"
        gray "   Install: gh extension install github/gh-copilot"
    fi
else
    error "🤖 GitHub CLI: ❌ Not found"
    gray "   Install: https://cli.github.com/"
fi

# ============================================
# Environment Variables
# ============================================
echo ""
info "🔑 Environment Variables"
gray "─────────────────────────"

if [[ -n "${QUIZ_AUTH_SECRET:-}" ]]; then
    success "   QUIZ_AUTH_SECRET: ✅ Set (${#QUIZ_AUTH_SECRET} chars)"
else
    warn "   QUIZ_AUTH_SECRET: ⚠️ Not set (AI endpoints unprotected!)"
fi

if [[ -n "$COPILOT_MODEL" ]]; then
    export QUIZ_COPILOT_MODEL="$COPILOT_MODEL"
    success "   QUIZ_COPILOT_MODEL: ✅ $COPILOT_MODEL"
elif [[ -n "${QUIZ_COPILOT_MODEL:-}" ]]; then
    success "   QUIZ_COPILOT_MODEL: ✅ $QUIZ_COPILOT_MODEL"
else
    gray "   QUIZ_COPILOT_MODEL: ℹ️ Not set (default gpt-4.1)"
fi

if [[ -n "${GITHUB_TOKEN:-}" ]]; then
    success "   GITHUB_TOKEN: ✅ Set"
elif [[ -n "${GH_TOKEN:-}" ]]; then
    success "   GH_TOKEN: ✅ Set"
else
    gray "   GITHUB_TOKEN: ℹ️ Not set (using Copilot CLI auth)"
fi

# ============================================
# Required Tools
# ============================================
echo ""
info "🛠️ Required Tools"
gray "─────────────────────────"

if ! $USE_NGROK; then
    if ! command -v cloudflared &>/dev/null; then
        error "❌ cloudflared not found. Install with:"
        gray "   curl -L https://github.com/cloudflare/cloudflared/releases/latest/download/cloudflared-linux-amd64 -o /usr/local/bin/cloudflared && chmod +x /usr/local/bin/cloudflared"
        warn "   Or use --use-ngrok flag to use ngrok instead"
        exit 1
    fi
    CF_VERSION="$(cloudflared --version 2>&1)"
    success "☁️ Cloudflared: ✅ $CF_VERSION"
else
    if ! command -v ngrok &>/dev/null; then
        error "❌ ngrok not found. Install from: https://ngrok.com/download"
        exit 1
    fi
    NGROK_VERSION="$(ngrok --version 2>&1)"
    success "🔗 ngrok: ✅ $NGROK_VERSION"
fi

# ============================================
# Frontend build (Cloudflare mode)
# ============================================
if ! $USE_NGROK && ! $SKIP_BUILD; then
    DIST_DIR="$SCRIPT_DIR/dist"
    if $CLEAN_REFRESH && [[ -d "$DIST_DIR" ]]; then
        warn "Cleaning dist/ for fresh build..."
        rm -rf "$DIST_DIR"
    fi

    if [[ ! -d "$DIST_DIR" ]]; then
        warn "📦 Building frontend..."
        cd "$SCRIPT_DIR"
        if $CLEAN_REFRESH; then
            gray "Running npm install (clean refresh)..."
        fi
        npm install
        npm run build
        success "✅ Frontend built!"
    else
        gray "✅ Frontend already built (use --skip-build or delete dist/ to rebuild)"
    fi
fi

# ============================================
# Update config.json for self-hosted mode
# ============================================
if ! $USE_NGROK; then
    CONFIG_PATH="$SCRIPT_DIR/public/config.json"
    cat > "$CONFIG_PATH" <<EOJSON
{"apiBaseUrl":"","customMessage":"$MESSAGE"}
EOJSON

    # Also update dist config if it exists
    DIST_CONFIG="$SCRIPT_DIR/dist/config.json"
    if [[ -d "$(dirname "$DIST_CONFIG")" ]]; then
        cp "$CONFIG_PATH" "$DIST_CONFIG"
    fi

    if [[ -n "$MESSAGE" ]]; then
        magenta "📝 Custom message: $MESSAGE"
    fi
fi

# ============================================
# Start Backend
# ============================================
echo ""
info "🚀 Starting Backend"
gray "─────────────────────────"

# Kill any existing process on the port
gray "🔪 Checking for existing processes on port $PORT..."
EXISTING_PIDS="$(lsof -ti :"$PORT" 2>/dev/null || true)"
if [[ -n "$EXISTING_PIDS" ]]; then
    for pid in $EXISTING_PIDS; do
        PROC_NAME="$(ps -p "$pid" -o comm= 2>/dev/null || echo "unknown")"
        warn "   Killing process: $PROC_NAME (PID: $pid)"
        kill -9 "$pid" 2>/dev/null || true
    done
    sleep 1
    success "   ✓ Port $PORT cleared"
else
    success "   ✓ Port $PORT is free"
fi

gray "📂 Backend path: $BACKEND_DIR"

# ============================================
# Clean refresh backend dependencies
# ============================================
if $CLEAN_REFRESH; then
    warn "Running backend dependency refresh..."
    if [[ -z "$VENV_DIR" ]]; then
        VENV_DIR="$BACKEND_DIR/.venv"
        gray "Creating backend virtual environment..."
        $PYTHON_CMD -m venv "$VENV_DIR"
        VENV_PYTHON="$VENV_DIR/bin/python"
        VENV_PIP="$VENV_DIR/bin/pip"
    fi
    "$VENV_PIP" install -r "$BACKEND_DIR/requirements.txt"
fi

# ============================================
# Check Python dependencies
# ============================================
gray "📋 Checking Python dependencies..."
if [[ -f "$BACKEND_DIR/requirements.txt" ]]; then
    gray "   Dependencies in requirements.txt:"
    while IFS= read -r req; do
        [[ "$req" =~ ^[a-zA-Z] ]] && gray "   - $req"
    done < "$BACKEND_DIR/requirements.txt"
fi

# Check Copilot SDK
gray "📦 Checking Copilot SDK installation..."
SDK_CHECK="$("$VENV_PYTHON" -c "import copilot; print(f'v{copilot.__version__}')" 2>&1 || true)"
if [[ "$SDK_CHECK" == v* ]]; then
    success "   ✅ Copilot SDK (github-copilot-sdk): $SDK_CHECK"
else
    warn "   ⚠️ Copilot SDK: Not installed"
    gray "   Run: pip install github-copilot-sdk"
fi

# ============================================
# Launch uvicorn
# ============================================
echo ""
warn "⚡ Starting uvicorn on port $PORT..."

UVICORN_LOG_LEVEL="info"
UVICORN_EXTRA_ARGS=""
if $VERBOSE_LOGGING; then
    UVICORN_LOG_LEVEL="debug"
    UVICORN_EXTRA_ARGS="--access-log"
fi

BACKEND_PID=""
TUNNEL_PID=""

# Cleanup function
cleanup() {
    echo ""
    warn "🛑 Shutting down..."
    [[ -n "$BACKEND_PID" ]] && kill "$BACKEND_PID" 2>/dev/null || true
    [[ -n "$TUNNEL_PID" ]] && kill "$TUNNEL_PID" 2>/dev/null || true
    wait 2>/dev/null || true
    success "✅ Cleanup complete"
}
trap cleanup EXIT INT TERM

cd "$BACKEND_DIR"
"$VENV_PYTHON" -m uvicorn main:app \
    --host 0.0.0.0 \
    --port "$PORT" \
    --log-level "$UVICORN_LOG_LEVEL" \
    $UVICORN_EXTRA_ARGS &
BACKEND_PID=$!

# Wait for backend to start
gray "⏳ Waiting for backend to initialize..."
sleep 3

# Health check
if curl -sf "http://localhost:$PORT/health" -o /dev/null --max-time 5 2>/dev/null; then
    success "✅ Backend health check passed"
    # Try root endpoint for version
    ROOT_RESPONSE="$(curl -sf "http://localhost:$PORT/" --max-time 3 2>/dev/null || true)"
    if [[ -n "$ROOT_RESPONSE" ]]; then
        API_VERSION="$(echo "$ROOT_RESPONSE" | $PYTHON_CMD -c "import sys,json; print(json.load(sys.stdin).get('version',''))" 2>/dev/null || true)"
        [[ -n "$API_VERSION" ]] && gray "   API Version: $API_VERSION"
    fi
else
    warn "⚠️  Backend may still be starting... (health check failed)"
    gray "   Check backend logs for errors"
fi

# ============================================
# CLOUDFLARE TUNNEL MODE
# ============================================
if ! $USE_NGROK; then
    echo ""
    warn "🌐 Starting Cloudflare Tunnel..."

    cloudflared tunnel run --url "http://localhost:$PORT" pulsequiz &
    TUNNEL_PID=$!

    sleep 3
    success "✅ Cloudflare Tunnel connected"

    echo ""
    info "=================================================="
    success "🎉 PulseQuiz is ready!"
    info "=================================================="
    echo ""
    echo "📍 Local:   http://localhost:$PORT"
    success "📍 Public:  https://quiz.sandford.systems"
    echo ""
    success "✅ Works on corporate networks (Zscaler)"
    echo "⚠️  Keep this terminal open to maintain the connection"
    echo "   Press Ctrl+C to stop everything"
    echo ""

    # Keep alive — monitor both processes
    while true; do
        if ! kill -0 "$TUNNEL_PID" 2>/dev/null; then
            error "❌ Cloudflare Tunnel has stopped"
            break
        fi
        if ! kill -0 "$BACKEND_PID" 2>/dev/null; then
            error "❌ Backend has stopped"
            break
        fi
        sleep 5
    done

# ============================================
# NGROK MODE
# ============================================
else
    echo ""
    warn "🌐 Starting ngrok tunnel..."

    # Kill any existing ngrok processes
    pkill -f ngrok 2>/dev/null || true
    sleep 1

    ngrok http "$PORT" --log=stdout > /dev/null &
    TUNNEL_PID=$!

    sleep 3

    # Get ngrok URL from API
    warn "📡 Fetching ngrok URL..."

    NGROK_URL=""
    for i in $(seq 1 10); do
        NGROK_URL="$(curl -sf http://localhost:4040/api/tunnels --max-time 5 2>/dev/null \
            | $PYTHON_CMD -c "import sys,json; tunnels=json.load(sys.stdin)['tunnels']; print(next((t['public_url'] for t in tunnels if t['proto']=='https'),''))" 2>/dev/null || true)"
        [[ -n "$NGROK_URL" ]] && break
        sleep 1
    done

    if [[ -z "$NGROK_URL" ]]; then
        error "❌ Failed to get ngrok URL. Make sure ngrok is authenticated."
        warn "   Run: ngrok config add-authtoken <your-token>"
        exit 1
    fi

    success "✅ ngrok URL: $NGROK_URL"

    # Update config.json
    echo ""
    warn "📝 Updating config.json..."
    CONFIG_PATH="$SCRIPT_DIR/public/config.json"
    cat > "$CONFIG_PATH" <<EOJSON
{"apiBaseUrl":"$NGROK_URL"}
EOJSON
    success "✅ Config updated with ngrok URL"

    # Commit and push (unless skipped)
    if ! $SKIP_DEPLOY; then
        echo ""
        warn "🚢 Deploying to GitHub Pages..."
        cd "$SCRIPT_DIR"
        git add public/config.json
        if git commit -m "Update API URL to $NGROK_URL" 2>/dev/null; then
            git push
            success "✅ Pushed to GitHub - deployment will start automatically"
            info "   View at: https://idealase.github.io/PulseQuiz/"
        else
            warn "⚠️  No changes to commit (URL may be the same)"
        fi
    else
        echo ""
        warn "⏭️  Skipping deploy (use without --skip-deploy to auto-deploy)"
    fi

    # Summary
    echo ""
    info "=================================================="
    success "🎉 PulseQuiz is ready!"
    info "=================================================="
    echo ""
    echo "📍 Local Backend:  http://localhost:$PORT"
    echo "📍 Public API:     $NGROK_URL"
    echo "📍 Frontend:       https://idealase.github.io/PulseQuiz/"
    echo ""
    warn "⚠️  May NOT work on corporate networks (Zscaler)"
    echo "   Use without --use-ngrok for corporate compatibility"
    echo ""
    echo "⚠️  Keep this terminal open to maintain the tunnel"
    echo "   Press Ctrl+C to stop everything"
    echo ""

    # Keep alive — monitor both processes
    while true; do
        if ! kill -0 "$TUNNEL_PID" 2>/dev/null; then
            error "❌ ngrok has stopped"
            break
        fi
        if ! kill -0 "$BACKEND_PID" 2>/dev/null; then
            error "❌ Backend has stopped"
            break
        fi
        sleep 5
    done
fi
