# PulseQuiz

A real-time, AI-powered quiz app for team quiz nights. Think Kahoot/Mentimeter, but with built-in AI question generation, dynamic difficulty, and an AI-verified challenge system — minimal and self-hosted.

## Features

### Core
- 📱 **Mobile-first UI** — Players join from their phones
- 🎮 **Real-time sync** — Host controls progression, all players stay in lockstep
- 🔒 **Anti-cheat gating** — Answers only revealed at end of round
- 📊 **Leaderboard** — See scores and per-question review after reveal
- 📝 **CSV import** — Use Mentimeter-style CSV format
- 🎯 **Solo Mode** — Practice on your own with AI-generated quizzes

### 🤖 AI-Powered Features

PulseQuiz uses the **GitHub Copilot SDK** to bring AI directly into the quiz experience:

#### AI Question Generation
Generate entire quiz rounds on the fly — no CSV needed. Just enter your topics (e.g. "Space, Ancient Rome, 90s Music") and the AI creates engaging multiple-choice questions with explanations and a fun wrong answer in each set.

- **Topic-based generation** — Provide comma-separated topics and get a full quiz in seconds
- **Difficulty control** — Choose easy, medium, hard, or mixed difficulty
- **Research mode** — Enable deeper AI research for more obscure and interesting facts
- **Configurable count** — Generate 3–50 questions per batch

#### Dynamic Difficulty (Adaptive Batches)
In dynamic mode, PulseQuiz monitors player performance in real time and automatically calibrates the next batch of questions:

- Players acing it (>80% correct, fast answers)? Difficulty ramps up
- Players struggling (<40% correct, slow answers)? Difficulty eases off
- The system continuously adjusts to keep the quiz engaging for everyone

#### AI Theme Generation
Enter a topic and the AI generates a complete visual theme — colors, typography, density, motion effects, and even decorative motifs (snow, confetti, scanlines, pumpkins, etc.). Themes are validated against a strict spec so they always look good.

#### AI Fact-Checking
Any question can be fact-checked on demand. The AI verifies the claimed correct answer, returns a confidence score, explains its reasoning, and optionally suggests where to look it up.

### ⚔️ Player-Host Challenge System with AI Verification

Players can challenge any question they believe has an incorrect or ambiguous answer. The host gets a full toolkit to resolve disputes fairly:

1. **Players flag questions** — During review, players submit a challenge with an optional note and category
2. **Host reviews challenges** — See all submissions, player notes, and the original question details
3. **AI verification** — The host can request an AI analysis that returns:
   - A verdict: `valid`, `invalid`, or `ambiguous`
   - A confidence score (0–1)
   - A detailed rationale explaining the AI's reasoning
   - An optional suggested correction
4. **Publish to players** — The host decides whether to share the AI's verdict with all players
5. **Score reconciliation** — If a challenge is upheld, the host can:
   - **Void** the question (remove it from scoring)
   - **Award all** players points
   - **Accept multiple** answers as correct
6. **Full audit trail** — Every reconciliation is logged with score deltas per player

## Architecture

- **Frontend**: React + TypeScript + Vite (deployed to GitHub Pages)
- **Backend**: FastAPI + WebSockets (runs locally, exposed via ngrok)
- **AI**: GitHub Copilot SDK (GPT-4.1) — question generation, theme generation, fact-checking, challenge verification

## Quick Start

### 1. Run the Backend

```bash
cd backend
pip install -r requirements.txt
uvicorn main:app --reload --host 0.0.0.0 --port 8000
```

The API will be available at `http://localhost:8000`

### 2. Expose via ngrok

```bash
ngrok http 8000
```

Copy the HTTPS URL (e.g., `https://abc123.ngrok-free.app`)

### 3. Configure the Frontend

Edit `public/config.json`:

```json
{
  "apiBaseUrl": "https://abc123.ngrok-free.app"
}
```

### 4. Run the Frontend (Development)

```bash
npm install
npm run dev
```

Visit `http://localhost:5173`

### 5. Deploy to GitHub Pages

1. Push to `main` branch
2. GitHub Actions will automatically build and deploy
3. Your quiz will be available at `https://[username].github.io/PulseQuiz/`

**Important**: Before your event, update `public/config.json` with your ngrok URL and push/redeploy.

## How to Use

### As Host

