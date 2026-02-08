"""
PulseQuiz Backend Logging
=========================
Structured, rotating file-based logging with dedicated Copilot SDK
token-usage tracking. Logs are written to  backend/logs/

Log files produced:
  - pulsequiz.log          General backend log (all levels)
  - copilot.log            Copilot CLI / SDK call details (prompts, responses, timing)
  - token_usage.jsonl      One JSON object per Copilot call – easy to grep/parse for spend analysis
"""

from __future__ import annotations

import json
import logging
import os
import time
from datetime import datetime, timezone
from logging.handlers import RotatingFileHandler
from pathlib import Path
from typing import Any, Optional

# ---------------------------------------------------------------------------
# Directories
# ---------------------------------------------------------------------------

LOG_DIR = Path(__file__).parent / "logs"
LOG_DIR.mkdir(exist_ok=True)

# ---------------------------------------------------------------------------
# Formatters
# ---------------------------------------------------------------------------

_VERBOSE_FMT = logging.Formatter(
    fmt="%(asctime)s | %(levelname)-8s | %(name)-20s | %(message)s",
    datefmt="%Y-%m-%d %H:%M:%S",
)

_CONSOLE_FMT = logging.Formatter(
    fmt="%(asctime)s | %(levelname)s | %(message)s",
    datefmt="%H:%M:%S",
)

# ---------------------------------------------------------------------------
# Handler factory
# ---------------------------------------------------------------------------

def _rotating_handler(
    filename: str,
    max_bytes: int = 5 * 1024 * 1024,   # 5 MB per file
    backup_count: int = 5,
    level: int = logging.DEBUG,
) -> RotatingFileHandler:
    handler = RotatingFileHandler(
        LOG_DIR / filename,
        maxBytes=max_bytes,
        backupCount=backup_count,
        encoding="utf-8",
    )
    handler.setLevel(level)
    handler.setFormatter(_VERBOSE_FMT)
    return handler

# ---------------------------------------------------------------------------
# Logger setup – call once at startup
# ---------------------------------------------------------------------------

_CONFIGURED = False


def setup_logging(*, console_level: int = logging.INFO) -> None:
    """Initialise all loggers.  Safe to call more than once."""
    global _CONFIGURED
    if _CONFIGURED:
        return
    _CONFIGURED = True

    # ---- Root / general logger ------------------------------------------
    root = logging.getLogger()
    root.setLevel(logging.DEBUG)

    # Console handler (keeps existing behaviour)
    console = logging.StreamHandler()
    console.setLevel(console_level)
    console.setFormatter(_CONSOLE_FMT)
    root.addHandler(console)

    # General file log
    root.addHandler(_rotating_handler("pulsequiz.log", level=logging.DEBUG))

    # ---- Copilot-specific logger ----------------------------------------
    copilot_logger = logging.getLogger("copilot")
    copilot_logger.setLevel(logging.DEBUG)
    copilot_logger.addHandler(_rotating_handler("copilot.log", level=logging.DEBUG))
    # Don't double-print to console – propagation already does that
    copilot_logger.propagate = True

    # ---- Token-usage logger (JSONL) -------------------------------------
    token_logger = logging.getLogger("copilot.tokens")
    token_logger.setLevel(logging.DEBUG)
    token_handler = _rotating_handler(
        "token_usage.jsonl",
        max_bytes=10 * 1024 * 1024,  # 10 MB
        backup_count=10,
        level=logging.DEBUG,
    )
    # JSONL lines should be raw – no formatter prefix
    token_handler.setFormatter(logging.Formatter("%(message)s"))
    token_logger.addHandler(token_handler)
    token_logger.propagate = False  # don't echo raw JSON to console

    logging.getLogger("PulseQuiz").info(
        f"📁 Logging initialised – log directory: {LOG_DIR.resolve()}"
    )


# ---------------------------------------------------------------------------
# Convenience accessors
# ---------------------------------------------------------------------------

def get_logger(name: str = "PulseQuiz") -> logging.Logger:
    return logging.getLogger(name)


