# PulseQuiz — Copilot Instructions

## Project Overview

PulseQuiz is a real-time, AI-powered quiz platform (Kahoot/Mentimeter alternative) for team quiz nights. Features include host-controlled multiplayer sessions with WebSocket sync, audience/spectator mode, solo play with AI-generated questions, dynamic difficulty adjustment, player challenge system with AI verification, and visual theme generation. AI features are powered by the GitHub Copilot SDK running on the backend via CLI subprocess calls.

## Tech Stack

- **Frontend**: React 18.3 / Vite 5.4 / TypeScript 5.5 / React Router 6
- **Backend**: FastAPI / Python 3.11+ / WebSocket / in-memory session state
- **AI Integration**: GitHub Copilot SDK (`github-copilot-sdk`) via CLI subprocess — question generation, fact-checking, theme generation, dynamic difficulty
- **Data**: In-memory Python dict (sessions lost on restart) — no database
- **Styling**: Tailwind CSS 3.4 (with CSS variable theming: `--pq-accent`, `--pq-accent-2`)
- **Testing**: ESLint (frontend), no test runner configured yet
- **Deployment**: GitHub Pages (frontend static), self-hosted backend with dedicated runner
- **CI/CD**: GitHub Actions — Pages auto-deploy (`deploy.yml`), dedicated self-hosted runner at `~/actions-runner-pulsequiz/`

> **Important**: This project uses **React 18**, not React 19. Do not use React 19 features (use, Actions, etc.).

## Quick Commands

```bash
# === Frontend (root) ===
npm ci                           # Install dependencies
npm run dev                      # Vite dev server at :5173
npm run build                    # Production build: tsc + vite → dist/
npm run lint                     # ESLint
npm run preview                  # Preview production build locally

# === Backend (backend/) ===
cd backend
source .venv/bin/activate        # Or: python -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt  # Install dependencies
uvicorn main:app --reload --port 8000  # Dev server at :8000

# === Start Everything (convenience scripts) ===
bash start.sh                    # Linux/macOS: starts both frontend & backend
# Or Start-PulseQuiz.bat         # Windows equivalent
```

## Project Structure

```
PulseQuiz/
├── src/                            # React 18 + TypeScript frontend
│   ├── pages/
│   │   ├── Landing.tsx             # Home / mode selection
│   │   ├── HostCreate.tsx          # Host creates a quiz session
│   │   ├── HostSession.tsx         # Host controls (start, next, reveal)
│   │   ├── PlayerJoin.tsx          # Player joins via code
│   │   ├── PlayerSession.tsx       # Player answer UI
│   │   ├── AudienceJoin.tsx        # Spectator join
│   │   ├── AudienceSession.tsx     # Spectator leaderboard view
│   │   ├── SoloPlay.tsx            # AI-powered solo quiz mode
│   │   └── Settings.tsx            # Configuration page
│   ├── components/
│   │   ├── GlobalNav.tsx           # Navigation bar
│   │   ├── AIInspectorPanel.tsx    # Dev mode: AI telemetry viewer
│   │   └── DevLogOverlay.tsx       # Dev mode: debug logging
│   ├── context/
│   │   ├── ConfigContext.tsx        # API base URL configuration
│   │   ├── ThemeContext.tsx         # Dynamic theme application (AI-generated)
│   │   ├── DevModeContext.tsx       # Developer mode toggles
│   │   └── AITelemetryContext.tsx   # AI call tracking & metrics
│   ├── hooks/
│   │   └── useSessionLeaveGuard.ts # Warn before leaving active session
│   ├── utils/
│   │   ├── csvParser.ts            # CSV quiz import parsing
│   │   └── sessionResume.ts        # Session recovery after disconnect
│   ├── api/
│   │   └── client.ts              # API client (fetch-based, sends X-Auth-Token)
│   ├── data/
│   │   └── defaultQuestions.ts     # Fallback questions when AI unavailable
│   ├── App.tsx                     # Main router
│   ├── main.tsx                    # Vite entry point
│   ├── types.ts                    # Shared TypeScript types
│   └── index.css                   # Global styles + Tailwind
├── backend/
│   ├── main.py                     # FastAPI app (2,640 lines — endpoints, WebSocket, AI)
│   ├── models.py                   # Session/Player/Question data models
│   ├── theme_spec.py               # Theme schema & validation
│   ├── logger.py                   # Structured logging + Copilot call tracking
│   └── requirements.txt            # fastapi, uvicorn, websockets, github-copilot-sdk
├── public/
│   ├── config.json                 # Runtime API base URL config
│   ├── favicon.svg
│   └── _headers                    # Security headers (CSP, X-Frame-Options)
├── dist/                           # Built frontend (Vite output)
├── examples/
│   └── sample-quiz.csv             # Example quiz CSV
├── scripts/
│   ├── export-chat.sh              # Chat session export (Bash)
│   └── export-chat.ps1             # Chat session export (PowerShell)
├── .github/
│   ├── workflows/
│   │   └── deploy.yml              # GitHub Pages auto-deploy
│   ├── hooks/
│   │   └── export-chat.json        # Chat export hook config
│   ├── copilot-instructions.md     # This file
│   ├── agents/                     # Agent role definitions
│   ├── prompts/                    # Prompt templates
│   ├── skills/                     # Deployment & ops skills
│   └── ISSUE_TEMPLATE/             # Issue templates
├── package.json                    # Frontend dependencies
├── vite.config.ts                  # Vite config (React plugin, :5173)
├── tsconfig.json                   # TypeScript config (ES2020, strict)
├── tailwind.config.js              # Tailwind with CSS variable theming
├── postcss.config.js
├── vercel.json                     # Vercel deployment config (rewrites to backend)
├── AGENTS.md                       # QA/Testing agent guidelines
├── CHANGELOG.md                    # Version history
├── COPILOT_SDK_FIXES.md            # Copilot SDK implementation notes
├── start.sh / start.ps1            # Convenience startup scripts
└── README.md
```

