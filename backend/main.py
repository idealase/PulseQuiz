from fastapi import FastAPI, WebSocket, WebSocketDisconnect, HTTPException, Header
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse
from pydantic import BaseModel, Field
from typing import Optional, List
from pathlib import Path
import json
import asyncio
import time
import os
import re
import logging
import traceback
import sys
import subprocess
import shutil

from models import (
    Session, Question, Player, GameSettings,
    LiveLeaderboardEntry, QuestionStats, AnswerStatus,
    ChallengeSubmission, ChallengeResolution, AIVerification, ReconciliationPolicy, ScoreAuditEntry,
    generate_session_code, generate_token, generate_player_id
)
from theme_spec import (
    ThemeSpec,
    FONT_STACKS,
    THEME_LIBRARY,
    DEFAULT_THEME_ID,
    analyze_topic,
    apply_deltas,
    apply_intensity,
    get_theme_by_id,
    is_sensitive_topic,
    select_theme_base,
    validate_theme_spec,
)
from logger import (
    setup_logging, get_logger, get_copilot_logger,
    CopilotCallTracker, summarize_token_usage,
    log_game_event, set_request_id,
)

# Initialise structured, file-based logging
setup_logging(console_level=logging.INFO)
logger = get_logger("PulseQuiz")
copilot_log = get_copilot_logger()

# Copilot SDK imports (optional - gracefully handle if not installed)
COPILOT_SDK_AVAILABLE = False
COPILOT_MODULE_INFO = ""
try:
    from copilot import CopilotClient, define_tool
    import copilot
    COPILOT_SDK_AVAILABLE = True
    COPILOT_MODULE_INFO = f"version={getattr(copilot, '__version__', 'unknown')}, path={copilot.__file__}"
    logger.info(f"🤖 Copilot SDK loaded successfully: {COPILOT_MODULE_INFO}")
except ImportError as e:
    COPILOT_SDK_AVAILABLE = False
    COPILOT_MODULE_INFO = f"Import failed: {e}"
    logger.warning(f"⚠️  Copilot SDK not installed - AI features disabled. Error: {e}")

app = FastAPI(title="PulseQuiz API")

# CORS - allow all origins for simplicity (adjust for production)
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=False,  # Must be False when using allow_origins=["*"]
    allow_methods=["*"],
    allow_headers=["*"],
    expose_headers=["*"],
)

# In-memory session storage
sessions: dict[str, Session] = {}

# WebSocket connections per session
# session_code -> { connection_id -> (websocket, role, id) }
# role can be 'host', 'player', or 'observer'
ws_connections: dict[str, dict[str, tuple[WebSocket, str, str]]] = {}

# Event storage for polling fallback (Zscaler/corporate networks)
session_events: dict[str, list[dict]] = {}
MAX_EVENTS_PER_SESSION = 100

# Timer tasks per session
timer_tasks: dict[str, asyncio.Task] = {}


def add_session_event(code: str, event: dict):
    """Add an event to the session's event queue for polling clients"""
    if code not in session_events:
        session_events[code] = []
    session_events[code].append({
        **event,
        '_eventId': len(session_events[code]),
        '_timestamp': time.time()
    })
    # Keep only last N events
    if len(session_events[code]) > MAX_EVENTS_PER_SESSION:
        session_events[code] = session_events[code][-MAX_EVENTS_PER_SESSION:]


# --- Request/Response Models ---

class CreateSessionRequest(BaseModel):
    timerMode: bool = False
    timerSeconds: int = 15
    autoProgressMode: bool = False
    autoProgressPercent: int = 90


class CreateSessionResponse(BaseModel):
    code: str
    hostToken: str


class JoinRequest(BaseModel):
    nickname: str


class JoinResponse(BaseModel):
    playerId: str


class UploadQuestionsRequest(BaseModel):
    questions: list[Question]


class AnswerRequest(BaseModel):
    playerId: str
    questionIndex: int
    choice: int
    response_time_ms: Optional[int] = None  # Client-measured response time in milliseconds


class ChallengeRequest(BaseModel):
    playerId: str
    questionIndex: int
    note: Optional[str] = None
    category: Optional[str] = None
    source: str = "review"  # review | mid_game


class ChallengeResolutionRequest(BaseModel):
    status: str = "open"  # open | under_review | resolved
    verdict: Optional[str] = None  # valid | invalid | ambiguous
    resolutionNote: Optional[str] = None
    publish: bool = False


class ChallengeAIVerifyRequest(BaseModel):
    questionIndex: int


class ChallengePublishRequest(BaseModel):
    publish: bool = True


class ReconcileRequest(BaseModel):
    questionIndex: int
    policy: str  # void | award_all | accept_multiple
    acceptedAnswers: Optional[List[int]] = None
    note: Optional[str] = None


class ObserveResponse(BaseModel):
    observerId: str


# --- AI Generation Request/Response Models ---

class GenerateQuestionsRequest(BaseModel):
    topics: str = Field(description="Comma-separated list of topics")
    count: int = Field(default=10, ge=3, le=50, description="Number of questions to generate")
    research_mode: bool = Field(default=False, description="Enable deeper research (uses more AI)")
    difficulty: str = Field(default="mixed", description="easy, medium, hard, or mixed")


class GenerateQuestionsResponse(BaseModel):
    questions: List[Question]
    topics_clarified: Optional[str] = None
    generation_time_ms: int


class PerformanceData(BaseModel):
    avg_score_percent: float = Field(description="Average score as percentage 0-100")
    avg_response_time_ms: int = Field(description="Average response time in milliseconds")
    player_count: int = Field(description="Number of active players")
    questions_answered: int = Field(description="Total questions answered this batch")


class GenerateDynamicBatchRequest(BaseModel):
    topics: str
    session_code: str
    batch_number: int
    performance: Optional[PerformanceData] = None
    previous_difficulty: str = "medium"
    batch_size: int = Field(default=10, ge=10, le=10)


class GenerateDynamicBatchResponse(BaseModel):
    questions: List[Question]
    suggested_difficulty: str
    difficulty_reason: str
    batch_number: int


class FactCheckRequest(BaseModel):
    question: str
    claimed_answer: str
    all_options: List[str]


class FactCheckResponse(BaseModel):
    verified: bool
    confidence: float
    explanation: str
    source_hint: Optional[str] = None


class GenerateThemeRequest(BaseModel):
    topic: str
    intensity: str = Field(default="subtle", description="subtle or strong")


class GenerateThemeResponse(BaseModel):
    theme: ThemeSpec
    fallback: bool = False
    issues: Optional[List[str]] = None


# --- AI Generation Helper Functions ---

# Auth secret for AI endpoints (simple shared secret)
QUIZ_AUTH_SECRET = os.environ.get("QUIZ_AUTH_SECRET", "")

def verify_auth_token(token: str) -> bool:
    """Verify the auth token for AI endpoints"""
    if not QUIZ_AUTH_SECRET:
        logger.warning("⚠️  QUIZ_AUTH_SECRET not set - AI endpoints unprotected!")
        return True  # Allow if not configured (dev mode)
    return token == QUIZ_AUTH_SECRET


QUIZ_SYSTEM_PROMPT = """You are a quiz question generator for a live trivia game. Generate engaging, accurate multiple-choice questions.

RULES:
1. Each question must have exactly 4 options (A, B, C, D)
2. Exactly one option must be correct
3. Include one obviously humorous/wrong option for fun
4. Mix difficulty levels unless specified
5. Questions should be educational and engaging
6. Avoid controversial, political, or sensitive topics

OUTPUT FORMAT - Return ONLY valid JSON (no markdown, no explanation):
{
  "questions": [
    {
      "question": "The question text?",
      "options": ["Option A", "Option B", "Option C", "Option D"],
      "correct": 0,
      "points": 1
    }
  ]
}

The "correct" field is the 0-based index of the correct answer (0=A, 1=B, 2=C, 3=D)."""

THEME_SYSTEM_PROMPT = """You are a UI theme planner. Return ONLY JSON with theme_id and deltas.

Output format:
{
    "theme_id": "<id>",
    "deltas": {
        "palette": {
            "background": "#RRGGBB",
            "surface": "#RRGGBB",
            "text": "#RRGGBB",
            "accent": "#RRGGBB",
            "accent2": "#RRGGBB",
            "border": "#RRGGBB"
        },
        "typography": {
            "fontFamily": "<whitelist>",
            "weights": {"base": 400, "strong": 700}
        },
        "density": "compact|comfortable",
        "components": {"button": "flat|outlined|filled", "card": "bordered|shadowed", "table": "minimal|grid"},
        "motion": "none|subtle|active",
        "motifs": "snow|scanlines|confetti|pumpkin"
    }
}

Rules:
- No raw CSS.
- Only use hex colors and whitelisted token values.
- Omit fields in deltas when no change is needed.
"""

THEME_REPAIR_PROMPT = """You are a UI theme fixer. Return ONLY JSON for a full ThemeSpec.

Schema:
{
    "palette": {"background": "#RRGGBB", "surface": "#RRGGBB", "text": "#RRGGBB", "accent": "#RRGGBB", "accent2": "#RRGGBB", "border": "#RRGGBB"},
    "typography": {"fontFamily": "<whitelist>", "weights": {"base": 400, "strong": 700}, "scale": {"sm": 0.9, "base": 1.0, "lg": 1.1, "xl": 1.3}},
    "density": "compact|comfortable",
    "components": {"button": "flat|outlined|filled", "card": "bordered|shadowed", "table": "minimal|grid"},
    "motion": "none|subtle|active",
    "motifs": "snow|scanlines|confetti|pumpkin"
}

Rules:
- No raw CSS.
- Only use hex colors and whitelisted token values.
"""