def get_copilot_logger() -> logging.Logger:
    return logging.getLogger("copilot")


def get_token_logger() -> logging.Logger:
    return logging.getLogger("copilot.tokens")


# ---------------------------------------------------------------------------
# Token-usage helpers
# ---------------------------------------------------------------------------

class CopilotCallTracker:
    """Context-manager that times a Copilot CLI / SDK call and logs usage."""

    def __init__(
        self,
        *,
        endpoint: str = "generate_with_copilot",
        model: str = "gpt-4.1",
        prompt_chars: int = 0,
        extra: dict[str, Any] | None = None,
    ):
        self.endpoint = endpoint
        self.model = model
        self.prompt_chars = prompt_chars
        self.extra = extra or {}
        self._start: float = 0.0
        self._log = get_copilot_logger()
        self._token_log = get_token_logger()

    # Allow use as a plain object (start / finish) or as a context-manager
    def start(self) -> "CopilotCallTracker":
        self._start = time.time()
        self._log.info(
            "┌─ Copilot call START  endpoint=%s  model=%s  prompt_chars=%d",
            self.endpoint,
            self.model,
            self.prompt_chars,
        )
        return self

    def finish(
        self,
        *,
        response_chars: int = 0,
        success: bool = True,
        error: str | None = None,
        exit_code: int | None = None,
        stderr_text: str = "",
        stdout_text: str = "",
        token_usage: dict[str, Any] | None = None,
    ) -> dict[str, Any]:
        elapsed_ms = int((time.time() - self._start) * 1000)

        # ---- Attempt to extract token counts ----------------------------
        # The Copilot CLI sometimes emits usage on stderr or in the JSON
        # response body.  We try several heuristics.
        usage = token_usage or _extract_token_usage(stderr_text, stdout_text)

        record: dict[str, Any] = {
            "timestamp": datetime.now(timezone.utc).isoformat(),
            "endpoint": self.endpoint,
            "model": self.model,
            "prompt_chars": self.prompt_chars,
            "response_chars": response_chars,
            "elapsed_ms": elapsed_ms,
            "success": success,
            "exit_code": exit_code,
            "error": error,
            "token_usage": usage,
            **self.extra,
        }

        # Emit structured JSONL line
        self._token_log.info(json.dumps(record, default=str))

        # Human-readable summary in copilot.log
        usage_str = ""
        if usage:
            parts = []
            if usage.get("prompt_tokens"):
                parts.append(f"prompt={usage['prompt_tokens']}")
            if usage.get("completion_tokens"):
                parts.append(f"completion={usage['completion_tokens']}")
            if usage.get("total_tokens"):
                parts.append(f"total={usage['total_tokens']}")
            usage_str = "  tokens=[" + ", ".join(parts) + "]" if parts else ""

        status = "OK" if success else f"FAIL ({error})"
        self._log.info(
            "└─ Copilot call END    endpoint=%s  status=%s  %dms  "
            "prompt=%d chars  response=%d chars%s",
            self.endpoint,
            status,
            elapsed_ms,
            self.prompt_chars,
            response_chars,
            usage_str,
        )
        return record

    # Context-manager interface
    def __enter__(self) -> "CopilotCallTracker":
        return self.start()

    def __exit__(self, exc_type, exc_val, exc_tb) -> None:
        if exc_type is not None:
            self.finish(success=False, error=f"{exc_type.__name__}: {exc_val}")
        # If no exception, caller should call .finish() explicitly with data


# ---------------------------------------------------------------------------
# Token-usage extraction heuristics
# ---------------------------------------------------------------------------

