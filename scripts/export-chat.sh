#!/usr/bin/env bash
# export-chat.sh
# Agent hook script: copies the chat transcript to .chat/ on session end.
# Receives JSON input on stdin from the VS Code agent hook system.
set -euo pipefail

INPUT=$(cat)

TRANSCRIPT_PATH=$(echo "$INPUT" | jq -r '.transcript_path // empty')
SESSION_ID=$(echo "$INPUT" | jq -r '.sessionId // empty')
CWD=$(echo "$INPUT" | jq -r '.cwd // empty')
TIMESTAMP=$(echo "$INPUT" | jq -r '.timestamp // empty')

if [ -z "$TRANSCRIPT_PATH" ] || [ ! -f "$TRANSCRIPT_PATH" ]; then
  echo "transcript_path not provided or file not found: $TRANSCRIPT_PATH" >&2
  exit 1
fi

CHAT_DIR="${CWD:-.}/.chat"
mkdir -p "$CHAT_DIR"

# Derive a slug from the first user message in the transcript
SLUG="session"
if command -v jq &>/dev/null; then
  # Try array-of-messages: first entry with role matching user/human
  FIRST_MSG=$(jq -r '
    (if type == "array" then . else (.messages // []) end)
    | map(select(.role // .type | test("user|human"; "i")))
    | first
    | (.content // .text // .message // empty)
  ' "$TRANSCRIPT_PATH" 2>/dev/null)
  # Fall back to top-level .title
  if [ -z "$FIRST_MSG" ]; then
    FIRST_MSG=$(jq -r '.title // empty' "$TRANSCRIPT_PATH" 2>/dev/null)
  fi
  if [ -n "$FIRST_MSG" ]; then
    # Take first 50 chars, lowercase, replace non-alphanum with hyphens
    SLUG=$(echo "$FIRST_MSG" | head -c 50 | tr '[:upper:]' '[:lower:]' | sed 's/[^a-z0-9]\+/-/g; s/^-//; s/-$//')
    [ -z "$SLUG" ] && SLUG="session"
  fi
fi

SHORT_ID="${SESSION_ID:0:8}"
SHORT_ID="${SHORT_ID:-unknown}"
if [ -n "$TIMESTAMP" ]; then
  DATE_PART=$(date -d "$TIMESTAMP" '+%Y-%m-%d' 2>/dev/null || date '+%Y-%m-%d')
else
  DATE_PART=$(date '+%Y-%m-%d')
fi
DEST_NAME="${DATE_PART}-${SLUG}-${SHORT_ID}.json"

# Remove previous export for this session (slug may have changed between turns)
rm -f "${CHAT_DIR}"/*-"${SHORT_ID}".json 2>/dev/null

cp "$TRANSCRIPT_PATH" "${CHAT_DIR}/${DEST_NAME}"

# Return success JSON to VS Code
echo '{"continue":true}'