def parse_questions_from_response(content: str) -> List[Question]:
    """Parse questions JSON from Copilot response, handling various formats"""
    logger.info(f"📝 Parsing response ({len(content)} chars)")
    
    # Try to extract JSON from the response
    # Sometimes models wrap it in ```json ... ```
    json_match = re.search(r'```(?:json)?\s*([\s\S]*?)```', content)
    if json_match:
        content = json_match.group(1).strip()
    
    # Try to find JSON object
    json_start = content.find('{')
    json_end = content.rfind('}') + 1
    if json_start != -1 and json_end > json_start:
        content = content[json_start:json_end]
    
    try:
        data = json.loads(content)
        questions_data = data.get('questions', [])
        
        questions = []
        for i, q in enumerate(questions_data):
            try:
                question = Question(
                    question=q['question'],
                    options=q['options'][:4],  # Ensure max 4 options
                    correct=min(q['correct'], 3),  # Ensure valid index
                    points=q.get('points', 1),
                    explanation=q.get('explanation')
                )
                questions.append(question)
            except (KeyError, TypeError) as e:
                logger.warning(f"⚠️  Skipping invalid question {i}: {e}")
                continue
        
        logger.info(f"✅ Parsed {len(questions)} valid questions")
        return questions
        
    except json.JSONDecodeError as e:
        logger.error(f"❌ JSON parse error: {e}")
        logger.error(f"   Content preview: {content[:200]}...")
        raise ValueError(f"Failed to parse questions JSON: {e}")


def extract_json_payload(content: str) -> dict:
    """Extract a JSON object from a model response."""
    json_match = re.search(r'```(?:json)?\s*([\s\S]*?)```', content)
    if json_match:
        content = json_match.group(1).strip()

    json_match = re.search(r'\{[\s\S]*\}', content)
    if not json_match:
        raise ValueError("No JSON object found in response")

    return json.loads(json_match.group(0))


def parse_theme_patch_from_response(content: str) -> tuple[Optional[str], dict]:
    """Parse theme_id and deltas from a Copilot response."""
    data = extract_json_payload(content)
    theme_id = data.get("theme_id") or data.get("themeId")
    deltas = data.get("deltas") or {}
    if not isinstance(deltas, dict):
        deltas = {}
    if not isinstance(theme_id, str):
        theme_id = None
    return theme_id, deltas


def parse_theme_spec_from_response(content: str) -> ThemeSpec:
    """Parse a full ThemeSpec from a Copilot response."""
    data = extract_json_payload(content)
    return ThemeSpec.model_validate(data)


async def generate_theme_spec(topic: str, intensity: str) -> tuple[ThemeSpec, bool, list[str]]:
    """Generate a ThemeSpec using Copilot with validation and repair."""
    if is_sensitive_topic(topic):
        fallback = get_theme_by_id(DEFAULT_THEME_ID)
        return fallback, True, ["Sensitive topic detected; using safe theme."]

    vibes = analyze_topic(topic)
    base_theme = select_theme_base(vibes)
    base_theme = apply_intensity(base_theme, intensity)
    issues: list[str] = []
    fallback_used = False

    theme_ids = ", ".join(sorted(THEME_LIBRARY.keys()))
    font_keys = ", ".join(sorted(FONT_STACKS.keys()))
    prompt = (
        f"Topic: {topic}\n"
        f"Vibe tags: {', '.join(vibes)}\n\n"
        f"Choose a base theme_id from: {theme_ids}\n"
        f"Whitelisted font keys: {font_keys}\n"
        f"Return JSON patch only."
    )

    try:
        content = await generate_with_copilot(prompt, system_message=THEME_SYSTEM_PROMPT, caller="generate_theme")
        theme_id, deltas = parse_theme_patch_from_response(content)
        selected = get_theme_by_id(theme_id) if theme_id else None
        if selected:
            base_theme = selected
        base_theme = apply_deltas(base_theme, deltas)
        base_theme = apply_intensity(base_theme, intensity)
        issues = validate_theme_spec(base_theme)
    except Exception as e:
        logger.warning(f"Theme generation failed, falling back to base theme: {e}")
        issues = ["Theme generation failed; using base theme."]

    if issues:
        try:
            repair_prompt = (
                f"Fix the following theme issues: {issues}\n\n"
                f"Current theme: {base_theme.model_dump(by_alias=True)}"
            )
            repaired_content = await generate_with_copilot(
                repair_prompt,
                system_message=THEME_REPAIR_PROMPT,
                caller="repair_theme",
            )
            repaired_theme = parse_theme_spec_from_response(repaired_content)
            repaired_theme = apply_intensity(repaired_theme, intensity)
            repair_issues = validate_theme_spec(repaired_theme)
            if not repair_issues:
                return repaired_theme, False, []
            issues = repair_issues
        except Exception as e:
            issues.append(f"Repair failed: {e}")

        fallback = get_theme_by_id(DEFAULT_THEME_ID)
        fallback_used = True
        return fallback, fallback_used, issues

    return base_theme, fallback_used, issues


def find_copilot_cli() -> Optional[str]:
    """Find the Copilot CLI executable"""
    # Check env var first
    cli_path = os.environ.get("COPILOT_CLI_PATH")
    if cli_path and os.path.exists(cli_path):
        return cli_path
    
    # Check for bundled CLI from github-copilot-sdk package
    if COPILOT_SDK_AVAILABLE:
        try:
            import copilot
            sdk_cli_path = Path(copilot.__file__).parent / "bin" / "copilot"
            if sdk_cli_path.exists():
                # Ensure it's executable
                if not os.access(sdk_cli_path, os.X_OK):
                    try:
                        os.chmod(sdk_cli_path, 0o755)
                        logger.info(f"✓ Made SDK CLI executable: {sdk_cli_path}")
                    except Exception as e:
                        logger.warning(f"⚠️  Could not make SDK CLI executable: {e}")
                
                # Only return if executable
                if os.access(sdk_cli_path, os.X_OK):
                    return str(sdk_cli_path)
                else:
                    logger.warning(f"⚠️  SDK CLI at {sdk_cli_path} is not executable; skipping this path")
        except Exception as e:
            logger.debug(f"Could not find SDK bundled CLI: {e}")
    
    # Known Windows locations - prefer the actual exe
    possible_paths = [
        r"C:\Users\brodi\AppData\Local\Microsoft\WinGet\Packages\GitHub.Copilot_Microsoft.Winget.Source_8wekyb3d8bbwe\copilot.exe",
        r"C:\Users\brodi\AppData\Local\Microsoft\WinGet\Links\copilot.exe",
        os.path.expanduser("~\\AppData\\Local\\Microsoft\\WinGet\\Links\\copilot.exe"),
        os.path.expanduser("~\\AppData\\Local\\Microsoft\\WinGet\\Packages\\GitHub.Copilot_Microsoft.Winget.Source_8wekyb3d8bbwe\\copilot.exe"),
        os.path.expanduser("~\\AppData\\Roaming\\npm\\copilot.cmd"),
    ]
    for p in possible_paths:
        if os.path.exists(p):
            return p
    
    # Fall back to which/where
    cli_path = shutil.which("copilot")
    if cli_path:
        return cli_path
    
    return None