## Coding Conventions

### General
- Use TypeScript strict mode — no `any` types
- Use React 18 patterns only — no `use()` hook, no React Actions, no `useFormStatus`
- Prefer named exports over default exports
- Keep functions under 50 lines — extract helpers if longer
- Error messages must be user-friendly, not stack traces

### Naming
- Components: PascalCase (`HostSession.tsx`)
- Pages: PascalCase in `src/pages/` (`SoloPlay.tsx`)
- Hooks: `use` prefix (`useSessionLeaveGuard.ts`)
- Context: PascalCase with `Context` suffix (`ThemeContext.tsx`)
- Utils: camelCase (`csvParser.ts`)
- CSS classes: Tailwind utilities

### File Organisation
- One component per file
- Pages in `src/pages/`, components in `src/components/`
- Context providers in `src/context/`
- Custom hooks in `src/hooks/`
- API client in `src/api/`
- Shared types in `src/types.ts`
- Backend is flat — `main.py` contains all endpoints (to be refactored into modules)

### Git
- Conventional commits: `feat|fix|docs|chore|refactor|test|ci: description`
- Branch naming: `type/issue-number-short-description` (e.g., `feat/23-solo-mode`)
- Always squash merge to `main`

## Architecture Decisions

- **In-memory session state**: Sessions are Python dicts — no database. This is intentional for simplicity. Sessions are ephemeral and lost on restart. A persistence layer may be added later.
- **Copilot SDK via CLI subprocess**: AI features call the Copilot CLI binary as a subprocess rather than using a direct API. This avoids SDK version lock-in and leverages CLI auth. See `COPILOT_SDK_FIXES.md` for implementation details.
- **WebSocket + SSE fallback**: Real-time game updates use WebSocket (`/ws/session/{code}`). If WebSocket fails, the frontend falls back to SSE polling.
- **React 18 (not 19)**: Intentional choice for stability. Do not upgrade without explicit decision.
- **CSS variable theming**: AI-generated themes set `--pq-accent` and `--pq-accent-2` CSS variables, allowing dynamic visual theming without rebuilding.
- **Single monolithic `main.py`**: Backend is currently a single 2,640-line file. This works for the current scope but should be refactored into modules as the codebase grows.

## Deployment

