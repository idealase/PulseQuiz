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

# Derive a slug from the first user message in the transcript.
# The transcript is NDJSON (one JSON object per line).
# User messages have: {"type":"user.message","data":{"content":"..."}}
SLUG="session"
STOP_WORDS="a|an|the|is|it|in|on|at|to|for|of|and|or|but|with|that|this|was|are|be|has|have|had|do|does|did|will|would|could|should|can|may|might|i|you|we|they|he|she|my|your|our|its|me|us|them|not|no|so|if|just|also|very|really|about|from|into|up|out|how|what|when|where|why|who|which|there|here|then|than|been|being|some|all|any|each|every|both|few|more|most|other|please|think|make|made|want|like|use|get|go|know|see|look|way|take|come|could|after|before|now|new|one|two|let|lets"
if command -v jq &>/dev/null; then
  FIRST_MSG=$(jq -r 'select(.type == "user.message") | .data.content // empty' "$TRANSCRIPT_PATH" 2>/dev/null | head -n 1)
  if [ -n "$FIRST_MSG" ]; then
    # Extract keywords: lowercase, split to words, filter stop words, take first 5
    KEYWORDS=$(echo "$FIRST_MSG" | tr '[:upper:]' '[:lower:]' | sed 's/[^a-z0-9]/ /g' \
      | tr ' ' '\n' | awk 'length >= 3' \
      | grep -vwE "$STOP_WORDS" \
      | awk '!seen[$0]++' | head -n 5 | paste -sd '-' -)
    [ -n "$KEYWORDS" ] && SLUG="$KEYWORDS"
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