1. Go to the app and click **"Start Game"**
2. Click **"Create Session"** to get a session code
3. Share the code (or QR code) with players
4. Load questions — either **import a CSV** or **use AI generation**:
   - Enter topics and click **Generate** to create questions with AI
   - Optionally enable **Dynamic Mode** to auto-calibrate difficulty between rounds
5. Optionally generate an **AI theme** to match your quiz topic
6. Click **"Start"** when everyone has joined
7. Use **"Next Question"** to advance through questions
8. Review challenges from players and use **AI Verify** to fact-check disputes
9. Click **"Reveal Results"** at the end to show scores

### As Player

1. Go to the app and click **"Join Game"**
2. Enter the session code and your nickname
3. Wait for the host to start
4. Tap your answer for each question and confirm
5. After reveal, **challenge** any question you think is wrong — the host can have AI verify it
6. See your score, review answers, and any AI verdicts after reveal

### Solo Mode

1. Click **"Solo Mode"** on the main page
2. Import a CSV or enter topics for **AI-generated questions**
3. Play through questions at your own pace
4. Review your results at the end

## CSV Format

Create a CSV file with these columns:

| Column | Required | Description |
|--------|----------|-------------|
| `question` | Yes | The question text |
| `option_a` | Yes | First answer option |
| `option_b` | Yes | Second answer option |
| `option_c` | No | Third answer option |
| `option_d` | No | Fourth answer option |
| `correct` | Yes | Correct answer: `A`, `B`, `C`, `D`, or exact text |
| `explanation` | No | Shown after reveal |
| `points` | No | Points for correct answer (default: 1) |

### Example CSV

```csv
question,option_a,option_b,option_c,option_d,correct,explanation,points
"What is the capital of France?",Paris,London,Berlin,Madrid,A,"Paris has been the capital since the 10th century.",1
"Which planet is the Red Planet?",Venus,Mars,Jupiter,Saturn,B,"Mars appears red due to iron oxide.",1
```

See `examples/sample-quiz.csv` for a complete example.

## Reality Check (Security Notes)

This is designed for a **one-off team event**, not production use:

- **Anti-cheat**: The backend doesn't send correct answers until reveal. A determined participant could still inspect client code, but they won't see answers during play.
- **No authentication**: Basic host token, simple session codes. No passwords or accounts.
- **In-memory storage**: Sessions are lost when the server restarts.
- **CORS**: Wide open for simplicity.

For a friendly team quiz night, this is fine. Don't use it for anything with stakes.

## Development

### Frontend

```bash
npm install
npm run dev      # Development server
npm run build    # Production build
npm run preview  # Preview production build
```

### Backend

```bash
cd backend
pip install -r requirements.txt
uvicorn main:app --reload
```

### API Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/session` | Create session (returns code + hostToken) |
| POST | `/api/session/{code}/join` | Join session (body: nickname) |
| POST | `/api/session/{code}/questions` | Upload questions (host only) |
| POST | `/api/session/{code}/start` | Start round (host only) |
| POST | `/api/session/{code}/next` | Next question (host only) |
| POST | `/api/session/{code}/reveal` | Reveal results (host only) |
| POST | `/api/session/{code}/answer` | Submit answer (player) |
| **AI** | | |
| POST | `/api/generate-questions` | AI-generate quiz questions from topics |
| POST | `/api/generate-dynamic-batch` | Generate difficulty-calibrated question batch |
| POST | `/api/generate-theme` | Generate a visual theme from a topic |
| POST | `/api/fact-check` | AI fact-check a question and answer |
| **Challenges** | | |
| POST | `/api/session/{code}/challenge` | Submit a challenge (player) |
| GET | `/api/session/{code}/challenges` | List all challenges (host only) |
| GET | `/api/session/{code}/challenges/{idx}` | Get challenge detail (host only) |
| POST | `/api/session/{code}/challenges/{idx}/resolution` | Resolve a challenge (host only) |
| POST | `/api/session/{code}/challenges/{idx}/ai-verify` | AI-verify a challenged question (host) |
| POST | `/api/session/{code}/challenges/{idx}/ai-publish` | Publish AI verdict to players (host) |
| POST | `/api/session/{code}/challenges/{idx}/reconcile` | Reconcile scores for a question (host) |
| WS | `/ws/session/{code}` | Real-time updates |

## License

MIT - Do whatever you want with it.