async def generate_with_copilot(
    prompt: str,
    system_message: str = QUIZ_SYSTEM_PROMPT,
    model: Optional[str] = None,
    caller: str = "generate_with_copilot",
) -> str:
    """Generate content using Copilot CLI directly (non-interactive mode)"""

    if not model:
        model = os.environ.get("QUIZ_COPILOT_MODEL", "gpt-4.1")

    # Validate model name (basic sanity check)
    valid_models = [
        "claude-sonnet-4.5", "claude-haiku-4.5", "claude-opus-4.5", "claude-sonnet-4",
        "gemini-3-pro-preview", "gpt-5.2-codex", "gpt-5.2", "gpt-5.1-codex-max",
        "gpt-5.1-codex", "gpt-5.1", "gpt-5", "gpt-5.1-codex-mini", "gpt-5-mini", "gpt-4.1"
    ]
    if model not in valid_models:
        copilot_log.warning("Unrecognized model: %s, using default gpt-4.1", model)
        model = "gpt-4.1"

    # Build the full prompt with system message
    full_prompt = f"""{system_message}

USER REQUEST:
{prompt}"""

    # ---- Set up call tracker for token / usage logging ------------------
    tracker = CopilotCallTracker(
        endpoint=caller,
        model=model,
        prompt_chars=len(full_prompt),
    )
    tracker.start()

    copilot_log.debug("System message:\n%s", system_message)
    copilot_log.debug("User prompt (%d chars):\n%s", len(prompt), prompt)

    cli_path = find_copilot_cli()
    if not cli_path:
        tracker.finish(success=False, error="Copilot CLI not found")
        raise HTTPException(
            status_code=503,
            detail=(
                "Copilot CLI not found. Install github-copilot-sdk (pip install github-copilot-sdk) "
                "or GitHub.Copilot (winget install GitHub.Copilot)."
            )
        )
    copilot_log.info("CLI Path: %s", cli_path)
    copilot_log.info("Model: %s  |  Prompt chars: %d", model, len(full_prompt))

    try:
        cmd = [
            cli_path,
            "-p", full_prompt,
            "-s",
            "--allow-all-tools",
            "--model", model,
        ]

        copilot_log.debug("Command: %s -p '...' -s --allow-all-tools --model %s", cmd[0], model)

        process = await asyncio.create_subprocess_exec(
            *cmd,
            stdout=asyncio.subprocess.PIPE,
            stderr=asyncio.subprocess.PIPE,
            cwd=os.getcwd()
        )

        stdout, stderr = await asyncio.wait_for(
            process.communicate(),
            timeout=120
        )

        stdout_text = stdout.decode('utf-8', errors='replace').strip()
        stderr_text = stderr.decode('utf-8', errors='replace').strip()

        # Log full stderr to copilot log (may contain token info)
        if stderr_text:
            copilot_log.debug("stderr output:\n%s", stderr_text)

        if process.returncode != 0:
            # Check for authentication errors
            if "No authentication information found" in stderr_text or "authentication" in stderr_text.lower():
                err_msg = "Copilot authentication required. Set GITHUB_TOKEN, GH_TOKEN, or COPILOT_GITHUB_TOKEN environment variable."
                tracker.finish(
                    success=False,
                    error=err_msg,
                    exit_code=process.returncode,
                    stderr_text=stderr_text,
                    stdout_text=stdout_text,
                    response_chars=len(stdout_text),
                )
                raise HTTPException(
                    status_code=401,
                    detail=err_msg + " Or run 'copilot' and use the '/login' command."
                )
            err_msg = f"Copilot CLI exit code {process.returncode}: {stderr_text[:200]}"
            tracker.finish(
                success=False,
                error=err_msg,
                exit_code=process.returncode,
                stderr_text=stderr_text,
                stdout_text=stdout_text,
                response_chars=len(stdout_text),
            )
            raise RuntimeError(err_msg)

        copilot_log.debug("Response (%d chars):\n%s", len(stdout_text), stdout_text[:2000])

        if not stdout_text:
            copilot_log.warning("EMPTY RESPONSE from Copilot CLI")

        # Finalise tracking – this writes the JSONL token record
        tracker.finish(
            success=True,
            exit_code=process.returncode,
            stderr_text=stderr_text,
            stdout_text=stdout_text,
            response_chars=len(stdout_text),
        )

        return stdout_text

    except asyncio.TimeoutError:
        tracker.finish(success=False, error="Timeout after 120s")
        raise RuntimeError("Copilot CLI timed out after 120 seconds")

    except Exception as e:
        # The tracker may already have been finished above; guard against
        # double-finish by checking if _start is still set.
        if tracker._start:
            tracker.finish(
                success=False,
                error=f"{type(e).__name__}: {e}",
            )
        copilot_log.error("Full traceback:\n%s", traceback.format_exc())
        raise


# --- Timer Logic ---

async def run_question_timer(code: str, question_index: int):
    """Run the countdown timer for a question"""
    if code not in sessions:
        return
    
    session = sessions[code]
    remaining = session.timer_seconds
    session.timer_remaining = remaining
    
    while remaining > 0 and session.status == 'playing' and session.current_question_index == question_index:
        # Broadcast timer tick
        await broadcast_to_session(code, {
            'type': 'timer_tick',
            'remaining': remaining,
            'questionIndex': question_index
        })
        
        await asyncio.sleep(1)
        remaining -= 1
        session.timer_remaining = remaining
    
    # Timer expired - auto advance
    if session.status == 'playing' and session.current_question_index == question_index:
        session.timer_remaining = 0
        await broadcast_to_session(code, {
            'type': 'timer_tick',
            'remaining': 0,
            'questionIndex': question_index
        })
        
        # Small delay before auto-advancing
        await asyncio.sleep(1)
        
        # Check again in case host manually advanced
        if session.status == 'playing' and session.current_question_index == question_index:
            # Auto-advance to next question or reveal
            if session.current_question_index >= len(session.questions) - 1:
                # Last question - reveal results
                session.status = 'revealed'
                session.calculate_scores()
                results = session.get_reveal_results()
                await broadcast_to_session(code, {
                    'type': 'revealed',
                    'results': results.model_dump()
                })
            else:
                # Move to next question
                session.current_question_index += 1
                session.question_start_times[session.current_question_index] = time.time()
                
                await broadcast_to_session(code, {
                    'type': 'question_started',
                    'questionIndex': session.current_question_index
                })
                
                # Start new timer
                if session.timer_mode:
                    task = asyncio.create_task(run_question_timer(code, session.current_question_index))
                    timer_tasks[code] = task


def cancel_timer(code: str):
    """Cancel any running timer for a session"""
    if code in timer_tasks:
        timer_tasks[code].cancel()
        del timer_tasks[code]


async def auto_advance_question(code: str, session):
    """Auto-advance to next question or reveal (used by auto-progress mode)"""
    # Cancel any running timer since we're advancing early
    cancel_timer(code)
    
    if session.current_question_index >= len(session.questions) - 1:
        # Last question - reveal results
        session.status = 'revealed'
        session.calculate_scores()
        results = session.get_reveal_results()
        await broadcast_to_session(code, {
            'type': 'revealed',
            'results': results.model_dump()
        })
    else:
        # Move to next question
        session.current_question_index += 1
        session.question_start_times[session.current_question_index] = time.time()
        
        await broadcast_to_session(code, {
            'type': 'question_started',
            'questionIndex': session.current_question_index
        })
        
        # Start new timer if timer mode is also enabled
        if session.timer_mode:
            task = asyncio.create_task(run_question_timer(code, session.current_question_index))
            timer_tasks[code] = task


# --- Helper Functions ---

def build_challenge_summary(session: Session, question_index: int) -> dict:
    submissions = session.challenges.get(question_index, {})
    categories: dict[str, int] = {}
    latest_ts = 0.0

    for submission in submissions.values():
        if submission.category:
            categories[submission.category] = categories.get(submission.category, 0) + 1
        latest_ts = max(latest_ts, submission.createdAt)

    resolution = session.challenge_resolutions.get(question_index)
    if resolution and resolution.resolvedAt:
        latest_ts = max(latest_ts, resolution.resolvedAt)

    if 0 <= question_index < len(session.questions):
        question_text = session.questions[question_index].question
    else:
        question_text = f"Question {question_index + 1}"

    status = resolution.status if resolution else "open"
    return {
        "questionIndex": question_index,
        "question": question_text,
        "count": len(submissions),
        "status": status,
        "categories": categories,
        "lastUpdatedAt": latest_ts or time.time(),
    }


async def broadcast_to_session(code: str, message: dict, exclude_id: Optional[str] = None, host_only: bool = False, exclude_observers: bool = False):
    """Broadcast a message to all connections in a session"""
    # Store event for polling fallback
    if code not in session_events:
        session_events[code] = []
    event_copy = {**message, '_hostOnly': host_only, '_excludeObservers': exclude_observers}
    add_session_event(code, event_copy)
    
    if code not in ws_connections:
        return
    
    dead_connections = []
    for conn_id, (ws, role, identifier) in ws_connections[code].items():
        if conn_id == exclude_id:
            continue
        
        # Skip players/observers if host_only is True
        if host_only and role != 'host':
            continue
        
        # Skip observers if exclude_observers is True
        if exclude_observers and role == 'observer':
            continue
            
        try:
            # Personalize reveal results for players
            if message.get('type') == 'revealed' and role == 'player':
                session = sessions.get(code)
                if session:
                    personalized_results = session.get_reveal_results(identifier)
                    personalized_msg = {
                        'type': 'revealed',
                        'results': personalized_results.model_dump()
                    }
                    await ws.send_json(personalized_msg)
                    continue
            
            await ws.send_json(message)
        except Exception:
            dead_connections.append(conn_id)
    
    # Clean up dead connections
    for conn_id in dead_connections:
        del ws_connections[code][conn_id]
    if dead_connections:
        logger.debug(f"🧹 Cleaned {len(dead_connections)} dead connection(s) in session {code}")


# --- REST Endpoints ---

@app.post("/api/session", response_model=CreateSessionResponse)
async def create_session(request: CreateSessionRequest = CreateSessionRequest()):
    """Create a new quiz session"""
    # Generate unique code
    code = generate_session_code()
    while code in sessions:
        code = generate_session_code()
    
    host_token = generate_token()
    sessions[code] = Session(
        code=code, 
        host_token=host_token,
        timer_mode=request.timerMode,
        timer_seconds=max(5, min(120, request.timerSeconds)),  # Clamp between 5-120 seconds
        auto_progress_mode=request.autoProgressMode,
        auto_progress_percent=max(50, min(100, request.autoProgressPercent))  # Clamp between 50-100%
    )
    ws_connections[code] = {}

    logger.info(f"🆕 Session created: {code} (timer={request.timerMode}, autoProgress={request.autoProgressMode})")
    log_game_event("session_created", session_code=code, data={
        "timer_mode": request.timerMode,
        "timer_seconds": request.timerSeconds,
        "auto_progress_mode": request.autoProgressMode,
        "auto_progress_percent": request.autoProgressPercent,
    })

    return CreateSessionResponse(code=code, hostToken=host_token)


@app.post("/api/session/{code}/join", response_model=JoinResponse)
async def join_session(code: str, request: JoinRequest):
    """Join an existing session as a player"""
    if code not in sessions:
        raise HTTPException(status_code=404, detail="Session not found")
    
    session = sessions[code]
    
    if session.status != 'lobby':
        raise HTTPException(status_code=400, detail="Session already in progress")
    
    # Check for duplicate nickname
    for p in session.players.values():
        if p.nickname.lower() == request.nickname.lower():
            raise HTTPException(status_code=400, detail="Nickname already taken")
    
    player_id = generate_player_id()
    player = Player(id=player_id, nickname=request.nickname)
    session.players[player_id] = player

    logger.info(f"👤 Player joined: {request.nickname} -> session {code} (total={len(session.players)})")
    log_game_event("player_joined", session_code=code, player_id=player_id, data={
        "nickname": request.nickname,
        "player_count": len(session.players),
    })

    # Notify all connections
    await broadcast_to_session(code, {
        'type': 'player_joined',
        'player': player.model_dump()
    })
    
    return JoinResponse(playerId=player_id)


