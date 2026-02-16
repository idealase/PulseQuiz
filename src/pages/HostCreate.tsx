import { useState, useCallback, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { useConfig } from '../context/ConfigContext'
import { useTheme } from '../context/ThemeContext'
import { useAITelemetry } from '../context/AITelemetryContext'
import { ApiClient } from '../api/client'
import { parseCSV } from '../utils/csvParser'
import { Question } from '../types'
import { QRCodeSVG } from 'qrcode.react'
import { questionSets, getShuffledQuestionsFromSet, QuestionSetId } from '../data/defaultQuestions'
import { setLastSession } from '../utils/sessionResume'

export default function HostCreate() {
  const config = useConfig()
  const navigate = useNavigate()
  const { applyTheme, lockTheme, intensity, experimentalTheme } = useTheme()
  const { recordCall } = useAITelemetry()
  
  const [sessionCode, setSessionCode] = useState<string | null>(null)
  const [hostToken, setHostToken] = useState<string | null>(null)
  const [questions, setQuestions] = useState<Question[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [csvErrors, setCsvErrors] = useState<string[]>([])
  const [dragActive, setDragActive] = useState(false)
  
  // Timer settings
  const [timerMode, setTimerMode] = useState(false)
  const [timerSeconds, setTimerSeconds] = useState(15)
  
  // Auto-progress settings
  const [autoProgressMode, setAutoProgressMode] = useState(false)
  const [autoProgressPercent, setAutoProgressPercent] = useState(90)

  // Host role settings
  const [hostRole, setHostRole] = useState<'host_player' | 'host_only'>('host_player')
  const [hostNickname, setHostNickname] = useState('Host')

  // AI Generation settings
  const [aiTopics, setAiTopics] = useState('')
  const [aiQuestionCount, setAiQuestionCount] = useState(10)
  const [aiResearchMode, setAiResearchMode] = useState(false)
  const [aiDynamicMode, setAiDynamicMode] = useState(false)
  const aiDynamicModeRef = useRef(false)
  const [dynamicToggleGuard, setDynamicToggleGuard] = useState(false)
  const [aiGenerating, setAiGenerating] = useState(false)
  const [themeGenerating, setThemeGenerating] = useState(false)
  const [aiAuthToken, setAiAuthToken] = useState(() => localStorage.getItem('quiz_auth_token') || '')
  const [showAuthInput, setShowAuthInput] = useState(() => !localStorage.getItem('quiz_auth_token'))
  const [generationTime, setGenerationTime] = useState<number | null>(null)

  const api = new ApiClient(config.apiBaseUrl)

  const handleCreateSession = async () => {
    setLoading(true)
    setError(null)
    try {
      const result = await api.createSession({ 
        timerMode, 
        timerSeconds: timerMode ? timerSeconds : 15,
        autoProgressMode,
        autoProgressPercent: autoProgressMode ? autoProgressPercent : 90
      })
      setSessionCode(result.code)
      setHostToken(result.hostToken)

      sessionStorage.setItem(`host_role_${result.code}`, hostRole)
      setLastSession('host', result.code)

      if (hostRole === 'host_player') {
        const nickname = hostNickname.trim() || 'Host'
        const joinResult = await api.joinSession(result.code, nickname)
        sessionStorage.setItem(`host_player_${result.code}`, joinResult.playerId)
        sessionStorage.setItem(`host_player_name_${result.code}`, nickname)
      } else {
        sessionStorage.removeItem(`host_player_${result.code}`)
        sessionStorage.removeItem(`host_player_name_${result.code}`)
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to create session')
    }
    setLoading(false)
  }

  const handleFileUpload = useCallback((file: File) => {
    const reader = new FileReader()
    reader.onload = (e) => {
      const content = e.target?.result as string
      const result = parseCSV(content)
      
      if (result.errors.length > 0) {
        setCsvErrors(result.errors)
        if (result.questions.length === 0) {
          return
        }
      } else {
        setCsvErrors([])
      }
      
      setQuestions(result.questions)
    }
    reader.readAsText(file)
  }, [])

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setDragActive(false)
    const file = e.dataTransfer.files[0]
    if (file && file.name.endsWith('.csv')) {
      handleFileUpload(file)
    }
  }, [handleFileUpload])

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) {
      handleFileUpload(file)
    }
  }

  const handleStartSession = async () => {
    if (!sessionCode || !hostToken || questions.length === 0) return
    
    setLoading(true)
    setError(null)
    try {
      const initialBatchSize = aiDynamicMode ? 10 : questions.length
      const questionsToUpload = aiDynamicMode ? questions.slice(0, initialBatchSize) : questions
      if (aiDynamicMode && questions.length > initialBatchSize) {
        setCsvErrors([`Dynamic Mode: Uploading initial batch of ${initialBatchSize} questions. Remaining questions will be generated during gameplay.`])
      }
      await api.uploadQuestions(sessionCode, hostToken, questionsToUpload)
      // Store host token in sessionStorage for the session page
      sessionStorage.setItem(`host_${sessionCode}`, hostToken)
      setLastSession('host', sessionCode)
      // Store dynamic mode preference if enabled
      if (aiDynamicMode) {
        sessionStorage.setItem(`dynamic_${sessionCode}`, JSON.stringify({
          enabled: true,
          topics: aiTopics,
          authToken: aiAuthToken,
          targetCount: aiQuestionCount,
          batchSize: 10,
          currentBatch: 1,
          lastDifficulty: 'medium'
        }))
      }
      navigate(`/host/${sessionCode}`)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to upload questions')
    }
    setLoading(false)
  }

  const handleAiGenerate = async () => {
    if (!aiTopics.trim()) {
      setError('Please enter at least one topic')
      return
    }
    
    if (!aiAuthToken.trim()) {
      setShowAuthInput(true)
      setError('Please enter your access code')
      return
    }

    // Save auth token for future use
    localStorage.setItem('quiz_auth_token', aiAuthToken)
    
    setAiGenerating(true)
    setError(null)
    setGenerationTime(null)
    setCsvErrors([])
    
    try {
      const dynamicEnabled = aiDynamicModeRef.current
      // In dynamic mode, generate only initial batch of 10 questions
      // The rest will be generated during gameplay based on performance
      const initialBatchSize = dynamicEnabled ? 10 : aiQuestionCount
      
      const result = await api.generateQuestions({
        topics: aiTopics,
        count: initialBatchSize,
        research_mode: aiResearchMode,
        difficulty: 'mixed'
      }, aiAuthToken)
      
      if (result.ai_meta) recordCall('generate_questions', result.ai_meta)
      setQuestions(result.questions)
      setGenerationTime(result.generation_time_ms)

      if (!lockTheme && experimentalTheme) {
        setThemeGenerating(true)
        try {
          const themeResult = await api.generateTheme({
            topic: aiTopics,
            intensity
          }, aiAuthToken)
          if (themeResult.ai_meta) recordCall('generate_theme', themeResult.ai_meta)
          applyTheme(themeResult.theme)
          // Propagate theme to session so players get it
          if (sessionCode && hostToken) {
            api.setSessionTheme(sessionCode, hostToken, themeResult.theme).catch(() => {})
          }
        } catch (themeError) {
          console.warn('Theme generation failed', themeError)
        } finally {
          setThemeGenerating(false)
        }
      }
      
      if (dynamicEnabled) {
        setCsvErrors([`Dynamic Mode: Generated initial batch of ${result.questions.length} questions (requested: ${initialBatchSize}). Target: ${aiQuestionCount} total. More will be generated during gameplay.`])
      } else if (result.questions.length < aiQuestionCount) {
        setCsvErrors([`Generated ${result.questions.length} of ${aiQuestionCount} requested questions`])
      }
    } catch (e) {
      const message = e instanceof Error ? e.message : 'AI generation failed'
      setError(message)
      if (message.includes('401') || message.includes('Unauthorized')) {
        setShowAuthInput(true)
        localStorage.removeItem('quiz_auth_token')
      }
    }
    setAiGenerating(false)
  }

  const handleThemePreview = async () => {
    if (!aiTopics.trim()) {
      setError('Please enter at least one topic')
      return
    }

    if (!aiAuthToken.trim()) {
      setShowAuthInput(true)
      setError('Please enter your access code')
      return
    }

    if (!experimentalTheme) {
      setError('Enable Experimental Theme Generation in Settings')
      return
    }

    if (lockTheme) {
      setError('Theme is locked in Settings')
      return
    }

    setThemeGenerating(true)
    setError(null)

    try {
      const themeResult = await api.generateTheme({
        topic: aiTopics,
        intensity
      }, aiAuthToken)
      if (themeResult.ai_meta) recordCall('generate_theme', themeResult.ai_meta)
      applyTheme(themeResult.theme)
      // Propagate theme to session so players get it
      if (sessionCode && hostToken) {
        api.setSessionTheme(sessionCode, hostToken, themeResult.theme).catch(() => {})
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Theme preview failed')
    }

    setThemeGenerating(false)
  }

  const joinUrl = sessionCode 
    ? `${window.location.origin}${import.meta.env.BASE_URL}#/join/${sessionCode}`
    : ''
  const generationActive = aiGenerating || themeGenerating

  return (
    <div className="min-h-[100dvh] px-4 pt-16 pb-6 sm:px-6 sm:pt-16 sm:pb-6 max-w-lg mx-auto">
      <h1 className="text-3xl sm:text-4xl font-bold mb-6 sm:mb-8 text-center">Start a Game</h1>

      {!sessionCode ? (
        <div className="space-y-6 animate-slide-up">
          {/* Timer Mode Settings */}
          <div className="bg-white/10 rounded-2xl p-6">
            <h2 className="text-lg font-bold mb-4">Game Settings</h2>

            <div className="mb-5 space-y-3">
              <p className="text-white/60 text-sm">Host Role</p>
              <label className="flex items-start gap-3 cursor-pointer p-2 rounded-lg hover:bg-white/5 transition-colors">
                <input
                  type="radio"
                  name="hostRole"
                  checked={hostRole === 'host_player'}
                  onChange={() => setHostRole('host_player')}
                  className="w-5 h-5 mt-0.5 accent-primary"
                />
                <div>
                  <span className="font-medium">Host + Player 1 (default)</span>
                  <p className="text-white/40 text-xs mt-0.5">Play while hosting</p>
                </div>
              </label>
              <label className="flex items-start gap-3 cursor-pointer p-2 rounded-lg hover:bg-white/5 transition-colors">
                <input
                  type="radio"
                  name="hostRole"
                  checked={hostRole === 'host_only'}
                  onChange={() => setHostRole('host_only')}
                  className="w-5 h-5 mt-0.5 accent-primary"
                />
                <div>
                  <span className="font-medium">Host only (non-playing)</span>
                  <p className="text-white/40 text-xs mt-0.5">Facilitate without answering</p>
                </div>
              </label>

              {hostRole === 'host_player' && (
                <div className="mt-2 ml-8">
                  <label className="text-white/60 text-sm">Host nickname</label>
                  <input
                    type="text"
                    value={hostNickname}
                    onChange={(e) => setHostNickname(e.target.value)}
                    maxLength={20}
                    className="mt-2 w-full px-4 py-2 rounded-lg bg-white/10 border border-white/20 focus:border-primary focus:outline-none"
                    placeholder="Host"
                  />
                </div>
              )}
            </div>
            
            <label className="flex items-center gap-3 cursor-pointer mb-4">
              <input
                type="checkbox"
                checked={timerMode}
                onChange={(e) => setTimerMode(e.target.checked)}
                className="w-5 h-5 rounded accent-primary"
              />
              <span className="font-medium">⏱️ Auto-advance Timer Mode</span>
            </label>
            
            {timerMode && (
              <div className="ml-8 space-y-2 mb-4">
                <label className="text-white/60 text-sm">Seconds per question:</label>
                <div className="flex items-center gap-3">
                  <input
                    type="range"
                    min="5"
                    max="60"
                    value={timerSeconds}
                    onChange={(e) => setTimerSeconds(Number(e.target.value))}
                    className="flex-1 accent-primary"
                  />
                  <span className="w-12 text-center font-mono text-lg font-bold text-secondary">
                    {timerSeconds}s
                  </span>
                </div>
                <p className="text-white/40 text-xs">
                  Questions auto-advance when timer runs out
                </p>
              </div>
            )}

            <label className="flex items-center gap-3 cursor-pointer mb-4">
              <input
                type="checkbox"
                checked={autoProgressMode}
                onChange={(e) => setAutoProgressMode(e.target.checked)}
                className="w-5 h-5 rounded accent-green-500"
              />
              <span className="font-medium">👥 Auto-advance by Participation</span>
            </label>
            
            {autoProgressMode && (
              <div className="ml-8 space-y-2">
                <label className="text-white/60 text-sm">Progress when answered:</label>
                <div className="flex items-center gap-3">
                  <input
                    type="range"
                    min="50"
                    max="100"
                    step="5"
                    value={autoProgressPercent}
                    onChange={(e) => setAutoProgressPercent(Number(e.target.value))}
                    className="flex-1 accent-green-500"
                  />
                  <span className="w-14 text-center font-mono text-lg font-bold text-green-400">
                    {autoProgressPercent}%
                  </span>
                </div>
                <p className="text-white/40 text-xs">
                  Auto-advance once this % of players have answered (adds excitement!)
                </p>
              </div>
            )}
          </div>

          <button
            onClick={handleCreateSession}
            disabled={loading}
            className="w-full py-4 px-8 text-xl font-bold rounded-2xl bg-gradient-to-r from-primary to-indigo-500 hover:from-indigo-600 hover:to-primary transition-all disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading ? 'Starting...' : 'Start Game'}
          </button>
          
          {error && (
            <div className="p-4 bg-red-500/20 border border-red-500 rounded-lg text-red-300">
              {error}
            </div>
          )}
        </div>
      ) : (
        <div className="space-y-6 animate-slide-up">
          {/* AI Quiz Generation */}
          <div className="bg-gradient-to-br from-purple-500/10 to-indigo-500/10 border border-purple-500/30 rounded-2xl p-6">
            <h3 className="text-lg font-bold mb-4 flex items-center gap-2">
              <span>✨</span> Generate with AI
            </h3>
            
            {/* Auth Token Input (shown when needed) */}
            {showAuthInput && (
              <div className="mb-4 p-3 bg-white/5 rounded-xl">
                <label className="text-sm text-white/60 block mb-2">Access Code</label>
                <input
                  type="password"
                  value={aiAuthToken}
                  onChange={(e) => setAiAuthToken(e.target.value)}
                  placeholder="Enter your access code..."
                  className="w-full px-4 py-2 bg-white/10 border border-white/20 rounded-lg focus:border-purple-500 focus:outline-none"
                />
              </div>
            )}
            
            {/* Topics Input */}
            <div className="mb-4">
              <label className="text-sm text-white/60 block mb-2">Topics (comma-separated)</label>
              <input
                type="text"
                value={aiTopics}
                onChange={(e) => setAiTopics(e.target.value)}
                placeholder="AI, Australian History, Space..."
                className="w-full px-4 py-3 bg-white/10 border border-white/20 rounded-xl focus:border-purple-500 focus:outline-none text-white placeholder-white/40"
              />
            </div>
            
            {/* Question Count Slider */}
            <div className="mb-4">
              <label className="text-sm text-white/60 block mb-2">
                Number of questions: <span className="text-purple-400 font-bold">{aiQuestionCount}</span>
              </label>
              <input
                type="range"
                min="5"
                max="50"
                value={aiQuestionCount}
                onChange={(e) => setAiQuestionCount(Number(e.target.value))}
                className="w-full accent-purple-500"
              />
            </div>
            
            {/* Mode Toggles */}
            <div className="space-y-3 mb-4">
              <label className="flex items-start gap-3 cursor-pointer p-2 rounded-lg hover:bg-white/5 transition-colors">
                <input
                  type="checkbox"
                  checked={aiResearchMode}
                  onChange={(e) => setAiResearchMode(e.target.checked)}
                  className="w-5 h-5 mt-0.5 rounded accent-purple-500"
                />
                <div>
                  <span className="font-medium">🔬 Research Mode</span>
                  <p className="text-white/40 text-xs mt-0.5">Deeper topic research • Uses more AI credits</p>
                </div>
              </label>
              
              <label className="flex items-start gap-3 cursor-pointer p-2 rounded-lg hover:bg-white/5 transition-colors">
                <input
                  type="checkbox"
                  checked={aiDynamicMode}
                  onChange={(e) => {
                    aiDynamicModeRef.current = e.target.checked
                    setAiDynamicMode(e.target.checked)
                    setDynamicToggleGuard(true)
                    setTimeout(() => setDynamicToggleGuard(false), 200)
                  }}
                  className="w-5 h-5 mt-0.5 rounded accent-purple-500"
                />
                <div>
                  <span className="font-medium">🎲 Dynamic Mode</span>
                  <p className="text-white/40 text-xs mt-0.5">Adapts difficulty to player performance • Generates questions in batches</p>
                </div>
              </label>
            </div>
            
            {/* Generate Button */}
            <button
              onClick={handleAiGenerate}
              disabled={aiGenerating || !aiTopics.trim() || dynamicToggleGuard}
              className="w-full py-3 px-6 font-bold rounded-xl bg-gradient-to-r from-purple-500 to-indigo-500 hover:from-purple-600 hover:to-indigo-600 transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            >
              {aiGenerating ? (
                <>
                  <span className="animate-spin">⏳</span> Generating...
                </>
              ) : (
                <>
                  <span>✨</span> {aiDynamicMode ? 'Generate Initial Batch (10)' : 'Generate Quiz'}
                </>
              )}
            </button>

            <button
              onClick={handleThemePreview}
              disabled={themeGenerating || !aiTopics.trim() || lockTheme || !experimentalTheme}
              className="w-full py-2.5 px-6 font-semibold rounded-xl border border-purple-500/50 text-purple-200 hover:bg-purple-500/10 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {themeGenerating ? 'Previewing Theme...' : '🎨 Preview Theme'}
            </button>
            
            {/* Generation Stats */}
            {generationTime && (
              <p className="text-center text-white/40 text-xs mt-2">
                Generated in {(generationTime / 1000).toFixed(1)}s
              </p>
            )}
          </div>

          {/* Divider */}
          <div className="flex items-center gap-4">
            <div className="flex-1 h-px bg-white/20" />
            <span className="text-white/40 text-sm">or use a preset</span>
            <div className="flex-1 h-px bg-white/20" />
          </div>

          {/* Preset Quiz Options (Collapsed) */}
          <details className="group">
            <summary className="cursor-pointer list-none">
              <div className="flex items-center justify-between p-4 bg-white/5 rounded-xl hover:bg-white/10 transition-colors">
                <span className="font-medium">📚 Preset Quiz Packs</span>
                <span className="text-white/60 group-open:rotate-180 transition-transform">▼</span>
              </div>
            </summary>
            <div className="grid gap-2 mt-2">
              {questionSets.map((set) => (
                <button
                  key={set.id}
                  onClick={() => {
                    const questions = getShuffledQuestionsFromSet(set.id as QuestionSetId, 20)
                    setQuestions(questions)
                    setCsvErrors([])
                    setGenerationTime(null)
                  }}
                  className="w-full px-4 py-3 text-left font-medium rounded-xl bg-white/10 border border-white/30 hover:bg-white/20 hover:border-white/50 transition-all"
                >
                  <span className="text-xl mr-2">{set.emoji}</span>
                  <span className="font-bold">{set.name}</span>
                  <span className="text-white/50 text-sm ml-2">— {set.description}</span>
                </button>
              ))}
            </div>
          </details>

          {/* CSV Upload */}
          <div
            onDragOver={(e) => { e.preventDefault(); setDragActive(true) }}
            onDragLeave={() => setDragActive(false)}
            onDrop={handleDrop}
            className={`border-2 border-dashed rounded-2xl p-8 text-center transition-colors ${
              dragActive 
                ? 'border-primary bg-primary/10' 
                : 'border-white/30 hover:border-white/50'
            }`}
          >
            <input
              type="file"
              accept=".csv"
              onChange={handleFileSelect}
              className="hidden"
              id="csv-upload"
            />
            <label htmlFor="csv-upload" className="cursor-pointer">
              <div className="text-4xl mb-2">📄</div>
              <p className="font-medium">
                {questions.length > 0 
                  ? `${questions.length} questions loaded`
                  : 'Drop CSV or tap to upload'
                }
              </p>
              <p className="text-white/50 text-sm mt-1">
                Menti-style format
              </p>
            </label>
          </div>

          {/* Session Code Display */}
          <div className="bg-white/10 rounded-2xl p-6 text-center">
            <p className="text-white/60 text-base mb-2">Session Code</p>
            <p className="text-5xl sm:text-6xl font-mono font-bold tracking-wider text-secondary">
              {sessionCode}
            </p>
          </div>

          {/* QR Code */}
          <div className="bg-white rounded-2xl p-6 flex flex-col items-center">
            <QRCodeSVG value={joinUrl} size={180} level="M" />
            <p className="text-gray-600 text-sm mt-3">Scan to join</p>
          </div>

          {/* CSV Errors */}
          {csvErrors.length > 0 && (
            <div className="bg-yellow-500/20 border border-yellow-500 rounded-lg p-4">
              <p className="font-bold text-yellow-300 mb-2">Import warnings:</p>
              <ul className="text-sm text-yellow-200 space-y-1">
                {csvErrors.slice(0, 5).map((err, i) => (
                  <li key={i}>• {err}</li>
                ))}
                {csvErrors.length > 5 && (
                  <li>... and {csvErrors.length - 5} more</li>
                )}
              </ul>
            </div>
          )}

          {/* Questions Preview */}
          {questions.length > 0 && (
            <div className="bg-white/5 rounded-xl p-4 max-h-48 overflow-y-auto">
              <p className="text-white/60 text-sm mb-2">Questions Preview:</p>
              {questions.slice(0, 5).map((q, i) => (
                <p key={i} className="text-sm truncate py-1 border-b border-white/10 last:border-0">
                  {i + 1}. {q.question}
                </p>
              ))}
              {questions.length > 5 && (
                <p className="text-white/50 text-sm mt-2">
                  ... and {questions.length - 5} more
                </p>
              )}
            </div>
          )}

          {error && (
            <div className="p-4 bg-red-500/20 border border-red-500 rounded-lg text-red-300">
              {error}
            </div>
          )}

          {/* Start Button */}
          <button
            onClick={handleStartSession}
            disabled={loading || questions.length === 0 || generationActive}
            className="w-full py-4 px-8 text-xl font-bold rounded-2xl bg-gradient-to-r from-green-500 to-emerald-500 hover:from-green-600 hover:to-emerald-600 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading ? 'Starting...' : generationActive ? 'Preparing...' : `Start with ${questions.length} Questions`}
          </button>
        </div>
      )}

      {generationActive && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm">
          <div className="w-full max-w-sm rounded-2xl border border-white/10 bg-slate-900/90 p-6 text-center">
            <div className="text-3xl mb-3">⏳</div>
            <h3 className="text-lg font-bold">Preparing your game</h3>
            <p className="text-white/60 text-sm mt-1">
              {aiGenerating && themeGenerating
                ? 'Generating questions and theme...'
                : aiGenerating
                  ? 'Generating questions...'
                  : 'Generating theme...'}
            </p>
          </div>
        </div>
      )}
    </div>
  )
}
