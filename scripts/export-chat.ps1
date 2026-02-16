# export-chat.ps1
# Agent hook script: copies the chat transcript to .chat/ on session end.
# Receives JSON input on stdin from the VS Code agent hook system.

$ErrorActionPreference = 'Stop'

# Read JSON from stdin
$input_json = $input | Out-String
if (-not $input_json) {
    Write-Error "No input received on stdin"
    exit 1
}

try {
    $hookInput = $input_json | ConvertFrom-Json
} catch {
    Write-Error "Failed to parse hook input JSON: $_"
    exit 1
}

$transcriptPath = $hookInput.transcript_path
$sessionId      = $hookInput.sessionId
$cwd            = $hookInput.cwd
$timestamp      = $hookInput.timestamp

if (-not $transcriptPath -or -not (Test-Path $transcriptPath)) {
    Write-Error "transcript_path not provided or file not found: $transcriptPath"
    exit 1
}

# Build output directory
$chatDir = Join-Path $cwd '.chat'
if (-not (Test-Path $chatDir)) {
    New-Item -ItemType Directory -Path $chatDir -Force | Out-Null
}

# Derive a slug from the first user message in the transcript
$slug = 'session'
try {
    $transcript = Get-Content -Raw -Path $transcriptPath | ConvertFrom-Json
    # Look for the first user/human message
    $firstMsg = $null
    foreach ($entry in $transcript) {
        $role = $entry.role
        if (-not $role) { $role = $entry.type }
        if ($role -match 'user|human') {
            $firstMsg = $entry.content
            if (-not $firstMsg) { $firstMsg = $entry.text }
            if (-not $firstMsg) { $firstMsg = $entry.message }
            break
        }
    }
    # Also try .messages[] shape
    if (-not $firstMsg -and $transcript.messages) {
        foreach ($msg in $transcript.messages) {
            if ($msg.role -match 'user|human') {
                $firstMsg = $msg.content
                if (-not $firstMsg) { $firstMsg = $msg.text }
                break
            }
        }
    }
    # Also try .title at the top level
    if (-not $firstMsg -and $transcript.title) {
        $firstMsg = $transcript.title
    }
    if ($firstMsg) {
        # Take first 50 chars, lowercase, replace non-alphanum with hyphens, collapse
        $slug = $firstMsg.Substring(0, [Math]::Min(50, $firstMsg.Length)).ToLower()
        $slug = $slug -replace '[^a-z0-9]+', '-'
        $slug = $slug.Trim('-')
        if (-not $slug) { $slug = 'session' }
    }
} catch {
    # Fall back to generic name on any parse error
    $slug = 'session'
}

$shortId = if ($sessionId) { $sessionId.Substring(0, [Math]::Min(8, $sessionId.Length)) } else { 'unknown' }
$datePart = if ($timestamp) {
    try { (Get-Date $timestamp -Format 'yyyy-MM-dd') } catch { Get-Date -Format 'yyyy-MM-dd' }
} else {
    Get-Date -Format 'yyyy-MM-dd'
}
$destName = "${datePart}-${slug}-${shortId}.json"
$destPath = Join-Path $chatDir $destName

# Remove previous export for this session (slug may have changed between turns)
Get-ChildItem -Path $chatDir -Filter "*-${shortId}.json" -ErrorAction SilentlyContinue |
    ForEach-Object { Remove-Item $_.FullName -Force }

Copy-Item -Path $transcriptPath -Destination $destPath -Force

# Return success JSON to VS Code
@{ continue = $true } | ConvertTo-Json -Compress