@app.post("/api/session/{code}/observe", response_model=ObserveResponse)
async def observe_session(code: str):
    """Join an existing session as an observer (audience)"""
    if code not in sessions:
        raise HTTPException(status_code=404, detail="Session not found")
    
    observer_id = generate_player_id()
    session = sessions[code]
    session.observers[observer_id] = observer_id

    logger.debug(f"👁️ Observer joined session {code} (total observers={len(session.observers)})")
    log_game_event("observer_joined", session_code=code, data={"observer_count": len(session.observers)})

    return ObserveResponse(observerId=observer_id)


@app.get("/api/session/{code}/leaderboard")
async def get_leaderboard(code: str):
    """Get the current live leaderboard"""
    if code not in sessions:
        raise HTTPException(status_code=404, detail="Session not found")
    
    session = sessions[code]
    leaderboard = session.get_live_leaderboard()
    
    return {"leaderboard": [e.model_dump() for e in leaderboard]}


@app.get("/api/session/{code}/stats/{question_index}")
async def get_question_stats(code: str, question_index: int):
    """Get answer statistics for a specific question"""
    if code not in sessions:
        raise HTTPException(status_code=404, detail="Session not found")
    
    session = sessions[code]
    stats = session.get_question_stats(question_index)
    
    return {"stats": stats.model_dump()}


@app.get("/api/session/{code}/answer-status")
async def get_answer_status(
    code: str,
    x_host_token: str = Header(alias="X-Host-Token")
):
    """Get which players have/haven't answered (host only)"""
    if code not in sessions:
        raise HTTPException(status_code=404, detail="Session not found")
    
    session = sessions[code]
    
    if session.host_token != x_host_token:
        raise HTTPException(status_code=403, detail="Invalid host token")
    
    status = session.get_answer_status(session.current_question_index)
    
    # Include player nicknames
    answered_players = [
        {"id": pid, "nickname": session.players[pid].nickname}
        for pid in status.answered if pid in session.players
    ]
    waiting_players = [
        {"id": pid, "nickname": session.players[pid].nickname}
        for pid in status.waiting if pid in session.players
    ]
    
    return {
        "answered": answered_players,
        "waiting": waiting_players
    }


@app.post("/api/session/{code}/questions")
async def upload_questions(
    code: str, 
    request: UploadQuestionsRequest,
    x_host_token: str = Header(alias="X-Host-Token")
):
    """Upload questions to a session (host only)"""
    if code not in sessions:
        raise HTTPException(status_code=404, detail="Session not found")
    
    session = sessions[code]
    
    if session.host_token != x_host_token:
        raise HTTPException(status_code=403, detail="Invalid host token")
    
    if session.status != 'lobby':
        raise HTTPException(status_code=400, detail="Cannot modify questions after start")
    
    session.questions = request.questions

    logger.info(f"📤 Questions uploaded to session {code}: {len(request.questions)} questions")
    log_game_event("questions_uploaded", session_code=code, data={"count": len(request.questions)})

    return {"ok": True, "count": len(request.questions)}


class SetThemeRequest(BaseModel):
    theme: dict


@app.post("/api/session/{code}/theme")
async def set_session_theme(
    code: str,
    request: SetThemeRequest,
    x_host_token: str = Header(alias="X-Host-Token")
):
    """Set the session theme (host only). Broadcasts to all connected clients."""
    if code not in sessions:
        raise HTTPException(status_code=404, detail="Session not found")

    session = sessions[code]

    if session.host_token != x_host_token:
        raise HTTPException(status_code=403, detail="Invalid host token")

    session.theme = request.theme

    logger.info(f"🎨 Theme updated for session {code}")
    log_game_event("theme_updated", session_code=code, data={"themeId": request.theme.get("themeId")})

    # Broadcast theme to all connected clients (players, observers)
    await broadcast_to_session(code, {
        'type': 'theme_updated',
        'theme': request.theme
    })

    return {"ok": True}


@app.post("/api/session/{code}/append-questions")
async def append_questions(
    code: str,
    request: UploadQuestionsRequest,
    x_host_token: str = Header(alias="X-Host-Token")
):
    """Append questions to a session mid-game (host only). Enables dynamic batching."""
    if code not in sessions:
        raise HTTPException(status_code=404, detail="Session not found")
    
    session = sessions[code]
    
    if session.host_token != x_host_token:
        raise HTTPException(status_code=403, detail="Invalid host token")
    
    if session.status not in ('lobby', 'playing'):
        raise HTTPException(status_code=400, detail="Cannot append questions after reveal")
    
    if not request.questions:
        raise HTTPException(status_code=400, detail="No questions provided")
    
    # Append to existing questions instead of replacing
    previous_count = len(session.questions)
    session.questions.extend(request.questions)
    new_count = len(session.questions)
    
    logger.info(f"📝 Appended {len(request.questions)} questions to session {code} ({previous_count} -> {new_count})")
    
    # Broadcast questions_updated event to all clients
    await broadcast_to_session(code, {
        'type': 'questions_updated',
        'totalQuestions': new_count,
        'addedCount': len(request.questions)
    })
    
    # Also send updated session state so clients have the new question list
    await broadcast_to_session(code, {
        'type': 'session_state',
        'state': session.to_state().model_dump()
    })
    
    return {"ok": True, "previousCount": previous_count, "newCount": new_count, "appended": len(request.questions)}


@app.get("/api/session/{code}/performance")
async def get_performance(
    code: str,
    x_host_token: str = Header(alias="X-Host-Token"),
    last_n: int = 5
):
    """Get performance metrics for the session (host only). Used for adaptive difficulty."""
    if code not in sessions:
        raise HTTPException(status_code=404, detail="Session not found")
    
    session = sessions[code]
    
    if session.host_token != x_host_token:
        raise HTTPException(status_code=403, detail="Invalid host token")
    
    players = list(session.players.values())
    if not players:
        return {
            "avg_score_percent": 0.0,
            "avg_response_time_ms": 0,
            "player_count": 0,
            "questions_answered": 0,
            "per_question": []
        }
    
    # Determine question range to analyze (last N questions up to current)
    current_idx = session.current_question_index
    start_idx = max(0, current_idx - last_n + 1)
    question_range = range(start_idx, current_idx + 1)
    
    total_correct = 0
    total_attempts = 0
    total_response_time_ms = 0
    response_time_count = 0
    
    per_question_stats = []
    
    for q_idx in question_range:
        if q_idx >= len(session.questions):
            continue
        question = session.questions[q_idx]
        q_correct = 0
        q_attempts = 0
        q_total_time_ms = 0
        q_time_count = 0
        
        for player in players:
            if q_idx in player.answers:
                q_attempts += 1
                total_attempts += 1
                if player.answers[q_idx] == question.correct:
                    q_correct += 1
                    total_correct += 1
                
                if q_idx in player.answer_times:
                    time_ms = int(player.answer_times[q_idx] * 1000)
                    q_total_time_ms += time_ms
                    q_time_count += 1
                    total_response_time_ms += time_ms
                    response_time_count += 1
        
        per_question_stats.append({
            "questionIndex": q_idx,
            "correct": q_correct,
            "attempts": q_attempts,
            "score_percent": round((q_correct / q_attempts * 100), 1) if q_attempts > 0 else 0.0,
            "avg_response_time_ms": int(q_total_time_ms / q_time_count) if q_time_count > 0 else 0
        })
    
    avg_score_percent = round((total_correct / total_attempts * 100), 1) if total_attempts > 0 else 0.0
    avg_response_time_ms = int(total_response_time_ms / response_time_count) if response_time_count > 0 else 0
    
    return {
        "avg_score_percent": avg_score_percent,
        "avg_response_time_ms": avg_response_time_ms,
        "player_count": len(players),
        "questions_answered": total_attempts,
        "per_question": per_question_stats
    }


@app.post("/api/session/{code}/start")
async def start_round(code: str, x_host_token: str = Header(alias="X-Host-Token")):
    """Start the quiz round (host only)"""
    if code not in sessions:
        raise HTTPException(status_code=404, detail="Session not found")
    
    session = sessions[code]
    
    if session.host_token != x_host_token:
        raise HTTPException(status_code=403, detail="Invalid host token")
    
    if len(session.questions) == 0:
        raise HTTPException(status_code=400, detail="No questions loaded")
    
    session.status = 'playing'
    session.current_question_index = 0
    session.question_start_times[0] = time.time()  # Record start time

    logger.info(f"🚀 Round started: session {code}, {len(session.questions)} questions, {len(session.players)} players")
    log_game_event("round_started", session_code=code, data={
        "question_count": len(session.questions),
        "player_count": len(session.players),
        "timer_mode": session.timer_mode,
    })

    # Broadcast to all
    await broadcast_to_session(code, {
        'type': 'question_started',
        'questionIndex': 0
    })
    
    # Also send updated session state
    await broadcast_to_session(code, {
        'type': 'session_state',
        'state': session.to_state().model_dump()
    })
    
    # Start timer if timer mode is enabled
    if session.timer_mode:
        task = asyncio.create_task(run_question_timer(code, 0))
        timer_tasks[code] = task
    
    return {"ok": True}


