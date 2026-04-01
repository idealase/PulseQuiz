# PulseQuiz

## Quick Reference
- **Frontend build**: `npm run build` (`tsc -b && vite build`)
- **Frontend dev**: `npm run dev` → http://localhost:5173
- **Frontend lint**: `npm run lint` (ESLint)
- **Frontend preview**: `npm run preview`
- **Backend start**: `cd backend && source .venv/bin/activate && uvicorn main:app --reload --port 8000`
- **Backend deps**: `cd backend && pip install -r requirements.txt`
- **Start both**: `bash start.sh` (Linux/macOS)
- **Deploy**: Push to `main` → GitHub Actions deploys frontend to GitHub Pages

## Architecture
Real-time AI-powered quiz platform (Kahoot alternative) — multiplayer WebSocket sessions.

```
/src/                   → React 18 + TypeScript + Vite + Tailwind CSS
  /pages/               → Landing, HostCreate, HostSession, PlayerJoin, PlayerSession,
                          AudienceJoin, AudienceSession, SoloPlay, Settings
  /components/          → GlobalNav, AIInspectorPanel, DevLogOverlay
  /context/             → DevModeContext, ConfigContext, AITelemetryContext, ThemeContext
  /hooks/               → useSessionLeaveGuard
  /api/client.ts        → API client
  /data/                → defaultQuestions.ts
  /utils/               → csvParser, sessionResume
/backend/               → FastAPI + Python + WebSocket (in-memory session state)
```

## Key Conventions
- **React 18** — do NOT use React 19 features (use, Actions, etc.)
- **AI Integration**: GitHub Copilot SDK via CLI subprocess calls from backend
- **Styling**: Tailwind CSS 3.4 with CSS variable theming (`--pq-accent`, `--pq-accent-2`)
- **State**: React Context API (4 contexts: DevMode, Config, AITelemetry, Theme)
- **Sessions**: In-memory Python dict — sessions lost on backend restart (no database)
- **QR codes**: `qrcode.react` package for session join codes

## Deployment
- **Frontend**: GitHub Pages via `deploy.yml` workflow
- **Backend**: Self-hosted — dedicated runner at `~/actions-runner-pulsequiz/`
- **CI**: Node 20, builds frontend only (backend deployed separately)
- **No frontend tests configured** — only ESLint

## Common Pitfalls
- Backend has NO CI workflow — only frontend deploys via GitHub Actions
- Backend uses `main:app` (not `app.main:app`) — `main.py` is at `backend/` root
- In-memory sessions = all game state lost on restart
- Frontend assumes backend at configurable URL — check `src/api/client.ts`
- `start.sh` starts both services — check it for port/env configuration

## Sensitive Files
Do not read, log, or commit: any `.env` files, API keys, Copilot SDK credentials, secrets.
