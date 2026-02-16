# Chat Sessions

Exported Copilot chat sessions for this project.

## Automatic export (agent hook)

Chat transcripts are **automatically saved** here whenever an agent session ends,
via the `Stop` hook in [.github/hooks/export-chat.json](../.github/hooks/export-chat.json).

Files are named `YYYY-MM-DD-<slug>-<sessionId>.json` where the slug is derived from your
first message (e.g. `2026-02-16-fix-login-bug-a1b2c3d4.json`). One file per session, updated each turn.

> Requires `chat.hooks.enabled: true` in workspace settings (already configured).

## Manual export

1. Open the chat panel in VS Code
2. `Ctrl+Shift+P` → **Chat: Export Session**
3. Save the file into this `.chat/` directory
4. Use a descriptive name, e.g. `2026-02-16-test-infrastructure.md`

Or run the **Export Chat Session** task:
`Ctrl+Shift+P` → **Tasks: Run Task** → **Export Chat Session**