@app.post("/api/session/{code}/next")
async def next_question(code: str, x_host_token: str = Header(alias="X-Host-Token")):
    """Advance to the next question (host only)"""
    if code not in sessions:
        raise HTTPException(status_code=404, detail="Session not found")
    
    session = sessions[code]
    
    if session.host_token != x_host_token:
        raise HTTPException(status_code=403, detail="Invalid host token")
    
    if session.status != 'playing':
        raise HTTPException(status_code=400, detail="Round not in progress")
    
    if session.current_question_index >= len(session.questions) - 1:
        raise HTTPException(status_code=400, detail="No more questions")
    
    # Cancel any running timer
    cancel_timer(code)
    
    session.current_question_index += 1
    session.question_start_times[session.current_question_index] = time.time()  # Record start time

    logger.info(f"⏭️ Next question: session {code}, Q{session.current_question_index + 1}/{len(session.questions)}")
    log_game_event("next_question", session_code=code, data={
        "question_index": session.current_question_index,
        "total_questions": len(session.questions),
    })

    await broadcast_to_session(code, {
        'type': 'question_started',
        'questionIndex': session.current_question_index
    })
    
    # Start new timer if timer mode is enabled
    if session.timer_mode:
        task = asyncio.create_task(run_question_timer(code, session.current_question_index))
        timer_tasks[code] = task
    
    return {"ok": True}


@app.post("/api/session/{code}/reveal")
async def reveal_results(code: str, x_host_token: str = Header(alias="X-Host-Token")):
    """End the round and reveal all results (host only)"""
    if code not in sessions:
        raise HTTPException(status_code=404, detail="Session not found")
    
    session = sessions[code]
    
    if session.host_token != x_host_token:
        raise HTTPException(status_code=403, detail="Invalid host token")
    
    # Cancel any running timer
    cancel_timer(code)
    
    session.status = 'revealed'
    session.calculate_scores()

    logger.info(f"🏁 Round revealed: session {code}, {len(session.players)} players")
    log_game_event("round_revealed", session_code=code, data={
        "player_count": len(session.players),
        "question_count": len(session.questions),
    })

    # Broadcast reveal - personalization happens in broadcast_to_session
    results = session.get_reveal_results()
    await broadcast_to_session(code, {
        'type': 'revealed',
        'results': results.model_dump()
    })
    
    return {"ok": True}


@app.post("/api/session/{code}/answer")
async def submit_answer(code: str, request: AnswerRequest):
    """Submit an answer to the current question (player)"""
    if code not in sessions:
        raise HTTPException(status_code=404, detail="Session not found")
    
    session = sessions[code]
    
    if request.playerId not in session.players:
        raise HTTPException(status_code=404, detail="Player not found")
    
    if session.status != 'playing':
        raise HTTPException(status_code=400, detail="Round not in progress")
    
    if request.questionIndex != session.current_question_index:
        raise HTTPException(status_code=400, detail="Wrong question")
    
    player = session.players[request.playerId]
    
    # Only allow one answer per question
    if request.questionIndex in player.answers:
        raise HTTPException(status_code=400, detail="Already answered")
    
    player.answers[request.questionIndex] = request.choice

    is_correct = request.choice == session.questions[request.questionIndex].correct
    log_game_event("answer_submitted", session_code=code, player_id=request.playerId, data={
        "question_index": request.questionIndex,
        "choice": request.choice,
        "correct": is_correct,
        "response_time_ms": request.response_time_ms,
    })

    # Record answer time - prefer client-measured time, fall back to server-side calculation
    if request.response_time_ms is not None and request.response_time_ms >= 0:
        player.answer_times[request.questionIndex] = request.response_time_ms / 1000.0
    else:
        start_time = session.question_start_times.get(request.questionIndex, time.time())
        player.answer_times[request.questionIndex] = time.time() - start_time
    
    # Get answer status (who has/hasn't answered)
    answer_status = session.get_answer_status(request.questionIndex)
    
    # Get current leaderboard
    leaderboard = session.get_live_leaderboard()
    
    # Get question stats for observers
    stats = session.get_question_stats(request.questionIndex)
    
    # Notify host with detailed answer status
    await broadcast_to_session(code, {
        'type': 'answer_received',
        'playerId': request.playerId,
        'questionIndex': request.questionIndex,
        'answerStatus': answer_status.model_dump()
    }, host_only=True)
    
    # Broadcast leaderboard update to all (except answer details)
    await broadcast_to_session(code, {
        'type': 'leaderboard_update',
        'leaderboard': [e.model_dump() for e in leaderboard]
    })
    
    # Broadcast question stats to observers and host
    await broadcast_to_session(code, {
        'type': 'question_stats',
        'stats': stats.model_dump()
    }, exclude_observers=False)
    
    # Check auto-progress mode: if enough players have answered, auto-advance
    if session.auto_progress_mode and len(session.players) > 0:
        answered_count = len(answer_status.answered)
        total_players = len(session.players)
        answer_percent = (answered_count / total_players) * 100
        
        if answer_percent >= session.auto_progress_percent:
            logger.info(f"🚀 Auto-progress triggered: {answer_percent:.0f}% answered (threshold: {session.auto_progress_percent}%)")
            # Auto-advance to next question or reveal
            await auto_advance_question(code, session)
    
    return {"ok": True}



@app.post("/api/session/{code}/challenge")
async def submit_challenge(code: str, request: ChallengeRequest):
    """Submit a challenge/flag for a question (player)."""
    if code not in sessions:
        raise HTTPException(status_code=404, detail="Session not found")

    session = sessions[code]
    if request.playerId not in session.players:
        raise HTTPException(status_code=404, detail="Player not found")

    if request.questionIndex < 0 or request.questionIndex >= len(session.questions):
        raise HTTPException(status_code=400, detail="Invalid question index")

    player = session.players[request.playerId]
    submission = ChallengeSubmission(
        playerId=request.playerId,
        nickname=player.nickname,
        questionIndex=request.questionIndex,
        category=request.category,
        note=request.note,
        source=request.source,
        createdAt=time.time(),
    )

    if request.questionIndex not in session.challenges:
        session.challenges[request.questionIndex] = {}
    session.challenges[request.questionIndex][request.playerId] = submission

    summary = build_challenge_summary(session, request.questionIndex)
    await broadcast_to_session(code, {
        "type": "challenge_updated",
        "questionIndex": summary["questionIndex"],
        "count": summary["count"],
        "status": summary["status"],
        "categories": summary["categories"],
    }, host_only=True)

    log_game_event("challenge_submitted", session_code=code, player_id=request.playerId, data={
        "question_index": request.questionIndex,
        "category": request.category,
        "source": request.source,
    })

    return {"ok": True}


@app.get("/api/session/{code}/challenges/mine")
async def get_my_challenges(code: str, player_id: str):
    """Get question indexes challenged by a player."""
    if code not in sessions:
        raise HTTPException(status_code=404, detail="Session not found")

    session = sessions[code]
    if player_id not in session.players:
        raise HTTPException(status_code=404, detail="Player not found")

    question_indexes = [
        q_idx for q_idx, submissions in session.challenges.items()
        if player_id in submissions
    ]
    return {"questionIndexes": sorted(question_indexes)}


@app.get("/api/session/{code}/challenges")
async def get_challenges(code: str, x_host_token: str = Header(alias="X-Host-Token")):
    """Get all challenge summaries (host only)."""
    if code not in sessions:
        raise HTTPException(status_code=404, detail="Session not found")

    session = sessions[code]
    if session.host_token != x_host_token:
        raise HTTPException(status_code=403, detail="Invalid host token")

    summaries = [build_challenge_summary(session, q_idx) for q_idx in session.challenges.keys()]
    summaries.sort(key=lambda s: s["questionIndex"])
    return {"challenges": summaries}


@app.get("/api/session/{code}/challenges/{question_index}")
async def get_challenge_detail(
    code: str,
    question_index: int,
    x_host_token: str = Header(alias="X-Host-Token")
):
    """Get challenge detail for a question (host only)."""
    if code not in sessions:
        raise HTTPException(status_code=404, detail="Session not found")

    session = sessions[code]
    if session.host_token != x_host_token:
        raise HTTPException(status_code=403, detail="Invalid host token")

    if question_index < 0 or question_index >= len(session.questions):
        raise HTTPException(status_code=404, detail="Question not found")

    question = session.questions[question_index]
    submissions = list(session.challenges.get(question_index, {}).values())
    resolution = session.challenge_resolutions.get(question_index)
    ai_verification = session.ai_verifications.get(question_index)
    reconciliation = session.reconciliations.get(question_index)

    return {
        "questionIndex": question_index,
        "question": question.question,
        "options": question.options,
        "correct": question.correct,
        "explanation": question.explanation,
        "submissions": [s.model_dump() for s in submissions],
        "resolution": resolution.model_dump() if resolution else None,
        "aiVerification": ai_verification.model_dump() if ai_verification else None,
        "reconciliation": reconciliation.model_dump() if reconciliation else None,
    }


