import { useState, useEffect, useRef } from 'react'
import { useParams, useNavigate, Link } from 'react-router-dom'
import { useConfig } from '../context/ConfigContext'
import { ApiClient, createSmartConnection } from '../api/client'
import { SessionState, ServerMessage, RevealResults, LiveLeaderboardEntry, QuestionStats } from '../types'

interface FactCheckResult {
  verified: boolean
  confidence: number
  explanation: string
  source_hint?: string
}

export default function HostSession() {
  const { code } = useParams<{ code: string }>()
  const config = useConfig()
  const navigate = useNavigate()
  
  const [session, setSession] = useState<SessionState | null>(null)
  const [results, setResults] = useState<RevealResults | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [connectionMode, setConnectionMode] = useState<'websocket' | 'polling' | null>(null)
  const connectionRef = useRef<{ send: (data: unknown) => void; close: () => void } | null>(null)
  
  // New state for enhanced features
  const [leaderboard, setLeaderboard] = useState<LiveLeaderboardEntry[]>([])
  const [answerStatus, setAnswerStatus] = useState<{ answered: string[]; waiting: string[] }>({ answered: [], waiting: [] })
  const [timerRemaining, setTimerRemaining] = useState<number | null>(null)
  const [showLeaderboard, setShowLeaderboard] = useState(false)
  const [showAnswerDetails, setShowAnswerDetails] = useState(false)
  const [questionStats, setQuestionStats] = useState<QuestionStats | null>(null)
  const [showLiveStats, setShowLiveStats] = useState(true)
  
  // Fact-check state
  const [factCheckResults, setFactCheckResults] = useState<Record<number, FactCheckResult>>({})
  const [factCheckLoading, setFactCheckLoading] = useState<number | null>(null)
  
  // Dynamic mode state
  const [dynamicConfig, setDynamicConfig] = useState<{
    enabled: boolean
    topics: string
    authToken: string
    targetCount: number
    batchSize: number
    currentBatch: number
    lastDifficulty: string
  } | null>(null)
  const [generatingBatch, setGeneratingBatch] = useState(false)
  
  const hostToken = sessionStorage.getItem(`host_${code}`)
  const authToken = localStorage.getItem('quiz_auth_token') || ''
  const api = new ApiClient(config.apiBaseUrl)

  // Load dynamic mode config on mount
  useEffect(() => {
    if (code) {
      const configJson = sessionStorage.getItem(`dynamic_${code}`)
      if (configJson) {
        try {
          const config = JSON.parse(configJson)
          setDynamicConfig(config)
        } catch (e) {
          console.error('Failed to parse dynamic config:', e)
        }
      }
    }
  }, [code])

  useEffect(() => {
    if (!code || !hostToken) {
      navigate('/host')
      return
    }

    const handleMessage = (msg: ServerMessage) => {
      switch (msg.type) {
        case 'session_state':
          setSession(msg.state)
          if (msg.state.timerRemaining !== undefined) {
            setTimerRemaining(msg.state.timerRemaining)
          }
          break
        case 'player_joined':
          setSession(prev => prev ? {
            ...prev,
            players: [...prev.players, msg.player]
          } : null)
          break
        case 'player_left':
          setSession(prev => prev ? {
            ...prev,
            players: prev.players.filter(p => p.id !== msg.playerId)
          } : null)
          break
        case 'answer_received':
          // Update the player's answers in state
          setSession(prev => {
            if (!prev) return null
            return {
              ...prev,
              players: prev.players.map(p => 
                p.id === msg.playerId 
                  ? { ...p, answers: { ...p.answers, [msg.questionIndex]: -1 } } // -1 as placeholder, we don't know the actual answer
                  : p
              )
            }
          })
          // Update answer status if provided
          if (msg.answerStatus) {
            setAnswerStatus(msg.answerStatus)
          }
          break
        case 'question_started':
          setSession(prev => prev ? {
            ...prev,
            status: 'playing',
            currentQuestionIndex: msg.questionIndex
          } : null)
          // Reset answer status and stats for new question
          setAnswerStatus({ answered: [], waiting: [] })
          setQuestionStats(null)
          break
        case 'revealed':
          setSession(prev => prev ? { ...prev, status: 'revealed' } : null)
          setResults(msg.results)
          setTimerRemaining(null)
          break
        case 'timer_tick':
          setTimerRemaining(msg.remaining)
          break
        case 'leaderboard_update':
          setLeaderboard(msg.leaderboard)
          break
        case 'question_stats':
          setQuestionStats(msg.stats)
          break
        case 'questions_updated':
          // Questions were appended mid-session; session_state will follow
          console.log(`📝 Questions updated: +${msg.addedCount} (total: ${msg.totalQuestions})`)
          break
        case 'error':
          setError(msg.message)
          break
      }
    }

    setError(null)
    const connection = createSmartConnection(
      api,
      code,
      { hostToken },
      (data) => handleMessage(data as ServerMessage),
      (err) => setError(err.message),
      (mode) => setConnectionMode(mode)
    )
    connectionRef.current = connection

    return () => {
      connection.close()
    }
  }, [code, hostToken, config.apiBaseUrl])

  const handleStart = async () => {
    if (!code || !hostToken) return
    setLoading(true)
    try {
      await api.startRound(code, hostToken)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to start')
    }
    setLoading(false)
  }

  const handleNext = async () => {
    if (!code || !hostToken) return
    
    // Check if we need to generate next batch in dynamic mode
    if (dynamicConfig && session && !generatingBatch) {
      const currentQuestionIndex = session.currentQuestionIndex
      const totalQuestions = session.questions.length
      const questionsRemaining = totalQuestions - currentQuestionIndex - 1
      
      // Generate next batch when we have 2 or fewer questions remaining
      // and haven't reached target count
      if (questionsRemaining <= 2 && totalQuestions < dynamicConfig.targetCount) {
        await generateNextBatch()
      }
    }
    
    setLoading(true)
    try {
      await api.nextQuestion(code, hostToken)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to advance')
    }
    setLoading(false)
  }
  
  const generateNextBatch = async () => {
    if (!code || !hostToken || !session || !dynamicConfig) return
    
    setGeneratingBatch(true)
    try {
      // Fetch real performance metrics from the backend
      let performanceData
      try {
        performanceData = await api.getPerformance(code, hostToken, dynamicConfig.batchSize)
      } catch (perfErr) {
        console.warn('⚠️  Could not fetch performance data, using defaults:', perfErr)
        performanceData = {
          avg_score_percent: 60,
          avg_response_time_ms: 8000,
          player_count: session.players.length,
          questions_answered: Math.min(session.currentQuestionIndex + 1, 5)
        }
      }
      
      const nextBatchNumber = dynamicConfig.currentBatch + 1
      const questionsToGenerate = Math.min(
        dynamicConfig.batchSize,
        dynamicConfig.targetCount - session.questions.length
      )
      
      console.log(`🎲 Generating batch #${nextBatchNumber}: ${questionsToGenerate} questions (performance: ${performanceData.avg_score_percent}% correct, ${performanceData.avg_response_time_ms}ms avg)`)
      
      const result = await api.generateDynamicBatch({
        topics: dynamicConfig.topics,
        session_code: code,
        batch_number: nextBatchNumber,
        batch_size: questionsToGenerate,
        previous_difficulty: dynamicConfig.lastDifficulty || 'medium',
        performance: performanceData
      }, dynamicConfig.authToken)
      
      // Append questions mid-session using the new endpoint
      if (result.questions.length > 0) {
        await api.appendQuestions(code, hostToken, result.questions)
        
        // Update dynamic config with last difficulty for next batch
        const updatedConfig = { 
          ...dynamicConfig, 
          currentBatch: nextBatchNumber,
          lastDifficulty: result.suggested_difficulty 
        }
        setDynamicConfig(updatedConfig)
        sessionStorage.setItem(`dynamic_${code}`, JSON.stringify(updatedConfig))
        
        console.log(`✅ Appended ${result.questions.length} new questions (${result.suggested_difficulty} difficulty)`)
      }
    } catch (e) {
      console.error('Failed to generate next batch:', e)
      const errorMsg = e instanceof Error ? e.message : 'Failed to generate next batch'
      setError(errorMsg)
    }
    setGeneratingBatch(false)
  }

  const handleReveal = async () => {
    if (!code || !hostToken) return
    setLoading(true)
    try {
      await api.reveal(code, hostToken)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to reveal')
    }
    setLoading(false)
  }

  const handleFactCheck = async (questionIndex: number, question: string, correctAnswer: string, allOptions: string[]) => {
    if (!authToken) {
      setError('No auth token - please set access code in Host Create page')
      return
    }
    
    setFactCheckLoading(questionIndex)
    try {
      const result = await api.factCheck({
        question,
        claimed_answer: correctAnswer,
        all_options: allOptions
      }, authToken)
      
      setFactCheckResults(prev => ({
        ...prev,
        [questionIndex]: result
      }))
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Fact-check failed')
    }
    setFactCheckLoading(null)
  }

  if (!session) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-pulse text-xl">Connecting...</div>
      </div>
    )
  }

  const currentQuestion = session.status === 'playing' && session.questions[session.currentQuestionIndex]
  const isLastQuestion = session.currentQuestionIndex >= session.questions.length - 1
  const answeredCount = session.players.filter(p => 
    p.answers[session.currentQuestionIndex] !== undefined
  ).length

  return (
    <div className="min-h-screen p-4 max-w-2xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <Link to="/" className="text-white/60 hover:text-white text-sm">← Home</Link>
          <h1 className="text-2xl font-bold font-mono text-secondary">{code}</h1>
        </div>
        <div className="text-right">
          <span className="text-white/60 text-sm">Players</span>
          <p className="text-2xl font-bold">{session.players.length}</p>
        </div>
      </div>

      {/* Connection mode indicator */}
      {connectionMode === 'polling' && (
        <div className="mb-4 p-2 bg-yellow-500/20 border border-yellow-500/50 rounded-lg text-yellow-300 text-sm text-center">
          📡 Using polling mode (corporate network detected)
        </div>
      )}
      
      {/* Dynamic mode indicator */}
      {dynamicConfig && (
        <div className="mb-4 p-2 bg-purple-500/20 border border-purple-500/50 rounded-lg text-purple-300 text-sm text-center">
          🎲 Dynamic Mode: {session.questions.length}/{dynamicConfig.targetCount} questions
          {generatingBatch && <span className="ml-2 animate-pulse">• Generating next batch...</span>}
        </div>
      )}

      {error && (
        <div className="mb-4 p-4 bg-red-500/20 border border-red-500 rounded-lg text-red-300">
          {error}
          <button onClick={() => setError(null)} className="ml-2 underline">dismiss</button>
        </div>
      )}

      {/* Lobby State */}
      {session.status === 'lobby' && (
        <div className="space-y-6 animate-slide-up">
          <div className="bg-white/10 rounded-2xl p-6">
            <h2 className="text-xl font-bold mb-4">Waiting for Players</h2>
            
            {session.players.length === 0 ? (
              <p className="text-white/50">No players yet...</p>
            ) : (
              <div className="flex flex-wrap gap-2">
                {session.players.map(p => (
                  <span key={p.id} className="px-3 py-1 bg-white/20 rounded-full text-sm">
                    {p.nickname}
                  </span>
                ))}
              </div>
            )}
          </div>

          <div className="text-center text-white/60">
            <p>{session.questions.length} questions loaded</p>
            {session.settings?.timerMode && (
              <p className="text-secondary mt-1">⏱️ Timer mode: {session.settings.timerSeconds}s per question</p>
            )}
          </div>

          <button
            onClick={handleStart}
            disabled={loading || session.players.length === 0}
            className="w-full py-4 px-8 text-xl font-bold rounded-2xl bg-gradient-to-r from-green-500 to-emerald-500 hover:from-green-600 hover:to-emerald-600 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading ? 'Starting...' : 'Start Round'}
          </button>
        </div>
      )}

      {/* Playing State */}
      {session.status === 'playing' && currentQuestion && (
        <div className="space-y-6 animate-slide-up">
          {/* Progress & Timer */}
          <div className="flex items-center gap-4">
            <div className="flex-1 h-2 bg-white/20 rounded-full overflow-hidden">
              <div 
                className="h-full bg-primary transition-all duration-300"
                style={{ width: `${((session.currentQuestionIndex + 1) / session.questions.length) * 100}%` }}
              />
            </div>
            <span className="text-white/60 text-sm whitespace-nowrap">
              {session.currentQuestionIndex + 1} / {session.questions.length}
            </span>
          </div>

          {/* Timer Display */}
          {session.settings?.timerMode && timerRemaining !== null && (
            <div className="flex justify-center">
              <div className={`relative w-20 h-20 ${timerRemaining <= 5 ? 'animate-pulse' : ''}`}>
                <svg className="w-20 h-20 transform -rotate-90">
                  <circle
                    cx="40" cy="40" r="36"
                    stroke="rgba(255,255,255,0.2)"
                    strokeWidth="8"
                    fill="none"
                  />
                  <circle
                    cx="40" cy="40" r="36"
                    stroke={timerRemaining <= 5 ? '#ef4444' : timerRemaining <= 10 ? '#f59e0b' : '#6366f1'}
                    strokeWidth="8"
                    fill="none"
                    strokeDasharray={`${(timerRemaining / (session.settings?.timerSeconds || 15)) * 226} 226`}
                    strokeLinecap="round"
                    className="transition-all duration-1000"
                  />
                </svg>
                <span className={`absolute inset-0 flex items-center justify-center text-2xl font-bold ${
                  timerRemaining <= 5 ? 'text-red-400' : timerRemaining <= 10 ? 'text-yellow-400' : 'text-white'
                }`}>
                  {timerRemaining}
                </span>
              </div>
            </div>
          )}

          {/* Question */}
          <div className="bg-white/10 rounded-2xl p-6">
            <h2 className="text-xl md:text-2xl font-bold mb-6">
              {currentQuestion.question}
            </h2>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {currentQuestion.options.map((opt, i) => (
                <div
                  key={i}
                  className="p-4 bg-white/10 rounded-xl text-center"
                >
                  <span className="font-bold mr-2">{String.fromCharCode(65 + i)}.</span>
                  {opt}
                </div>
              ))}
            </div>
          </div>

          {/* Live Answer Distribution - Host View */}
          <div className="bg-white/5 rounded-xl overflow-hidden">
            <button
              onClick={() => setShowLiveStats(!showLiveStats)}
              className="w-full p-3 flex items-center justify-between hover:bg-white/5 transition-colors"
            >
              <span className="font-medium">📊 Live Answer Distribution</span>
              <span className="text-white/60">{showLiveStats ? '▲' : '▼'}</span>
            </button>
            
            {showLiveStats && (
              <div className="p-4 border-t border-white/10 space-y-3">
                {currentQuestion.options.map((opt, i) => {
                  const count = questionStats?.distribution[i] || 0
                  const percentage = questionStats && questionStats.answeredCount > 0
                    ? (count / questionStats.answeredCount) * 100
                    : 0
                  
                  const optionColors = ['bg-red-500', 'bg-blue-500', 'bg-yellow-500', 'bg-green-500']
                  
                  return (
                    <div key={i} className="space-y-1">
                      <div className="flex items-center justify-between text-sm">
                        <span className="truncate flex-1 mr-2">
                          <span className="font-bold">{String.fromCharCode(65 + i)}.</span> {opt}
                        </span>
                        <span className="font-mono text-white/60">{count}</span>
                      </div>
                      <div className="h-6 bg-white/10 rounded-lg overflow-hidden">
                        <div 
                          className={`h-full ${optionColors[i]} transition-all duration-500 flex items-center justify-end pr-2`}
                          style={{ width: `${Math.max(percentage, 0)}%` }}
                        >
                          {percentage > 10 && (
                            <span className="text-xs font-bold text-white/90">
                              {percentage.toFixed(0)}%
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </div>

          {/* Answer Status - Enhanced */}
          <div className="bg-white/5 rounded-xl p-4">
            <div className="flex items-center justify-between mb-2">
              <p className="text-white/60">
                <span className="text-2xl font-bold text-primary">{answeredCount}</span>
                <span className="mx-1">/</span>
                <span>{session.players.length}</span>
                <span className="ml-2">answered</span>
              </p>
              <button
                onClick={() => setShowAnswerDetails(!showAnswerDetails)}
                className="text-sm text-white/60 hover:text-white underline"
              >
                {showAnswerDetails ? 'Hide' : 'Show'} details
              </button>
            </div>
            
            {showAnswerDetails && (
              <div className="mt-3 pt-3 border-t border-white/10 grid grid-cols-2 gap-4">
                <div>
                  <p className="text-green-400 text-sm font-medium mb-2">✓ Answered ({answerStatus.answered.length})</p>
                  <div className="flex flex-wrap gap-1">
                    {session.players
                      .filter(p => p.answers[session.currentQuestionIndex] !== undefined || answerStatus.answered.includes(p.id))
                      .map(p => (
                        <span key={p.id} className="px-2 py-0.5 bg-green-500/20 text-green-300 rounded text-xs">
                          {p.nickname}
                        </span>
                      ))}
                  </div>
                </div>
                <div>
                  <p className="text-yellow-400 text-sm font-medium mb-2">⏳ Waiting ({session.players.length - answeredCount})</p>
                  <div className="flex flex-wrap gap-1">
                    {session.players
                      .filter(p => p.answers[session.currentQuestionIndex] === undefined && !answerStatus.answered.includes(p.id))
                      .map(p => (
                        <span key={p.id} className="px-2 py-0.5 bg-yellow-500/20 text-yellow-300 rounded text-xs">
                          {p.nickname}
                        </span>
                      ))}
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Live Leaderboard Toggle */}
          <div className="bg-white/5 rounded-xl overflow-hidden">
            <button
              onClick={() => setShowLeaderboard(!showLeaderboard)}
              className="w-full p-3 flex items-center justify-between hover:bg-white/5 transition-colors"
            >
              <span className="font-medium">📊 Live Leaderboard</span>
              <span className="text-white/60">{showLeaderboard ? '▲' : '▼'}</span>
            </button>
            
            {showLeaderboard && leaderboard.length > 0 && (
              <div className="border-t border-white/10">
                {leaderboard.slice(0, 5).map((entry, i) => (
                  <div key={entry.id} className={`flex items-center p-3 ${i > 0 ? 'border-t border-white/10' : ''}`}>
                    <span className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold mr-3 ${
                      i === 0 ? 'bg-yellow-500 text-black' :
                      i === 1 ? 'bg-gray-300 text-black' :
                      i === 2 ? 'bg-amber-700 text-white' :
                      'bg-white/20'
                    }`}>
                      {entry.rank}
                    </span>
                    <span className="flex-1 truncate">{entry.nickname}</span>
                    <span className="text-sm text-white/60 mr-2">{entry.correctAnswers}/{entry.totalAnswers}</span>
                    <span className="font-bold text-primary">{entry.score}</span>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Controls - hide manual controls if timer mode is active */}
          {!session.settings?.timerMode && (
            <div className="flex gap-4">
              {!isLastQuestion ? (
                <button
                  onClick={handleNext}
                  disabled={loading}
                  className="flex-1 py-4 text-lg font-bold rounded-2xl bg-primary hover:bg-indigo-600 transition-all disabled:opacity-50"
                >
                  Next Question →
                </button>
              ) : (
                <button
                  onClick={handleReveal}
                  disabled={loading}
                  className="flex-1 py-4 text-lg font-bold rounded-2xl bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600 transition-all disabled:opacity-50"
                >
                  🏆 Reveal Results
                </button>
              )}
              
              {!isLastQuestion && (
                <button
                  onClick={handleReveal}
                  disabled={loading}
                  className="py-4 px-6 text-lg font-bold rounded-2xl bg-white/10 hover:bg-white/20 transition-all disabled:opacity-50"
                >
                  End Early
                </button>
              )}
            </div>
          )}

          {/* Manual override in timer mode */}
          {session.settings?.timerMode && (
            <div className="flex gap-4">
              <button
                onClick={handleNext}
                disabled={loading || isLastQuestion}
                className="flex-1 py-3 text-sm font-medium rounded-xl bg-white/10 hover:bg-white/20 transition-all disabled:opacity-50"
              >
                Skip to Next →
              </button>
              <button
                onClick={handleReveal}
                disabled={loading}
                className="py-3 px-4 text-sm font-medium rounded-xl bg-amber-500/20 text-amber-300 hover:bg-amber-500/30 transition-all disabled:opacity-50"
              >
                End Early
              </button>
            </div>
          )}
        </div>
      )}

      {/* Revealed State */}
      {session.status === 'revealed' && results && (
        <div className="space-y-6 animate-slide-up">
          <h2 className="text-3xl font-bold text-center mb-6">🏆 Final Results</h2>
          
          {/* Leaderboard */}
          <div className="bg-white/10 rounded-2xl overflow-hidden">
            {results.players.map((p, i) => (
              <div 
                key={p.id}
                className={`flex items-center p-4 ${i > 0 ? 'border-t border-white/10' : ''}`}
              >
                <div className={`w-10 h-10 rounded-full flex items-center justify-center font-bold mr-4 ${
                  i === 0 ? 'bg-yellow-500 text-black' :
                  i === 1 ? 'bg-gray-300 text-black' :
                  i === 2 ? 'bg-amber-700 text-white' :
                  'bg-white/20'
                }`}>
                  {p.rank}
                </div>
                <div className="flex-1">
                  <span className="font-medium">{p.nickname}</span>
                  <span className="text-white/40 text-sm ml-2">
                    {p.totalTime.toFixed(1)}s
                  </span>
                </div>
                <span className="text-xl font-bold text-primary">{p.score}</span>
              </div>
            ))}
          </div>
          <p className="text-center text-white/40 text-sm">
            Ties broken by fastest total answer time ⚡
          </p>

          {/* Post-Game Actions */}
          <div className="flex flex-col sm:flex-row gap-3">
            <Link
              to="/host"
              className="flex-1 py-4 text-lg font-bold text-center rounded-2xl bg-gradient-to-r from-primary to-indigo-500 hover:from-indigo-600 hover:to-primary transition-all hover:scale-105 active:scale-95"
            >
              🎮 Host New Game
            </Link>
            <Link
              to="/"
              className="flex-1 py-4 text-lg font-bold text-center rounded-2xl bg-white/10 border border-white/30 hover:bg-white/20 transition-all"
            >
              🏠 Home
            </Link>
          </div>

          {/* Questions Review */}
          <div className="space-y-4">
            <h3 className="text-xl font-bold">Questions Review</h3>
            {results.questions.map((q, i) => (
              <div key={i} className="bg-white/5 rounded-xl p-4">
                <p className="font-medium mb-2">
                  <span className="text-white/60 mr-2">Q{i + 1}.</span>
                  {q.question}
                </p>
                <p className="text-green-400 text-sm mb-1">
                  ✓ {String.fromCharCode(65 + q.correct)}. {q.options[q.correct]}
                </p>
                {q.explanation && (
                  <p className="text-white/60 text-sm mt-2 italic">
                    💡 {q.explanation}
                  </p>
                )}
                
                {/* Fact-Check Section */}
                <div className="mt-3 pt-3 border-t border-white/10">
                  {factCheckResults[i] ? (
                    <div className={`p-3 rounded-lg ${
                      factCheckResults[i].verified 
                        ? 'bg-green-500/10 border border-green-500/30' 
                        : 'bg-yellow-500/10 border border-yellow-500/30'
                    }`}>
                      <div className="flex items-center gap-2 mb-1">
                        <span>{factCheckResults[i].verified ? '✅' : '⚠️'}</span>
                        <span className={`font-medium ${factCheckResults[i].verified ? 'text-green-400' : 'text-yellow-400'}`}>
                          {factCheckResults[i].verified ? 'Verified' : 'Uncertain'}
                        </span>
                        <span className="text-white/40 text-xs">
                          ({Math.round(factCheckResults[i].confidence * 100)}% confidence)
                        </span>
                      </div>
                      <p className="text-white/70 text-sm">{factCheckResults[i].explanation}</p>
                      {factCheckResults[i].source_hint && (
                        <p className="text-white/40 text-xs mt-1">📚 {factCheckResults[i].source_hint}</p>
                      )}
                    </div>
                  ) : (
                    <button
                      onClick={() => handleFactCheck(i, q.question, q.options[q.correct], q.options)}
                      disabled={factCheckLoading === i}
                      className="text-sm px-3 py-1.5 rounded-lg bg-white/10 hover:bg-white/20 transition-colors disabled:opacity-50 flex items-center gap-2"
                    >
                      {factCheckLoading === i ? (
                        <>
                          <span className="animate-spin">⏳</span>
                          Checking...
                        </>
                      ) : (
                        <>
                          <span>🔍</span>
                          Fact-Check This Answer
                        </>
                      )}
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