- **Frontend URL**: GitHub Pages (auto-deploy on push to main)
- **Backend**: Self-hosted at the dedicated runner (`~/actions-runner-pulsequiz/`)
- **Vercel**: Alternative frontend hosting with API rewrites to backend
- **Runtime config**: `public/config.json` sets `apiBaseUrl` (empty = same-origin)

### Deployment Checklist
1. Build succeeds: `npm run build`
2. Lint passes: `npm run lint`
3. Push to `main` triggers GitHub Pages deploy via `deploy.yml`
4. Backend running: `uvicorn main:app --host 0.0.0.0 --port 8000`
5. Health check: `curl -s http://localhost:8000/api/ai-status`

## Testing Strategy

- **Frontend**: ESLint only (no Vitest/Jest configured yet)
- **Backend**: No automated test suite yet — manual testing via API calls
- **Coverage target**: Tests not yet set up — priority is adding Vitest for frontend
- **AI feature testing**: Use `/api/ai-test` endpoint to verify Copilot SDK connectivity

### What to Test (when tests are added)
- CSV parsing edge cases (malformed files, encoding issues)
- Session lifecycle: create → join → play → reveal → leaderboard
- WebSocket message handling and reconnection
- AI response parsing (handle malformed JSON, timeout, CLI not found)
- Challenge system: submit → verify → reconcile scoring
- Theme application and CSS variable updates

### What NOT to Test
- CSS/styling details — visual regression if needed later
- Third-party library internals
- Copilot SDK internals — test the integration boundary, not the SDK itself

## Common Pitfalls

- **React 18 only**: Do not use React 19 features (`use()`, `useFormStatus`, `useActionState`, Server Components). This project intentionally uses React 18.3.
- **Copilot CLI detection**: The backend finds the CLI via `copilot.__file__/bin/copilot` then falls back to `shutil.which()`. If neither works, AI endpoints return 422 with install instructions.
- **Auth for AI endpoints**: AI generation endpoints require `X-Auth-Token` header matching `QUIZ_AUTH_SECRET` env var. Without it, you get 401.
- **In-memory sessions**: All game state is lost on backend restart. Don't assume sessions persist across deploys.
- **Large `main.py`**: The backend is a single 2,640-line file. When editing, use precise line references. Don't restructure without an explicit issue requesting it.
- **Dedicated runner**: CI/CD uses a dedicated runner at `~/actions-runner-pulsequiz/`, not the shared pool. Ensure it's running for deploys to work.
- **QR code join**: Sessions use short codes and QR codes for joining. The QR renders the join URL — test with different base URLs.

## Environment Variables

| Variable | Purpose | Where Set |
|----------|---------|-----------|
| `QUIZ_AUTH_SECRET` | Auth token for AI endpoints (`X-Auth-Token`) | `.env` file |
| `GITHUB_TOKEN` | GitHub PAT for Copilot SDK authentication | `.env` file |
| `QUIZ_COPILOT_MODEL` | LLM model for AI features (default: `gpt-5.2`) | `.env` file |
| `VITE_API_URL` | Backend API base URL (if not same-origin) | Build-time env |

> **Note**: Never hardcode secrets. Never commit `.env` files. Never log sensitive values.

## Related Repos

- **idealase.github.io**: Meta-repo with agentic SDLC docs and shared templates

## Agent-Specific Instructions

### Scope Control
- Stay within the files listed in the issue. Do not refactor unrelated code.
- If you discover a bug outside your scope, note it in the PR but don't fix it.
- Maximum diff size: 200 lines for size/S, 500 lines for size/M

### PR Format
- Title: conventional commit format (`feat: add dynamic difficulty UI`)
- Body: reference the issue (`Closes #23`)
- Include a "Changes" section listing what was modified and why
- Include a "Testing" section showing test commands run and results

### What NOT to Do
- Do not modify CI/CD workflows unless the issue specifically asks for it
- Do not update dependencies unless the issue specifically asks for it
- Do not add new dev dependencies without explicit instruction
- Do not modify nginx configs, systemd units, or deployment scripts
- Do not read or modify `.env` files, credentials, or secrets
- Do not refactor `backend/main.py` into modules unless the issue specifically asks for it
- Do not upgrade to React 19 — this project intentionally uses React 18
