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

# Derive a slug from the first user message in the transcript.
# The transcript is NDJSON (one JSON object per line).
# User messages have: {"type":"user.message","data":{"content":"..."}}
$slug = 'session'
$stopWords = @('a','an','the','is','it','in','on','at','to','for','of','and','or','but','with',
    'that','this','was','are','be','has','have','had','do','does','did','will','would','could',
    'should','can','may','might','i','you','we','they','he','she','my','your','our','its',
    'me','us','them','not','no','so','if','just','also','very','really','about','from','into',
    'up','out','how','what','when','where','why','who','which','there','here','then','than',
    'been','being','some','all','any','each','every','both','few','more','most','other',
    'please','think','make','made','want','like','use','get','go','know','see','look',
    'way','take','come','could','after','before','now','new','one','two','let','lets')
try {
    $lines = Get-Content -Path $transcriptPath
    $firstMsg = $null
    foreach ($line in $lines) {
        if (-not $line.Trim()) { continue }
        try {
            $entry = $line | ConvertFrom-Json
        } catch { continue }
        if ($entry.type -eq 'user.message' -and $entry.data -and $entry.data.content) {
            $firstMsg = $entry.data.content
            break
        }
    }
    if ($firstMsg) {
        # Extract keywords: split on non-alpha, filter stop words, take first 5
        $words = ($firstMsg.ToLower() -replace '[^a-z0-9\s]', ' ' -split '\s+') |
            Where-Object { $_ -and $_.Length -ge 3 -and $_ -notin $stopWords } |
            Select-Object -Unique -First 5
        if ($words.Count -gt 0) {
            $slug = ($words -join '-')
        }
    }
} catch {
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