def _extract_token_usage(stderr: str, stdout: str) -> dict[str, Any]:
    """
    Best-effort extraction of token usage from Copilot CLI output.

    The CLI may emit usage data in:
      - stderr as structured log lines  (e.g.  "prompt_tokens: 123")
      - the JSON response body itself
      - an "x-ratelimit-*" style header echoed to stderr

    Returns a dict with available keys:
        prompt_tokens, completion_tokens, total_tokens
    """
    usage: dict[str, Any] = {}

    combined = (stderr or "") + "\n" + (stdout or "")

    # Strategy 1: Look for JSON with usage block embedded in response
    import re
    usage_json = re.search(
        r'"usage"\s*:\s*\{([^}]+)\}', combined, re.IGNORECASE
    )
    if usage_json:
        try:
            blob = json.loads("{" + usage_json.group(1) + "}")
            for key in ("prompt_tokens", "completion_tokens", "total_tokens"):
                if key in blob:
                    usage[key] = int(blob[key])
        except (json.JSONDecodeError, ValueError):
            pass

    # Strategy 2: grep for key=value style output
    for key in ("prompt_tokens", "completion_tokens", "total_tokens"):
        match = re.search(rf"{key}\s*[:=]\s*(\d+)", combined, re.IGNORECASE)
        if match and key not in usage:
            usage[key] = int(match.group(1))

    # Strategy 3: x-ratelimit headers echoed by some SDK versions
    for header_key, usage_key in [
        ("x-ratelimit-remaining-tokens", "ratelimit_remaining_tokens"),
        ("x-ratelimit-remaining-requests", "ratelimit_remaining_requests"),
    ]:
        match = re.search(
            rf"{header_key}\s*[:=]\s*(\d+)", combined, re.IGNORECASE
        )
        if match:
            usage[usage_key] = int(match.group(1))

    # Derive total if not present
    if "total_tokens" not in usage:
        pt = usage.get("prompt_tokens", 0)
        ct = usage.get("completion_tokens", 0)
        if pt or ct:
            usage["total_tokens"] = pt + ct

    # Estimate tokens from char counts when no hard data available
    if not usage:
        # ~4 chars per token is a rough GPT-family heuristic
        prompt_est = len(stderr) // 4 if stderr else 0
        response_est = len(stdout) // 4 if stdout else 0
        if prompt_est or response_est:
            usage["estimated"] = True
            usage["prompt_tokens_est"] = prompt_est
            usage["completion_tokens_est"] = response_est
            usage["total_tokens_est"] = prompt_est + response_est

    return usage


# ---------------------------------------------------------------------------
# Daily summary helper (can be called from an endpoint or CLI)
# ---------------------------------------------------------------------------

def summarize_token_usage(since_hours: float = 24) -> dict[str, Any]:
    """Parse token_usage.jsonl and return aggregate stats."""
    jsonl_path = LOG_DIR / "token_usage.jsonl"
    if not jsonl_path.exists():
        return {"error": "No token_usage.jsonl found", "calls": 0}

    cutoff = time.time() - since_hours * 3600
    calls: list[dict] = []
    total_prompt = 0
    total_completion = 0
    total_elapsed_ms = 0
    errors = 0

    with open(jsonl_path, encoding="utf-8") as f:
        for line in f:
            line = line.strip()
            if not line:
                continue
            try:
                rec = json.loads(line)
            except json.JSONDecodeError:
                continue
            ts_str = rec.get("timestamp", "")
            try:
                ts = datetime.fromisoformat(ts_str).timestamp()
            except (ValueError, TypeError):
                ts = 0
            if ts < cutoff:
                continue
            calls.append(rec)
            usage = rec.get("token_usage") or {}
            total_prompt += usage.get("prompt_tokens", usage.get("prompt_tokens_est", 0))
            total_completion += usage.get("completion_tokens", usage.get("completion_tokens_est", 0))
            total_elapsed_ms += rec.get("elapsed_ms", 0)
            if not rec.get("success"):
                errors += 1

    return {
        "period_hours": since_hours,
        "total_calls": len(calls),
        "successful_calls": len(calls) - errors,
        "failed_calls": errors,
        "total_prompt_tokens": total_prompt,
        "total_completion_tokens": total_completion,
        "total_tokens": total_prompt + total_completion,
        "total_elapsed_ms": total_elapsed_ms,
        "avg_elapsed_ms": total_elapsed_ms // max(len(calls), 1),
        "models_used": list({c.get("model", "unknown") for c in calls}),
    }
