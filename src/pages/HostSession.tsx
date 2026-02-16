import { useState, useEffect, useRef } from 'react'
import { useParams, useNavigate, Link } from 'react-router-dom'
import { useConfig } from '../context/ConfigContext'
import { ApiClient, createSmartConnection } from '../api/client'
import {
  SessionState,
  ServerMessage,
  RevealResults,
  LiveLeaderboardEntry,
  QuestionStats,
  ChallengeSummary,
  ChallengeDetail
} from '../types'
import { useSessionLeaveGuard } from '../hooks/useSessionLeaveGuard'
import { useAITelemetry } from '../context/AITelemetryContext'

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
  
  const { recordCall } = useAITelemetry()

  // Fact-check state
  const [factCheckResults, setFactCheckResults] = useState<Record<number, FactCheckResult>>({})
  const [factCheckLoading, setFactCheckLoading] = useState<number | null>(null)

  // Challenge state
  const [challenges, setChallenges] = useState<ChallengeSummary[]>([])
  const [challengeDetail, setChallengeDetail] = useState<ChallengeDetail | null>(null)
  const [selectedChallengeIndex, setSelectedChallengeIndex] = useState<number | null>(null)
  const [challengeLoading, setChallengeLoading] = useState(false)
  const [challengeError, setChallengeError] = useState<string | null>(null)
  const [resolutionDraft, setResolutionDraft] = useState({
    status: 'open',
    verdict: '',
    note: '',
    publish: false
  })
  const [aiVerificationLoading, setAiVerificationLoading] = useState(false)
  const [publishAiLoading, setPublishAiLoading] = useState(false)
  const [reconcilePolicy, setReconcilePolicy] = useState('void')
  const [reconcileAnswers, setReconcileAnswers] = useState('')
  
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

  // Host-as-player state
  const hostAnswerRef = useRef<number | null>(null)
  const hostAnswerLockedRef = useRef(false)
  const [hostSelectedAnswer, setHostSelectedAnswer] = useState<number | null>(null)
  const [hostAnswerLocked, setHostAnswerLocked] = useState(false)
  const hostQuestionShownAtRef = useRef(Date.now())

  // Share link state
  const [copiedLink, setCopiedLink] = useState<string | null>(null)

  // Host controls and presentation
  const [hostControlsMode, setHostControlsMode] = useState<'hidden' | 'compact' | 'full'>('full')
  const [presentationMode, setPresentationMode] = useState(false)
  const [holdUnlockActive, setHoldUnlockActive] = useState(false)
  const holdUnlockTimerRef = useRef<number | null>(null)
  const [controlsOpen, setControlsOpen] = useState(false)
  
  const hostToken = sessionStorage.getItem(`host_${code}`)
  const hostRole = code ? sessionStorage.getItem(`host_role_${code}`) : null
  const hostPlayerId = code ? sessionStorage.getItem(`host_player_${code}`) : null
  const hostPlayerName = code ? sessionStorage.getItem(`host_player_name_${code}`) : null
  const isHostPlayer = Boolean(hostPlayerId && hostRole !== 'host_only')
  const authToken = localStorage.getItem('quiz_auth_token') || ''
  const api = new ApiClient(config.apiBaseUrl)

  const shouldGuard = Boolean(session && code && hostToken)
  useSessionLeaveGuard(shouldGuard, 'You have an active session. Leaving will end your participation. Continue?')

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
    if (!code) return
    const savedMode = localStorage.getItem(`host_controls_${code}`)
    if (savedMode === 'hidden' || savedMode === 'compact' || savedMode === 'full') {
      setHostControlsMode(savedMode)
    } else {
      setHostControlsMode(isHostPlayer ? 'hidden' : 'full')
    }

    const savedPresentation = localStorage.getItem(`presentation_${code}`)
    setPresentationMode(savedPresentation === 'true')
    setControlsOpen(!isHostPlayer)
  }, [code, isHostPlayer])

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
          if (isHostPlayer) {
            updateHostSelectedAnswer(null)
            updateHostAnswerLocked(false)
            hostQuestionShownAtRef.current = Date.now()
          }
          break
        case 'revealed':
          setSession(prev => prev ? { ...prev, status: 'revealed' } : null)
          setResults(msg.results)
          setTimerRemaining(null)
          if (isHostPlayer) {
            updateHostAnswerLocked(true)
          }
          break
        case 'timer_tick':
          setTimerRemaining(msg.remaining)
          if (
            isHostPlayer &&
            msg.remaining === 0 &&
            !hostAnswerLockedRef.current &&
            hostAnswerRef.current !== null
          ) {
            void submitHostAnswer()
          }
          break
        case 'leaderboard_update':
          setLeaderboard(msg.leaderboard)
          setResults(prev => prev ? {
            ...prev,
            players: prev.players.map(p => {
              const entry = msg.leaderboard.find(e => e.id === p.id)
              return entry ? { ...p, score: entry.score, rank: entry.rank } : p
            })
          } : prev)
          break
        case 'question_stats':
          setQuestionStats(msg.stats)
          break
        case 'challenge_updated':
          setChallenges(prev => {
            const next = [...prev]
            const idx = next.findIndex(c => c.questionIndex === msg.questionIndex)
            const updated = {
              questionIndex: msg.questionIndex,
              question: idx >= 0 ? next[idx].question : `Question ${msg.questionIndex + 1}`,
              count: msg.count,
              status: msg.status,
              categories: idx >= 0 ? next[idx].categories : {},
              lastUpdatedAt: Date.now() / 1000
            }
            if (idx >= 0) {
              next[idx] = { ...next[idx], ...updated }
            } else {
              next.push(updated)
            }
            return next
          })
          break
        case 'challenge_resolution':
          setChallengeDetail(prev => prev && prev.questionIndex === msg.questionIndex
            ? { ...prev, resolution: msg.resolution }
            : prev)
          break
        case 'challenge_ai_verified':
        case 'challenge_ai_published':
          setChallengeDetail(prev => prev && prev.questionIndex === msg.questionIndex
            ? { ...prev, aiVerification: msg.aiVerification }
            : prev)
          break
        case 'scores_reconciled':
          setChallengeDetail(prev => prev && prev.questionIndex === msg.questionIndex
            ? { ...prev, reconciliation: msg.policy }
            : prev)
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

  useEffect(() => {
    if (session?.status === 'revealed') {
      loadChallenges()
    }
  }, [session?.status])

  useEffect(() => {
    if (!isHostPlayer || !session || !hostPlayerId) return
    if (session.status !== 'playing') return
    const hostEntry = session.players.find(p => p.id === hostPlayerId)
    const hasAnswered = Boolean(hostEntry && hostEntry.answers[session.currentQuestionIndex] !== undefined)
    if (hasAnswered) {
      updateHostAnswerLocked(true)
    }
  }, [isHostPlayer, session, hostPlayerId])

  const updateHostSelectedAnswer = (value: number | null) => {
    hostAnswerRef.current = value
    setHostSelectedAnswer(value)
  }

  const updateHostAnswerLocked = (value: boolean) => {
    hostAnswerLockedRef.current = value
    setHostAnswerLocked(value)
  }

  const setControlsMode = (mode: 'hidden' | 'compact' | 'full') => {
    setHostControlsMode(mode)
    if (code) {
      localStorage.setItem(`host_controls_${code}`, mode)
    }
  }

  const setPresentation = (value: boolean) => {
    setPresentationMode(value)
    if (code) {
      localStorage.setItem(`presentation_${code}`, String(value))
    }
  }

  const submitHostAnswer = async () => {
    if (!code || !hostPlayerId || !session || hostAnswerRef.current === null) return
    updateHostAnswerLocked(true)
    const responseTimeMs = Date.now() - hostQuestionShownAtRef.current
    try {
      await api.submitAnswer(code, hostPlayerId, session.currentQuestionIndex, hostAnswerRef.current, responseTimeMs)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to submit answer')
      updateHostAnswerLocked(false)
    }
  }

  const handleHostSelectAnswer = (choice: number) => {
    if (hostAnswerLockedRef.current) return
    if (session?.settings?.timerMode && timerRemaining === 0) return
    updateHostSelectedAnswer(choice)
  }

  const startHoldUnlock = () => {
    if (holdUnlockTimerRef.current || !code) return
    setHoldUnlockActive(true)
    holdUnlockTimerRef.current = window.setTimeout(() => {
      setHoldUnlockActive(false)
      holdUnlockTimerRef.current = null
      setControlsMode('full')
    }, 900)
  }

  const endHoldUnlock = () => {
    if (!holdUnlockTimerRef.current) return
    window.clearTimeout(holdUnlockTimerRef.current)
    holdUnlockTimerRef.current = null
    setHoldUnlockActive(false)
  }

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
    if (dynamicConfig && session) {
      const currentQuestionIndex = session.currentQuestionIndex
      const totalQuestions = session.questions.length
      const questionsRemaining = totalQuestions - currentQuestionIndex - 1
      const isAtLastLoadedQuestion = currentQuestionIndex >= totalQuestions - 1
      const needsMoreQuestions = totalQuestions < dynamicConfig.targetCount
      
      // Generate next batch when we have 5 or fewer questions remaining
      // and haven't reached target count
      if (!generatingBatch && questionsRemaining <= 5 && needsMoreQuestions) {
        void generateNextBatch()
      }

      // If we're at the last loaded question but need more, wait for batch
      if (isAtLastLoadedQuestion && needsMoreQuestions) {
        return
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

      if (result.ai_meta) recordCall('generate_dynamic_batch', result.ai_meta)
      
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

      if (result.ai_meta) recordCall('fact_check', result.ai_meta)
      
      setFactCheckResults(prev => ({
        ...prev,
        [questionIndex]: result
      }))
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Fact-check failed')
    }
    setFactCheckLoading(null)
  }

  const loadChallenges = async () => {
    if (!code || !hostToken) return
    setChallengeLoading(true)
    setChallengeError(null)
    try {
      const response = await api.getChallenges(code, hostToken)
      setChallenges(response.challenges)
    } catch (e) {
      setChallengeError(e instanceof Error ? e.message : 'Failed to load challenges')
    }
    setChallengeLoading(false)
  }

  const loadChallengeDetail = async (questionIndex: number) => {
    if (!code || !hostToken) return
    setSelectedChallengeIndex(questionIndex)
    setChallengeLoading(true)
    setChallengeError(null)
    try {
      const detail = await api.getChallengeDetail(code, hostToken, questionIndex)
      setChallengeDetail(detail)
      const resolution = detail.resolution
      setResolutionDraft({
        status: resolution?.status || 'open',
        verdict: resolution?.verdict || '',
        note: resolution?.resolutionNote || '',
        publish: resolution?.published || false
      })
    } catch (e) {
      setChallengeError(e instanceof Error ? e.message : 'Failed to load challenge detail')
    }
    setChallengeLoading(false)
  }

  const handleResolutionSave = async () => {
    if (!code || !hostToken || selectedChallengeIndex === null) return
    setChallengeLoading(true)
    setChallengeError(null)
    try {
      const response = await api.resolveChallenge(code, hostToken, selectedChallengeIndex, {
        status: resolutionDraft.status,
        verdict: resolutionDraft.verdict || undefined,
        resolutionNote: resolutionDraft.note || undefined,
        publish: resolutionDraft.publish
      })
      setChallengeDetail(prev => prev ? { ...prev, resolution: response.resolution } : prev)
      await loadChallenges()
    } catch (e) {
      setChallengeError(e instanceof Error ? e.message : 'Failed to update resolution')
    }
    setChallengeLoading(false)
  }

  const handleAIVerify = async () => {
    if (!code || !hostToken || selectedChallengeIndex === null) return
    if (!authToken) {
      setChallengeError('No auth token - please set access code in Host Create page')
      return
    }
    setAiVerificationLoading(true)
    setChallengeError(null)
    try {
      const response = await api.requestChallengeAIVerification(code, hostToken, authToken, selectedChallengeIndex)
      setChallengeDetail(prev => prev ? { ...prev, aiVerification: response.aiVerification } : prev)
    } catch (e) {
      setChallengeError(e instanceof Error ? e.message : 'AI verification failed')
    }
    setAiVerificationLoading(false)
  }

  const handlePublishAI = async () => {
    if (!code || !hostToken || selectedChallengeIndex === null) return
    setPublishAiLoading(true)
    setChallengeError(null)
    try {
      const response = await api.publishChallengeAIVerification(code, hostToken, selectedChallengeIndex, true)
      setChallengeDetail(prev => prev ? { ...prev, aiVerification: response.aiVerification } : prev)
    } catch (e) {
      setChallengeError(e instanceof Error ? e.message : 'Failed to publish AI verification')
    }
    setPublishAiLoading(false)
  }

  const handleReconcile = async () => {
    if (!code || !hostToken || selectedChallengeIndex === null) return
    setChallengeLoading(true)
    setChallengeError(null)
    try {
      const acceptedAnswers = reconcilePolicy === 'accept_multiple'
        ? reconcileAnswers
            .split(',')
            .map(value => Number(value.trim()))
            .filter(value => Number.isFinite(value))
        : undefined

      const response = await api.reconcileScores(code, hostToken, selectedChallengeIndex, {
        policy: reconcilePolicy,
        acceptedAnswers
      })
      setChallengeDetail(prev => prev ? { ...prev, reconciliation: response.policy } : prev)
      await loadChallenges()
    } catch (e) {
      setChallengeError(e instanceof Error ? e.message : 'Failed to reconcile scores')
    }
    setChallengeLoading(false)
  }

  if (!session) {
    return (
      <div className="min-h-[100dvh] flex items-center justify-center">
        <div className="animate-pulse text-xl">Connecting...</div>
      </div>
    )
  }

  const currentQuestion = session.status === 'playing' && session.questions[session.currentQuestionIndex]
  const isLastQuestion = session.currentQuestionIndex >= session.questions.length - 1
  const answeredCount = session.players.filter(p => 
    p.answers[session.currentQuestionIndex] !== undefined
  ).length
  const showAdmin = hostControlsMode !== 'hidden' && !presentationMode
  const showFullAdmin = hostControlsMode === 'full' && !presentationMode
  const hostDisplayName = hostPlayerName || 'Host'

  return (
    <div className={`min-h-[100dvh] px-2 py-3 sm:p-4 mx-auto ${presentationMode ? 'max-w-4xl' : 'max-w-2xl'}`}>
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-bold font-mono text-secondary">{code}</h1>
            <button
              onClick={() => {
                const link = `${window.location.origin}/join/${code}`
                navigator.clipboard.writeText(link)
                setCopiedLink('header')
                setTimeout(() => setCopiedLink(null), 2000)
              }}
              className="p-1.5 rounded-lg bg-white/10 hover:bg-white/20 transition-colors text-white/60 hover:text-white"
              title="Copy join link"
            >
              {copiedLink === 'header' ? (
                <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 text-green-400" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" /></svg>
              ) : (
                <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor"><path d="M12.586 4.586a2 2 0 112.828 2.828l-3 3a2 2 0 01-2.828 0 1 1 0 00-1.414 1.414 4 4 0 005.656 0l3-3a4 4 0 00-5.656-5.656l-1.5 1.5a1 1 0 101.414 1.414l1.5-1.5zm-5 5a2 2 0 012.828 0 1 1 0 001.414-1.414 4 4 0 00-5.656 0l-3 3a4 4 0 105.656 5.656l1.5-1.5a1 1 0 10-1.414-1.414l-1.5 1.5a2 2 0 11-2.828-2.828l3-3z" /></svg>
              )}
            </button>
          </div>
          {isHostPlayer && (
            <p className="text-white/60 text-sm">Playing as {hostDisplayName}</p>
          )}
        </div>
        <div className="text-right">
          <span className="text-white/60 text-sm">Players</span>
          <p className="text-2xl font-bold">{session.players.length}</p>
        </div>
      </div>

      {/* Host Controls Drawer */}
      <div className="mb-4 rounded-2xl border border-white/10 bg-white/5">
        <button
          onClick={() => setControlsOpen(prev => !prev)}
          className="w-full px-4 py-3 flex items-center justify-between text-left"
        >
          <span className="font-semibold">Host Controls</span>
          <span className="text-white/60">{controlsOpen ? '▲' : '▼'}</span>
        </button>
        {controlsOpen && (
          <div className="border-t border-white/10 px-4 py-3 space-y-3">
            <div className="flex flex-wrap gap-2">
              <button
                onClick={() => setControlsMode('hidden')}
                className={`px-3 py-1.5 rounded-full text-sm border transition-colors ${
                  hostControlsMode === 'hidden'
                    ? 'bg-white/20 border-white/30'
                    : 'bg-white/5 border-white/10 hover:bg-white/10'
                }`}
              >
                Hidden
              </button>
              <button
                onClick={() => setControlsMode('compact')}
                className={`px-3 py-1.5 rounded-full text-sm border transition-colors ${
                  hostControlsMode === 'compact'
                    ? 'bg-white/20 border-white/30'
                    : 'bg-white/5 border-white/10 hover:bg-white/10'
                }`}
              >
                Compact
              </button>
              <button
                onMouseDown={startHoldUnlock}
                onMouseUp={endHoldUnlock}
                onMouseLeave={endHoldUnlock}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') startHoldUnlock()
                }}
                onKeyUp={endHoldUnlock}
                className={`px-3 py-1.5 rounded-full text-sm border transition-colors ${
                  hostControlsMode === 'full'
                    ? 'bg-white/20 border-white/30'
                    : 'bg-amber-500/10 border-amber-500/40 hover:bg-amber-500/20'
                }`}
                aria-label="Hold to unlock full controls"
              >
                {hostControlsMode === 'full' ? 'Full' : holdUnlockActive ? 'Hold…' : 'Hold for Full'}
              </button>
            </div>
            <div className="flex items-center justify-between rounded-xl bg-white/5 border border-white/10 px-3 py-2">
              <div>
                <p className="font-medium">Presentation Mode</p>
                <p className="text-xs text-white/50">Hide admin elements and enlarge questions</p>
              </div>
              <input
                type="checkbox"
                checked={presentationMode}
                onChange={(e) => setPresentation(e.target.checked)}
                className="h-5 w-5 accent-primary"
              />
            </div>
          </div>
        )}
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

          {/* Share Links */}
          <div className="bg-white/10 rounded-2xl p-6">
            <h2 className="text-lg font-bold mb-3">Share Links</h2>
            <div className="space-y-3">
              {/* Player join link */}
              <div>
                <label className="block text-white/50 text-xs mb-1">Player Join Link</label>
                <div className="flex items-center gap-2">
                  <code className="flex-1 px-3 py-2 bg-black/30 rounded-lg text-sm text-white/80 truncate">
                    {`${window.location.origin}/join/${code}`}
                  </code>
                  <button
                    onClick={() => {
                      navigator.clipboard.writeText(`${window.location.origin}/join/${code}`)
                      setCopiedLink('player')
                      setTimeout(() => setCopiedLink(null), 2000)
                    }}
                    className={`px-3 py-2 rounded-lg text-sm font-medium transition-all ${
                      copiedLink === 'player'
                        ? 'bg-green-500/20 text-green-300 border border-green-500/50'
                        : 'bg-white/10 hover:bg-white/20 text-white/80 border border-white/20'
                    }`}
                  >
                    {copiedLink === 'player' ? 'Copied!' : 'Copy'}
                  </button>
                </div>
              </div>
              {/* Audience watch link */}
              <div>
                <label className="block text-white/50 text-xs mb-1">Audience Watch Link</label>
                <div className="flex items-center gap-2">
                  <code className="flex-1 px-3 py-2 bg-black/30 rounded-lg text-sm text-white/80 truncate">
                    {`${window.location.origin}/watch/${code}`}
                  </code>
                  <button
                    onClick={() => {
                      navigator.clipboard.writeText(`${window.location.origin}/watch/${code}`)
                      setCopiedLink('audience')
                      setTimeout(() => setCopiedLink(null), 2000)
                    }}
                    className={`px-3 py-2 rounded-lg text-sm font-medium transition-all ${
                      copiedLink === 'audience'
                        ? 'bg-green-500/20 text-green-300 border border-green-500/50'
                        : 'bg-white/10 hover:bg-white/20 text-white/80 border border-white/20'
                    }`}
                  >
                    {copiedLink === 'audience' ? 'Copied!' : 'Copy'}
                  </button>
                </div>
              </div>
            </div>
          </div>

          <div className="text-center text-white/60">
            <p>{session.questions.length} questions loaded</p>
            {session.settings?.timerMode && (
              <p className="text-secondary mt-1">⏱️ Timer mode: {session.settings.timerSeconds}s per question</p>
            )}
          </div>

          {showAdmin && (
            <button
              onClick={handleStart}
              disabled={loading || session.players.length === 0}
              className="w-full py-4 px-8 text-xl font-bold rounded-2xl bg-gradient-to-r from-green-500 to-emerald-500 hover:from-green-600 hover:to-emerald-600 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? 'Starting...' : 'Start Round'}
            </button>
          )}
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
            <h2 className={`${presentationMode ? 'text-3xl md:text-4xl' : 'text-xl md:text-2xl'} font-bold mb-6`}>
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

          {/* Host Player Answer Panel */}
          {isHostPlayer && !presentationMode && (
            <div className="bg-white/10 rounded-2xl p-4">
              <div className="flex items-center justify-between mb-3">
                <div>
                  <p className="text-sm text-white/60">Your Answer</p>
                  <p className="font-semibold">{hostDisplayName}</p>
                </div>
                <div className="text-sm text-white/60">
                  {hostAnswerLocked ? 'Answer locked' : 'Select and confirm'}
                </div>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                {currentQuestion.options.map((opt, i) => (
                  <button
                    key={i}
                    type="button"
                    onClick={() => handleHostSelectAnswer(i)}
                    disabled={hostAnswerLocked || (session.settings?.timerMode && timerRemaining === 0)}
                    className={`px-3 py-3 rounded-xl border text-left transition-all ${
                      hostSelectedAnswer === i
                        ? 'bg-primary/30 border-primary/60'
                        : 'bg-white/5 border-white/10 hover:bg-white/10'
                    } ${hostAnswerLocked ? 'opacity-60 cursor-not-allowed' : ''}`}
                  >
                    <span className="font-bold mr-2">{String.fromCharCode(65 + i)}.</span>
                    {opt}
                  </button>
                ))}
              </div>
              <div className="mt-3 flex items-center justify-between">
                {session.settings?.timerMode && timerRemaining === 0 && !hostAnswerLocked && (
                  <span className="text-sm text-red-300">Time's up</span>
                )}
                <button
                  type="button"
                  onClick={submitHostAnswer}
                  disabled={hostAnswerLocked || hostSelectedAnswer === null}
                  className="ml-auto px-4 py-2 rounded-xl bg-white/10 border border-white/20 text-sm font-semibold hover:bg-white/20 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {hostAnswerLocked ? 'Locked' : 'Lock Answer'}
                </button>
              </div>
            </div>
          )}

          {/* Live Answer Distribution - Host View */}
          {showFullAdmin && (
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
          )}

          {/* Answer Status - Enhanced */}
          {showFullAdmin && (
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
          )}

          {/* Live Leaderboard Toggle */}
          {showFullAdmin && (
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
          )}

          {/* Controls - hide manual controls if timer mode is active */}
          {showAdmin && !session.settings?.timerMode && (
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
          {showAdmin && session.settings?.timerMode && (
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

          {showFullAdmin && (
            <>
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

              {/* Challenges Dashboard */}
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <h3 className="text-xl font-bold">Challenges</h3>
                  <button
                    onClick={loadChallenges}
                    className="text-sm px-3 py-1.5 rounded-lg bg-white/10 hover:bg-white/20 transition-colors"
                  >
                    Refresh
                  </button>
                </div>

                {challengeError && (
                  <div className="p-3 rounded-lg bg-red-500/20 border border-red-500/40 text-red-300 text-sm">
                    {challengeError}
                  </div>
                )}

                {challengeLoading && (
                  <div className="text-white/60 text-sm">Loading challenges...</div>
                )}

                {!challengeLoading && challenges.length === 0 && (
                  <div className="text-white/50 text-sm">No challenges yet.</div>
                )}

                <div className="space-y-2">
                  {challenges.map((challenge) => (
                    <button
                      key={challenge.questionIndex}
                      onClick={() => loadChallengeDetail(challenge.questionIndex)}
                      className={`w-full text-left p-3 rounded-xl border transition-colors ${
                        challengeDetail?.questionIndex === challenge.questionIndex
                          ? 'border-primary/60 bg-primary/10'
                          : 'border-white/10 bg-white/5 hover:bg-white/10'
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <span className="font-medium truncate">
                          Q{challenge.questionIndex + 1}. {challenge.question}
                        </span>
                        <span className="text-sm text-white/60">{challenge.count} challenge{challenge.count !== 1 ? 's' : ''}</span>
                      </div>
                      <div className="mt-1 text-xs text-white/50">
                        Status: {challenge.status}
                      </div>
                    </button>
                  ))}
                </div>

                {challengeDetail && (
                  <div className="bg-white/5 rounded-xl p-4 space-y-4">
                    <div>
                      <h4 className="font-bold mb-1">
                        Q{challengeDetail.questionIndex + 1}. {challengeDetail.question}
                      </h4>
                      <div className="space-y-1 text-sm">
                        {challengeDetail.options.map((option, index) => (
                          <div
                            key={index}
                            className={index === challengeDetail.correct ? 'text-green-400' : 'text-white/70'}
                          >
                            {String.fromCharCode(65 + index)}. {option}
                            {index === challengeDetail.correct && ' ✓'}
                          </div>
                        ))}
                      </div>
                      {challengeDetail.explanation && (
                        <p className="text-white/60 text-sm mt-2 italic">💡 {challengeDetail.explanation}</p>
                      )}
                    </div>

                    <div>
                      <h5 className="font-semibold mb-2">Submissions</h5>
                      <div className="space-y-2">
                        {challengeDetail.submissions.length === 0 ? (
                          <p className="text-white/50 text-sm">No submissions yet.</p>
                        ) : (
                          challengeDetail.submissions.map((submission, idx) => (
                            <div key={idx} className="p-2 rounded-lg bg-white/5 text-sm">
                              <div className="flex items-center justify-between">
                                <span className="font-medium">{submission.nickname}</span>
                                <span className="text-white/40 text-xs">{submission.source}</span>
                              </div>
                              {submission.category && (
                                <div className="text-white/60 text-xs">Category: {submission.category}</div>
                              )}
                              {submission.note && (
                                <div className="text-white/70 mt-1">{submission.note}</div>
                              )}
                            </div>
                          ))
                        )}
                      </div>
                    </div>

                    <div className="space-y-2">
                      <h5 className="font-semibold">Resolution</h5>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                        <label className="text-xs text-white/60">Status
                          <select
                            value={resolutionDraft.status}
                            onChange={(e) => setResolutionDraft(prev => ({ ...prev, status: e.target.value }))}
                            className="mt-1 w-full rounded-lg bg-white/10 border border-white/20 px-2 py-1 text-sm"
                          >
                            <option value="open" className="bg-gray-800 text-white">Open</option>
                            <option value="under_review" className="bg-gray-800 text-white">Under Review</option>
                            <option value="resolved" className="bg-gray-800 text-white">Resolved</option>
                          </select>
                        </label>
                        <label className="text-xs text-white/60">Verdict
                          <select
                            value={resolutionDraft.verdict}
                            onChange={(e) => setResolutionDraft(prev => ({ ...prev, verdict: e.target.value }))}
                            className="mt-1 w-full rounded-lg bg-white/10 border border-white/20 px-2 py-1 text-sm"
                          >
                            <option value="" className="bg-gray-800 text-white">Select</option>
                            <option value="valid" className="bg-gray-800 text-white">Valid – original answer is correct</option>
                            <option value="invalid" className="bg-gray-800 text-white">Invalid – question/answer is wrong</option>
                            <option value="ambiguous" className="bg-gray-800 text-white">Ambiguous – multiple answers defensible</option>
                          </select>
                        </label>
                      </div>
                      <label className="text-xs text-white/60 block">
                        Resolution note
                        <textarea
                          value={resolutionDraft.note}
                          onChange={(e) => setResolutionDraft(prev => ({ ...prev, note: e.target.value }))}
                          className="mt-1 w-full rounded-lg bg-white/10 border border-white/20 px-2 py-1 text-sm"
                          rows={2}
                        />
                      </label>
                      <label className="flex items-center gap-2 text-xs text-white/70">
                        <input
                          type="checkbox"
                          checked={resolutionDraft.publish}
                          onChange={(e) => setResolutionDraft(prev => ({ ...prev, publish: e.target.checked }))}
                        />
                        Publish resolution to players
                      </label>
                      <button
                        onClick={handleResolutionSave}
                        className="px-3 py-2 rounded-lg bg-primary/20 border border-primary/40 text-sm hover:bg-primary/30"
                      >
                        Save Resolution
                      </button>
                    </div>

                    <div className="space-y-2">
                      <h5 className="font-semibold">AI Verification</h5>
                      {challengeDetail.aiVerification ? (
                        <div className="p-3 rounded-lg bg-white/5 text-sm space-y-1">
                          <div className="flex items-center justify-between">
                            <span className="font-medium">Verdict: {challengeDetail.aiVerification.verdict}</span>
                            <span className="text-white/40">{Math.round(challengeDetail.aiVerification.confidence * 100)}%</span>
                          </div>
                          <div className="text-white/70">{challengeDetail.aiVerification.rationale}</div>
                          {challengeDetail.aiVerification.suggested_correction && (
                            <div className="text-white/60">Suggested: {challengeDetail.aiVerification.suggested_correction}</div>
                          )}
                          <div className="text-xs text-white/40">Published: {challengeDetail.aiVerification.published ? 'Yes' : 'No'}</div>
                        </div>
                      ) : (
                        <p className="text-white/50 text-sm">No AI verification yet.</p>
                      )}
                      <div className="flex flex-wrap gap-2">
                        <button
                          onClick={handleAIVerify}
                          disabled={aiVerificationLoading}
                          className="px-3 py-2 rounded-lg bg-white/10 border border-white/20 text-sm hover:bg-white/20 disabled:opacity-50"
                        >
                          {aiVerificationLoading ? 'Requesting...' : 'Request AI Verification'}
                        </button>
                        <button
                          onClick={handlePublishAI}
                          disabled={publishAiLoading || !challengeDetail.aiVerification}
                          className="px-3 py-2 rounded-lg bg-white/10 border border-white/20 text-sm hover:bg-white/20 disabled:opacity-50"
                        >
                          {publishAiLoading ? 'Publishing...' : 'Publish AI Result'}
                        </button>
                      </div>
                    </div>

                    <div className="space-y-2">
                      <h5 className="font-semibold">Scoring Reconciliation</h5>
                      <p className="text-xs text-white/60">Apply if resolution is invalid or ambiguous.</p>
                      <label className="text-xs text-white/60 block">
                        Policy
                        <select
                          value={reconcilePolicy}
                          onChange={(e) => setReconcilePolicy(e.target.value)}
                          className="mt-1 w-full rounded-lg bg-white/10 border border-white/20 px-2 py-1 text-sm"
                        >
                          <option value="void" className="bg-gray-800 text-white">Void question – remove from scoring</option>
                          <option value="award_all" className="bg-gray-800 text-white">Award all – give points to everyone</option>
                          <option value="accept_multiple" className="bg-gray-800 text-white">Accept multiple answers</option>
                        </select>
                      </label>
                      {reconcilePolicy === 'accept_multiple' && (
                        <label className="text-xs text-white/60 block">
                          Accepted answers (comma-separated indices)
                          <input
                            value={reconcileAnswers}
                            onChange={(e) => setReconcileAnswers(e.target.value)}
                            className="mt-1 w-full rounded-lg bg-white/10 border border-white/20 px-2 py-1 text-sm"
                            placeholder="e.g. 0,2"
                          />
                        </label>
                      )}
                      <button
                        onClick={handleReconcile}
                        className="px-3 py-2 rounded-lg bg-amber-500/20 border border-amber-500/40 text-sm hover:bg-amber-500/30"
                      >
                        Apply Reconciliation
                      </button>
                      {challengeDetail.reconciliation && (
                        <div className="text-xs text-white/60">
                          Applied policy: {challengeDetail.reconciliation.policy}
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>
            </>
          )}
        </div>
      )}
    </div>
  )
}