@app.post("/api/session/{code}/challenges/{question_index}/resolution")
async def resolve_challenge(
    code: str,
    question_index: int,
    request: ChallengeResolutionRequest,
    x_host_token: str = Header(alias="X-Host-Token")
):
    """Update challenge resolution (host only)."""
    if code not in sessions:
        raise HTTPException(status_code=404, detail="Session not found")

    session = sessions[code]
    if session.host_token != x_host_token:
        raise HTTPException(status_code=403, detail="Invalid host token")

    if question_index < 0 or question_index >= len(session.questions):
        raise HTTPException(status_code=404, detail="Question not found")

    resolution = ChallengeResolution(
        status=request.status,
        verdict=request.verdict,
        resolutionNote=request.resolutionNote,
        resolvedAt=time.time(),
        resolvedBy="host",
        published=request.publish,
    )
    session.challenge_resolutions[question_index] = resolution

    summary = build_challenge_summary(session, question_index)
    await broadcast_to_session(code, {
        "type": "challenge_updated",
        "questionIndex": summary["questionIndex"],
        "count": summary["count"],
        "status": summary["status"],
        "categories": summary["categories"],
    }, host_only=True)

    await broadcast_to_session(code, {
        "type": "challenge_resolution",
        "questionIndex": question_index,
        "resolution": resolution.model_dump(),
    }, host_only=not request.publish)

    return {"ok": True, "resolution": resolution.model_dump()}


@app.post("/api/session/{code}/challenges/{question_index}/ai-verify")
async def ai_verify_challenge(
    code: str,
    question_index: int,
    request: ChallengeAIVerifyRequest,
    x_host_token: str = Header(alias="X-Host-Token"),
    x_auth_token: str = Header(alias="X-Auth-Token")
):
    """Request AI verification for a challenge (host only)."""
    if code not in sessions:
        raise HTTPException(status_code=404, detail="Session not found")

    session = sessions[code]
    if session.host_token != x_host_token:
        raise HTTPException(status_code=403, detail="Invalid host token")

    if not verify_auth_token(x_auth_token):
        raise HTTPException(status_code=401, detail="Invalid auth token")

    if question_index < 0 or question_index >= len(session.questions):
        raise HTTPException(status_code=404, detail="Question not found")

    question = session.questions[question_index]
    prompt = (
        "Review this trivia question and decide if the provided correct answer is valid. "
        "Return JSON only with verdict (valid|invalid|ambiguous), confidence (0-1), rationale, "
        "and suggested_correction (optional).\n\n"
        f"Question: {question.question}\n"
        f"Options: {question.options}\n"
        f"Correct index: {question.correct}\n"
        f"Correct text: {question.options[question.correct]}\n"
    )

    content = await generate_with_copilot(
        prompt,
        system_message="You are a fact-checker. Output ONLY valid JSON.",
        caller="challenge_ai_verify",
    )

    data = extract_json_payload(content)
    verdict = str(data.get("verdict", "ambiguous")).strip().lower()
    confidence = float(data.get("confidence", 0.5))
    confidence = max(0.0, min(1.0, confidence))
    rationale = str(data.get("rationale", ""))
    suggested = data.get("suggested_correction")

    verification = AIVerification(
        verdict=verdict,
        confidence=confidence,
        rationale=rationale,
        suggested_correction=suggested,
        requestedAt=time.time(),
        published=False,
    )
    session.ai_verifications[question_index] = verification

    await broadcast_to_session(code, {
        "type": "challenge_ai_verified",
        "questionIndex": question_index,
        "aiVerification": verification.model_dump(),
    }, host_only=True)

    return {"ok": True, "aiVerification": verification.model_dump()}


@app.post("/api/session/{code}/challenges/{question_index}/ai-publish")
async def publish_ai_verification(
    code: str,
    question_index: int,
    request: ChallengePublishRequest,
    x_host_token: str = Header(alias="X-Host-Token")
):
    """Publish AI verification to players (host only)."""
    if code not in sessions:
        raise HTTPException(status_code=404, detail="Session not found")

    session = sessions[code]
    if session.host_token != x_host_token:
        raise HTTPException(status_code=403, detail="Invalid host token")

    verification = session.ai_verifications.get(question_index)
    if not verification:
        raise HTTPException(status_code=400, detail="AI verification not found")

    verification.published = request.publish
    verification.publishedAt = time.time() if request.publish else None
    session.ai_verifications[question_index] = verification

    await broadcast_to_session(code, {
        "type": "challenge_ai_published",
        "questionIndex": question_index,
        "aiVerification": verification.model_dump(),
    })

    return {"ok": True, "aiVerification": verification.model_dump()}


@app.post("/api/session/{code}/challenges/{question_index}/reconcile")
async def reconcile_scores(
    code: str,
    question_index: int,
    request: ReconcileRequest,
    x_host_token: str = Header(alias="X-Host-Token")
):
    """Reconcile scores for a question (host only)."""
    if code not in sessions:
        raise HTTPException(status_code=404, detail="Session not found")

    session = sessions[code]
    if session.host_token != x_host_token:
        raise HTTPException(status_code=403, detail="Invalid host token")

    if question_index < 0 or question_index >= len(session.questions):
        raise HTTPException(status_code=404, detail="Question not found")

    if request.policy not in ("void", "award_all", "accept_multiple"):
        raise HTTPException(status_code=400, detail="Invalid policy")

    accepted_answers = request.acceptedAnswers or None
    policy = ReconciliationPolicy(
        policy=request.policy,
        acceptedAnswers=accepted_answers,
        appliedAt=time.time(),
        appliedBy="host",
    )

    prev_scores = {pid: p.score for pid, p in session.players.items()}
    session.reconciliations[question_index] = policy
    session.calculate_scores()

    deltas = {pid: session.players[pid].score - prev_scores.get(pid, 0) for pid in session.players}
    session.score_audit.append(ScoreAuditEntry(
        questionIndex=question_index,
        policy=request.policy,
        appliedAt=policy.appliedAt,
        deltas=deltas,
    ))

    await broadcast_to_session(code, {
        "type": "scores_reconciled",
        "questionIndex": question_index,
        "policy": policy.model_dump(),
        "deltas": deltas,
    })

    leaderboard = session.get_live_leaderboard()
    await broadcast_to_session(code, {
        "type": "leaderboard_update",
        "leaderboard": [e.model_dump() for e in leaderboard]
    })

    summary = build_challenge_summary(session, question_index)
    await broadcast_to_session(code, {
        "type": "challenge_updated",
        "questionIndex": summary["questionIndex"],
        "count": summary["count"],
        "status": summary["status"],
        "categories": summary["categories"],
    }, host_only=True)

    return {"ok": True, "policy": policy.model_dump(), "audit": {"deltas": deltas}}


# --- WebSocket Endpoint ---

@app.websocket("/ws/session/{code}")
async def websocket_session(websocket: WebSocket, code: str):
    """WebSocket connection for real-time session updates"""
    if code not in sessions:
        await websocket.close(code=4004, reason="Session not found")
        return
    
    await websocket.accept()
    
    # Generate a connection ID
    conn_id = generate_player_id()
    role = None
    identifier = None
    
    try:
        # Wait for identification message
        data = await asyncio.wait_for(websocket.receive_json(), timeout=10.0)
        
        if data.get('type') == 'identify_host':
            host_token = data.get('hostToken')
            session = sessions[code]
            if session.host_token != host_token:
                await websocket.send_json({'type': 'error', 'message': 'Invalid host token'})
                await websocket.close()
                return
            role = 'host'
            identifier = 'host'
        
        elif data.get('type') == 'identify_player':
            player_id = data.get('playerId')
            session = sessions[code]
            if player_id not in session.players:
                await websocket.send_json({'type': 'error', 'message': 'Player not found'})
                await websocket.close()
                return
            role = 'player'
            identifier = player_id
        
        elif data.get('type') == 'identify_observer':
            observer_id = data.get('observerId')
            session = sessions[code]
            if observer_id not in session.observers:
                await websocket.send_json({'type': 'error', 'message': 'Observer not found'})
                await websocket.close()
                return
            role = 'observer'
            identifier = observer_id
        
        else:
            await websocket.send_json({'type': 'error', 'message': 'Invalid identification'})
            await websocket.close()
            return
        
        # Register connection
        ws_connections[code][conn_id] = (websocket, role, identifier)
        logger.info(f"🔌 WebSocket connected: role={role}, session={code}")
        log_game_event("ws_connected", session_code=code, data={"role": role, "conn_id": conn_id})
        
        # Send current session state
        session = sessions[code]
        state_msg = {
            'type': 'session_state',
            'state': session.to_state().model_dump()
        }
        
        # For observers, also send current leaderboard and stats
        if role == 'observer':
            state_msg['leaderboard'] = [e.model_dump() for e in session.get_live_leaderboard()]
            if session.status == 'playing':
                state_msg['stats'] = session.get_question_stats(session.current_question_index).model_dump()
        
        await websocket.send_json(state_msg)
        
        # Keep connection alive and handle incoming messages
        while True:
            try:
                data = await websocket.receive_json()
                # Handle any additional messages if needed
                # Currently we don't expect any after identification
            except WebSocketDisconnect:
                break
    
    except asyncio.TimeoutError:
        await websocket.close(code=4008, reason="Identification timeout")
    except WebSocketDisconnect:
        pass
    except Exception as e:
        logger.error(f"🔌 WebSocket error for session {code}: {e}", exc_info=True)
    finally:
        # Clean up connection
        if code in ws_connections and conn_id in ws_connections[code]:
            del ws_connections[code][conn_id]
            logger.info(f"🔌 WebSocket disconnected: role={role}, session={code}")
            log_game_event("ws_disconnected", session_code=code, data={"role": role, "conn_id": conn_id})

            # Notify others if a player left
            if role == 'player' and identifier:
                await broadcast_to_session(code, {
                    'type': 'player_left',
                    'playerId': identifier
                })


@app.get("/health")
async def health():
    """Health check endpoint"""
    return {"status": "ok"}


