# PulseQuiz

A simple, real-time quiz app for team quiz nights. Think Kahoot/Mentimeter, but minimal and self-hosted.

## Features

- 📱 **Mobile-first UI** - Players join from their phones
- 🎮 **Real-time sync** - Host controls progression, all players stay in lockstep
- 🔒 **Anti-cheat gating** - Answers only revealed at end of round
- 📊 **Leaderboard** - See scores and per-question review after reveal
- 📝 **CSV import** - Use Mentimeter-style CSV format

## Architecture

- **Frontend**: React + TypeScript + Vite (deployed to GitHub Pages)
- **Backend**: FastAPI + WebSockets (runs locally, exposed via ngrok)

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

1. Go to the app and click **"Host Game"**
2. Click **"Create Session"** to get a session code
3. Share the code (or QR code) with players
4. Import your quiz CSV (drag & drop or file picker)
5. Click **"Start"** when everyone has joined
6. Use **"Next Question"** to advance through questions
7. Click **"Reveal Results"** at the end to show scores

### As Player

1. Go to the app and click **"Join Game"**
2. Enter the session code and your nickname
3. Wait for the host to start
4. Tap your answer for each question and confirm
5. See your score and review answers after reveal

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
| WS | `/ws/session/{code}` | Real-time updates |

## License

MIT - Do whatever you want with it.