# --- Polling Fallback Endpoints (for Zscaler/corporate networks where WebSockets are blocked) ---

@app.get("/api/session/{code}/state")
async def get_session_state(
    code: str,
    player_id: Optional[str] = None,
    observer_id: Optional[str] = None,
    x_host_token: Optional[str] = Header(default=None, alias="X-Host-Token")
):
    """Get current session state (polling fallback for WebSocket)"""
    if code not in sessions:
        raise HTTPException(status_code=404, detail="Session not found")
    
    session = sessions[code]
    
    # Verify caller is authorized (host, player, or observer)
    role = None
    if x_host_token:
        if session.host_token != x_host_token:
            raise HTTPException(status_code=403, detail="Invalid host token")
        role = 'host'
    elif player_id:
        if player_id not in session.players:
            raise HTTPException(status_code=404, detail="Player not found")
        role = 'player'
    elif observer_id:
        if observer_id not in session.observers:
            raise HTTPException(status_code=404, detail="Observer not found")
        role = 'observer'
    else:
        raise HTTPException(status_code=400, detail="Must provide player_id, observer_id, or X-Host-Token")
    
    state = session.to_state().model_dump()
    
    # If revealed and this is a player, personalize the results
    if session.status == 'revealed' and player_id:
        results = session.get_reveal_results(player_id)
        state['revealResults'] = results.model_dump()
    elif session.status == 'revealed' and (x_host_token or observer_id):
        results = session.get_reveal_results()
        state['revealResults'] = results.model_dump()
    
    # For observers, include leaderboard and stats
    if role == 'observer':
        state['leaderboard'] = [e.model_dump() for e in session.get_live_leaderboard()]
        if session.status == 'playing':
            state['stats'] = session.get_question_stats(session.current_question_index).model_dump()
    
    return state


@app.get("/api/session/{code}/events")
async def get_session_events(
    code: str,
    since_id: int = 0,
    player_id: Optional[str] = None,
    observer_id: Optional[str] = None,
    x_host_token: Optional[str] = Header(default=None, alias="X-Host-Token")
):
    """Get events since a given event ID (long-polling fallback for WebSocket)"""
    if code not in sessions:
        raise HTTPException(status_code=404, detail="Session not found")
    
    session = sessions[code]
    
    # Verify caller is authorized
    if x_host_token:
        if session.host_token != x_host_token:
            raise HTTPException(status_code=403, detail="Invalid host token")
        role = 'host'
    elif player_id:
        if player_id not in session.players:
            raise HTTPException(status_code=404, detail="Player not found")
        role = 'player'
    elif observer_id:
        if observer_id not in session.observers:
            raise HTTPException(status_code=404, detail="Observer not found")
        role = 'observer'
    else:
        raise HTTPException(status_code=400, detail="Must provide player_id, observer_id, or X-Host-Token")
    
    events = session_events.get(code, [])
    new_events = [e for e in events if e.get('_eventId', 0) > since_id]
    
    # Filter and personalize events for players
    if role == 'player':
        filtered = []
        for event in new_events:
            # Skip host-only events
            if event.get('_hostOnly'):
                continue
            # Personalize reveal results
            if event.get('type') == 'revealed' and player_id:
                personalized = session.get_reveal_results(player_id)
                filtered.append({
                    **event,
                    'results': personalized.model_dump()
                })
            else:
                filtered.append(event)
        new_events = filtered
    elif role == 'observer':
        # Filter out host-only events for observers
        new_events = [e for e in new_events if not e.get('_hostOnly')]
    
    return {
        'events': new_events,
        'lastEventId': events[-1]['_eventId'] if events else 0
    }


# --- AI Generation Endpoints ---

@app.get("/api/ai-status")
async def get_ai_status():
    """Get the status of AI/Copilot SDK - useful for debugging"""
    gh_token = os.environ.get("GITHUB_TOKEN", "")
    gh_copilot_token = os.environ.get("GH_COPILOT_TOKEN", "")
    
    status = {
        "sdk_available": COPILOT_SDK_AVAILABLE,
        "sdk_info": COPILOT_MODULE_INFO,
        "github_token_set": bool(gh_token),
        "github_token_length": len(gh_token) if gh_token else 0,
        "gh_copilot_token_set": bool(gh_copilot_token),
        "gh_copilot_token_length": len(gh_copilot_token) if gh_copilot_token else 0,
        "python_version": sys.version,
        "auth_secret_set": bool(os.environ.get("QUIZ_AUTH_SECRET", "")),
    }
    
    # Try to import and inspect the copilot module more
    if COPILOT_SDK_AVAILABLE:
        try:
            import copilot
            status["copilot_dir"] = [x for x in dir(copilot) if not x.startswith('_')]
        except Exception as e:
            status["copilot_inspect_error"] = str(e)
    
    logger.info(f"📊 AI Status check: {status}")
    return status


@app.get("/api/ai-test")
async def test_ai_connection():
    """Test the Copilot CLI - run a simple prompt and verify it works"""
    cli_path = find_copilot_cli()
    
    result = {
        "cli_found": bool(cli_path),
        "cli_path": cli_path,
        "cli_version": None,
        "test_response": None,
        "errors": []
    }
    
    if not cli_path:
        result["errors"].append("Copilot CLI not found")
        return result
    
    try:
        # Get version
        logger.info(f"🧪 [AI Test] Checking CLI version...")
        version_proc = await asyncio.create_subprocess_exec(
            cli_path, "--version",
            stdout=asyncio.subprocess.PIPE,
            stderr=asyncio.subprocess.PIPE
        )
        stdout, stderr = await asyncio.wait_for(version_proc.communicate(), timeout=10)
        result["cli_version"] = stdout.decode().strip()
        logger.info(f"   ✓ Version: {result['cli_version']}")
        
        # Test a simple prompt
        logger.info(f"🧪 [AI Test] Testing simple prompt...")
        test_proc = await asyncio.create_subprocess_exec(
            cli_path,
            "-p", "Say 'Hello from Copilot!' and nothing else.",
            "-s",
            "--allow-all-tools",
            stdout=asyncio.subprocess.PIPE,
            stderr=asyncio.subprocess.PIPE
        )
        stdout, stderr = await asyncio.wait_for(test_proc.communicate(), timeout=60)
        
        if test_proc.returncode == 0:
            result["test_response"] = stdout.decode().strip()
            logger.info(f"   ✓ Test response: {result['test_response'][:100]}...")
        else:
            result["errors"].append(f"CLI failed with exit code {test_proc.returncode}: {stderr.decode()}")
            logger.error(f"   ✗ CLI failed: {stderr.decode()}")
            
    except asyncio.TimeoutError:
        result["errors"].append("CLI timed out")
        logger.error("   ✗ CLI timed out")
    except Exception as e:
        result["errors"].append(f"{type(e).__name__}: {e}")
        logger.error(f"   ✗ Error: {e}")
    
    return result


@app.post("/api/generate-theme", response_model=GenerateThemeResponse, response_model_by_alias=True)
async def generate_theme(
    request: GenerateThemeRequest,
    x_auth_token: str = Header(default="")
):
    """Generate a validated ThemeSpec for a topic."""
    if not verify_auth_token(x_auth_token):
        raise HTTPException(status_code=401, detail="Unauthorized - invalid auth token")

    topic = request.topic.strip()
    if not topic:
        raise HTTPException(status_code=400, detail="Topic cannot be empty")
    if len(topic) > 200:
        raise HTTPException(status_code=400, detail="Topic too long (max 200 characters)")

    intensity = request.intensity.strip().lower()
    if intensity not in ["subtle", "strong"]:
        intensity = "subtle"

    try:
        theme, fallback, issues = await generate_theme_spec(topic, intensity)
        return GenerateThemeResponse(theme=theme, fallback=fallback, issues=issues or None)
    except Exception as e:
        logger.error(f"Theme generation failed: {e}")
        fallback_theme = get_theme_by_id(DEFAULT_THEME_ID)
        return GenerateThemeResponse(theme=fallback_theme, fallback=True, issues=[str(e)])


@app.post("/api/generate-questions", response_model=GenerateQuestionsResponse)
async def generate_questions(
    request: GenerateQuestionsRequest,
    x_auth_token: str = Header(default="")
):
    """Generate quiz questions using Copilot SDK"""
    if not verify_auth_token(x_auth_token):
        raise HTTPException(status_code=401, detail="Unauthorized - invalid auth token")
    
    # Validate topics input
    topics = request.topics.strip()
    if not topics:
        raise HTTPException(status_code=400, detail="Topics cannot be empty")
    if len(topics) > 500:
        raise HTTPException(status_code=400, detail="Topics too long (max 500 characters)")
    
    logger.info(f"🎯 Generate request: topics='{topics}', count={request.count}, research={request.research_mode}")
    start_time = time.time()
    
    # Build the prompt
    difficulty_instruction = ""
    if request.difficulty != "mixed":
        difficulty_instruction = f"\nDifficulty level: {request.difficulty.upper()} - adjust question complexity accordingly."
    
    research_instruction = ""
    if request.research_mode:
        research_instruction = "\nPlease research these topics thoroughly before generating questions. Include interesting and lesser-known facts."
    
    prompt = f"""Generate {request.count} multiple-choice quiz questions about the following topics: {topics}
{difficulty_instruction}{research_instruction}

Remember to output ONLY valid JSON with the questions array."""

    try:
        content = await generate_with_copilot(prompt, caller="generate_questions")
        questions = parse_questions_from_response(content)
        
        if len(questions) < request.count // 2:
            logger.warning(f"⚠️  Only got {len(questions)} questions, expected ~{request.count}")
        
        elapsed_ms = int((time.time() - start_time) * 1000)
        logger.info(f"✅ Generated {len(questions)} questions in {elapsed_ms}ms")
        
        return GenerateQuestionsResponse(
            questions=questions,
            generation_time_ms=elapsed_ms
        )
        
    except Exception as e:
        logger.error(f"❌ Generation failed: {e}")
        raise HTTPException(status_code=500, detail=f"Question generation failed: {str(e)}")


@app.post("/api/generate-dynamic-batch", response_model=GenerateDynamicBatchResponse)
async def generate_dynamic_batch(
    request: GenerateDynamicBatchRequest,
    x_auth_token: str = Header(default="")
):
    """Generate a batch of questions with difficulty calibrated to player performance"""
    if not verify_auth_token(x_auth_token):
        raise HTTPException(status_code=401, detail="Unauthorized - invalid auth token")
    
    logger.info(f"🎲 Dynamic batch request: batch #{request.batch_number}, previous_difficulty={request.previous_difficulty}")
    
    # Calculate suggested difficulty based on performance
    suggested_difficulty = request.previous_difficulty
    difficulty_reason = "Initial batch - starting at medium difficulty"
    
    if request.performance:
        perf = request.performance
        logger.info(f"📊 Performance data: {perf.avg_score_percent:.1f}% correct, {perf.avg_response_time_ms}ms avg response")
        
        # Difficulty calibration logic
        if perf.avg_score_percent > 80 and perf.avg_response_time_ms < 5000:
            # Too easy - players are crushing it
            if request.previous_difficulty == "easy":
                suggested_difficulty = "medium"
            elif request.previous_difficulty == "medium":
                suggested_difficulty = "hard"
            else:
                suggested_difficulty = "hard"
            difficulty_reason = f"Players scoring {perf.avg_score_percent:.0f}% in {perf.avg_response_time_ms/1000:.1f}s - increasing difficulty"
            
        elif perf.avg_score_percent < 40 and perf.avg_response_time_ms > 10000:
            # Too hard - players struggling
            if request.previous_difficulty == "hard":
                suggested_difficulty = "medium"
            elif request.previous_difficulty == "medium":
                suggested_difficulty = "easy"
            else:
                suggested_difficulty = "easy"
            difficulty_reason = f"Players scoring {perf.avg_score_percent:.0f}% in {perf.avg_response_time_ms/1000:.1f}s - decreasing difficulty"
            
        elif perf.avg_score_percent < 60:
            # Slightly too hard
            if request.previous_difficulty == "hard":
                suggested_difficulty = "medium"
            difficulty_reason = f"Players at {perf.avg_score_percent:.0f}% - maintaining/slight decrease"
        else:
            difficulty_reason = f"Players at {perf.avg_score_percent:.0f}% - good balance, maintaining {suggested_difficulty}"
    
    logger.info(f"📈 Difficulty decision: {suggested_difficulty} - {difficulty_reason}")
    
    # Build prompt with performance context
    performance_context = ""
    if request.performance:
        performance_context = f"""
Player Performance Context (use this to calibrate question difficulty):
- Average score: {request.performance.avg_score_percent:.1f}%
- Average response time: {request.performance.avg_response_time_ms}ms
- Players: {request.performance.player_count}
- Target difficulty: {suggested_difficulty.upper()}
"""

    prompt = f"""Generate {request.batch_size} multiple-choice quiz questions about: {request.topics}

This is batch #{request.batch_number} in a dynamic quiz session.
{performance_context}
Difficulty level: {suggested_difficulty.upper()}

Make the questions {'more challenging' if suggested_difficulty == 'hard' else 'more accessible' if suggested_difficulty == 'easy' else 'moderately challenging'}.

Output ONLY valid JSON with the questions array."""

    try:
        content = await generate_with_copilot(prompt, caller="generate_dynamic_batch")
        questions = parse_questions_from_response(content)
        
        logger.info(f"✅ Dynamic batch #{request.batch_number}: {len(questions)} questions at {suggested_difficulty} difficulty")
        
        return GenerateDynamicBatchResponse(
            questions=questions,
            suggested_difficulty=suggested_difficulty,
            difficulty_reason=difficulty_reason,
            batch_number=request.batch_number
        )
        
    except Exception as e:
        logger.error(f"❌ Dynamic batch generation failed: {e}")
        raise HTTPException(status_code=500, detail=f"Batch generation failed: {str(e)}")


@app.post("/api/fact-check", response_model=FactCheckResponse)
async def fact_check_answer(
    request: FactCheckRequest,
    x_auth_token: str = Header(default="")
):
    """Fact-check a quiz question and answer"""
    if not verify_auth_token(x_auth_token):
        raise HTTPException(status_code=401, detail="Unauthorized - invalid auth token")
    
    logger.info(f"🔍 Fact-check request: '{request.question[:50]}...'")
    
    prompt = f"""Please fact-check the following quiz question and answer:

Question: {request.question}
Claimed correct answer: {request.claimed_answer}
All options were: {', '.join(request.all_options)}

Verify if the claimed answer is correct. Respond with ONLY valid JSON:
{{
  "verified": true/false,
  "confidence": 0.0-1.0,
  "explanation": "Brief explanation of why this is correct/incorrect",
  "source_hint": "Where one might verify this (optional)"
}}"""

    try:
        content = await generate_with_copilot(
            prompt,
            system_message="You are a fact-checker. Verify trivia answers accurately and concisely. Output ONLY valid JSON.",
            caller="fact_check",
        )
        
        # Parse the response - try to extract JSON
        # First try to find JSON in markdown code blocks
        json_match = re.search(r'```(?:json)?\s*([\s\S]*?)```', content)
        if json_match:
            content = json_match.group(1).strip()
        
        # Then try to find JSON object
        json_match = re.search(r'\{[\s\S]*\}', content)
        if json_match:
            try:
                data = json.loads(json_match.group())
            except json.JSONDecodeError as e:
                logger.error(f"❌ Failed to parse JSON from fact-check response: {e}")
                logger.error(f"   Content: {content[:200]}...")
                raise ValueError(f"Invalid JSON in response: {e}")
            
            # Validate and clamp confidence value
            confidence = data.get('confidence', 0.5)
            try:
                confidence = float(confidence)
                confidence = max(0.0, min(1.0, confidence))  # Clamp to [0.0, 1.0]
            except (ValueError, TypeError):
                logger.warning(f"⚠️  Invalid confidence value: {confidence}, defaulting to 0.5")
                confidence = 0.5
            
            logger.info(f"🔍 Fact-check result: verified={data.get('verified')}, confidence={confidence}")
            
            # Parse verified value - handle string/bool variations
            verified_value = data.get('verified', False)
            if isinstance(verified_value, str):
                verified = verified_value.lower() in ('true', '1', 'yes')
            else:
                verified = bool(verified_value)
            
            return FactCheckResponse(
                verified=verified,
                confidence=confidence,
                explanation=str(data.get('explanation', 'Unable to verify')),
                source_hint=str(data.get('source_hint')) if data.get('source_hint') else None
            )
        else:
            logger.error(f"❌ No JSON found in fact-check response")
            logger.error(f"   Content: {content[:200]}...")
            raise ValueError("No JSON found in response")
            
    except HTTPException:
        # Re-raise HTTP exceptions
        raise
    except Exception as e:
        logger.error(f"❌ Fact-check failed: {e}")
        logger.error(f"   Exception type: {type(e).__name__}")
        raise HTTPException(status_code=500, detail=f"Fact-check failed: {str(e)}")


# --- Token Usage / Logging Endpoint ---

@app.get("/api/token-usage")
async def get_token_usage(hours: float = 24):
    """Return aggregated Copilot token-usage stats from the JSONL log."""
    return summarize_token_usage(since_hours=hours)


# --- Static File Serving (for self-hosted deployment) ---

# Path to frontend build (../dist from backend folder)
FRONTEND_DIR = Path(__file__).parent.parent / "dist"

# Serve static assets if frontend is built
if FRONTEND_DIR.exists():
    # Mount static assets (js, css, etc)
    app.mount("/assets", StaticFiles(directory=FRONTEND_DIR / "assets"), name="assets")
    
    # Serve other static files (favicon, etc)
    @app.get("/favicon.svg")
    async def favicon():
        return FileResponse(FRONTEND_DIR / "favicon.svg")
    
    @app.get("/config.json")
    async def config_json():
        return FileResponse(FRONTEND_DIR / "config.json")


# Catch-all route MUST be defined last, after all API routes
# This serves the SPA for client-side routing
@app.api_route("/{full_path:path}", methods=["GET"], include_in_schema=False)
async def serve_spa(full_path: str):
    """Serve SPA for non-API GET requests"""
    # Only serve index.html for GET requests to non-API paths
    if FRONTEND_DIR.exists():
        # Try to serve the exact file first
        file_path = FRONTEND_DIR / full_path
        if file_path.is_file() and not full_path.startswith("api/"):
            return FileResponse(file_path)
        
        # Serve index.html for SPA routing
        return FileResponse(FRONTEND_DIR / "index.html")
    
    raise HTTPException(status_code=404, detail="Not found")


if __name__ == "__main__":
    import uvicorn
    print(f"\n🎮 PulseQuiz Server")
    print(f"   Frontend: {'✅ Built' if FRONTEND_DIR.exists() else '❌ Not built (run: npm run build)'}")
    print(f"   URL: http://localhost:8000\n")
    uvicorn.run(app, host="0.0.0.0", port=8000)
