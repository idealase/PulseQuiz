import { useState, useEffect, useRef, useCallback } from 'react'
import { useParams, useNavigate, Link } from 'react-router-dom'
import { useConfig } from '../context/ConfigContext'
import { useTheme } from '../context/ThemeContext'
import { ApiClient, createSmartConnection } from '../api/client'
import { SessionState, ServerMessage, RevealResults, QuestionResult, ChallengeThread } from '../types'
import { useSessionLeaveGuard } from '../hooks/useSessionLeaveGuard'

export default function PlayerSession() {
  const { code } = useParams<{ code: string }>()
  const config = useConfig()
  const navigate = useNavigate()
  const { applyTheme } = useTheme()
  
  const [session, setSession] = useState<SessionState | null>(null)
  const [results, setResults] = useState<RevealResults | null>(null)
  const [myResults, setMyResults] = useState<QuestionResult[] | null>(null)
  const [selectedAnswer, setSelectedAnswer] = useState<number | null>(null)
  const [answerLocked, setAnswerLocked] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [connectionMode, setConnectionMode] = useState<'websocket' | 'polling' | null>(null)
  const connectionRef = useRef<{ send: (data: unknown) => void; close: () => void } | null>(null)
  
  // New state for enhanced features
  const [timerRemaining, setTimerRemaining] = useState<number | null>(null)
  const [myRank, setMyRank] = useState<number | null>(null)

  // Challenge state
  const [challengeForm, setChallengeForm] = useState<{ questionIndex: number; source: 'review' | 'mid_game' } | null>(null)
  const [challengeCategory, setChallengeCategory] = useState('')
  const [challengeNote, setChallengeNote] = useState('')
  const [challengeSubmitting, setChallengeSubmitting] = useState(false)
  const [challengedQuestions, setChallengedQuestions] = useState<Set<number>>(new Set())
  const [challengeMessage, setChallengeMessage] = useState<string | null>(null)
  
  // Challenge badges visible to all players: questionIndex -> { count, status, latestNote, latestNickname }
  const [challengeBadges, setChallengeBadges] = useState<Record<number, { count: number; status: string; latestNickname?: string; latestNote?: string }>>({})
  
  // Thread conversation state
  const [threadOpen, setThreadOpen] = useState<number | null>(null) // questionIndex of open thread
  const [threadData, setThreadData] = useState<ChallengeThread | null>(null)
  const [threadLoading, setThreadLoading] = useState(false)
  const [replyText, setReplyText] = useState('')
  const [replySubmitting, setReplySubmitting] = useState(false)

  // Track when question was shown for response time measurement
  const questionShownAtRef = useRef<number>(Date.now())
  
  const playerId = sessionStorage.getItem(`player_${code}`)
  const nickname = sessionStorage.getItem(`nickname_${code}`)
  const api = new ApiClient(config.apiBaseUrl)
  const shouldGuard = Boolean(session && code && playerId)

  useSessionLeaveGuard(shouldGuard, 'You have an active session. Leaving will end your participation. Continue?')

  const challengeCategories = ['Incorrect answer', 'Ambiguous', 'Multiple valid', 'Outdated', 'Other']

  const loadMyChallenges = async () => {
    if (!code || !playerId) return
    try {
      const response = await api.getMyChallenges(code, playerId)
      setChallengedQuestions(new Set(response.questionIndexes))
    } catch {
      // Ignore challenge list failures to avoid blocking play
    }
  }

  const submitChallenge = async (questionIndex: number, source: 'review' | 'mid_game') => {
    if (!code || !playerId) return
    setChallengeSubmitting(true)
    setChallengeMessage(null)
    try {
      await api.submitChallenge(code, playerId, questionIndex, challengeNote.trim() || undefined, challengeCategory || undefined, source)
      setChallengedQuestions(prev => new Set([...prev, questionIndex]))
      setChallengeMessage('Challenge submitted')
      setChallengeForm(null)
      setChallengeCategory('')
      setChallengeNote('')
    } catch (e) {
      setChallengeMessage(e instanceof Error ? e.message : 'Failed to submit challenge')
    }
    setChallengeSubmitting(false)
  }

  const openThread = useCallback(async (questionIndex: number) => {
    if (!code || !playerId) return
    setThreadOpen(questionIndex)
    setThreadLoading(true)
    setReplyText('')
    try {
      const data = await api.getChallengeThread(code, questionIndex, playerId)
      setThreadData(data)
    } catch {
      setThreadData(null)
    }
    setThreadLoading(false)
  }, [code, playerId, api])

  const submitReply = async () => {
    if (!code || !playerId || threadOpen === null || !replyText.trim()) return
    setReplySubmitting(true)
    try {
      await api.replyToChallenge(code, playerId, threadOpen, replyText.trim())
      setReplyText('')
      // Refresh thread
      const data = await api.getChallengeThread(code, threadOpen, playerId)
      setThreadData(data)
    } catch {
      // silent
    }
    setReplySubmitting(false)
  }

  const handleVote = async (questionIndex: number, challengePlayerId: string, vote: number) => {
    if (!code || !playerId) return
    try {
      await api.voteOnChallenge(code, playerId, questionIndex, challengePlayerId, vote)
      // Refresh thread
      const data = await api.getChallengeThread(code, questionIndex, playerId)
      setThreadData(data)
    } catch {
      // silent
    }
  }

  useEffect(() => {
    loadMyChallenges()
  }, [code, playerId])

  useEffect(() => {
    if (!code || !playerId) {
      navigate(`/join/${code || ''}`)
      return
    }

    const handleMessage = (msg: ServerMessage) => {
      switch (msg.type) {
        case 'session_state':
          setSession(msg.state)
          if (msg.state.timerRemaining !== undefined) {
            setTimerRemaining(msg.state.timerRemaining)
          }
          // Apply host theme if present
          if (msg.state.theme) {
            applyTheme(msg.state.theme, false)
          }
          // Restore reveal results on reconnect
          if (msg.state.revealResults) {
            setResults(msg.state.revealResults as RevealResults)
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
        case 'theme_updated':
          applyTheme(msg.theme, false)
          break
        case 'question_started':
          setSession(prev => prev ? {
            ...prev,
            status: 'playing',
            currentQuestionIndex: msg.questionIndex
          } : null)
          // Reset answer state for new question
          setSelectedAnswer(null)
          setAnswerLocked(false)
          setChallengeForm(null)
          setChallengeCategory('')
          setChallengeNote('')
          // Record when this question was shown
          questionShownAtRef.current = Date.now()
          break
        case 'revealed':
          setSession(prev => prev ? { ...prev, status: 'revealed' } : null)
          setResults(msg.results)
          setTimerRemaining(null)
          // Find my results
          const myPlayer = msg.results.players.find(p => p.id === playerId)
          if (myPlayer) {
            // We need to compute individual answers from the results
            setMyResults(msg.results.questions)
          }
          loadMyChallenges()
          break
        case 'timer_tick':
          setTimerRemaining(msg.remaining)
          // Auto-lock if timer expired and answer not locked
          if (msg.remaining === 0 && !answerLocked && selectedAnswer !== null) {
            // Auto-submit the selected answer
            handleAutoSubmit()
          }
          break
        case 'leaderboard_update':
          // Update my rank from leaderboard
          const myEntry = msg.leaderboard.find(e => e.id === playerId)
          if (myEntry) {
            setMyRank(myEntry.rank)
          }
          setResults(prev => prev ? {
            ...prev,
            players: prev.players.map(p => {
              const entry = msg.leaderboard.find(e => e.id === p.id)
              return entry ? { ...p, score: entry.score, rank: entry.rank } : p
            })
          } : prev)
          break
        case 'challenge_resolution':
          setMyResults(prev => prev ? prev.map((q, index) => index === msg.questionIndex ? {
            ...q,
            challengeStatus: msg.resolution.status,
            resolutionVerdict: msg.resolution.verdict,
            resolutionNote: msg.resolution.resolutionNote
          } : q) : prev)
          // Update thread data if the discussion modal is open for this question
          setThreadData(prev => prev && prev.questionIndex === msg.questionIndex
            ? { ...prev, resolution: msg.resolution, status: msg.resolution.status }
            : prev)
          break
        case 'challenge_ai_published':
          setMyResults(prev => prev ? prev.map((q, index) => index === msg.questionIndex ? {
            ...q,
            aiVerdict: msg.aiVerification.verdict,
            aiConfidence: msg.aiVerification.confidence,
            aiRationale: msg.aiVerification.rationale,
            aiSuggestedCorrection: msg.aiVerification.suggested_correction
          } : q) : prev)
          // Update thread data if the discussion modal is open for this question
          setThreadData(prev => prev && prev.questionIndex === msg.questionIndex
            ? { ...prev, aiVerification: msg.aiVerification }
            : prev)
          break
        case 'scores_reconciled':
          setMyResults(prev => prev ? prev.map((q, index) => index === msg.questionIndex ? {
            ...q,
            scoringPolicy: msg.policy.policy,
            acceptedAnswers: msg.policy.acceptedAnswers
          } : q) : prev)
          break
        case 'challenge_updated':
          // All players now receive challenge updates — track badges
          setChallengeBadges(prev => ({
            ...prev,
            [msg.questionIndex]: {
              count: msg.count,
              status: msg.status,
              latestNickname: msg.latestSubmission?.nickname,
              latestNote: msg.latestSubmission?.note,
            }
          }))
          break
        case 'challenge_reply':
          // If the thread is open for this question, append the reply  
          setThreadData(prev => {
            if (!prev || prev.questionIndex !== msg.questionIndex) return prev
            // Add the reply to the first thread entry's replies
            const updatedThread = prev.thread.map((entry, idx) => 
              idx === 0 ? { ...entry, replies: [...entry.replies, msg.reply] } : entry
            )
            return { ...prev, thread: updatedThread }
          })
          break
        case 'error':
          setError(msg.message)
          break
      }
    }

    const handleAutoSubmit = async () => {
      if (selectedAnswer === null || !code || !playerId || !session) return
      setAnswerLocked(true)
      const responseTimeMs = Date.now() - questionShownAtRef.current
      try {
        await api.submitAnswer(code, playerId, session.currentQuestionIndex, selectedAnswer, responseTimeMs)
      } catch {
        // Silent fail on auto-submit
      }
    }

    setError(null)
    const connection = createSmartConnection(
      api,
      code,
      { playerId },
      (data) => handleMessage(data as ServerMessage),
      (err) => setError(err.message),
      (mode) => setConnectionMode(mode)
    )
    connectionRef.current = connection

    return () => {
      connection.close()
    }
  }, [code, playerId, config.apiBaseUrl])

  const handleSelectAnswer = (choice: number) => {
    if (answerLocked) return
    // Don't allow selection if timer has expired
    if (session?.settings?.timerMode && timerRemaining === 0) return
    setSelectedAnswer(choice)
  }

  const handleConfirmAnswer = async () => {
    if (selectedAnswer === null || !code || !playerId || !session) return
    
    setAnswerLocked(true)
    const responseTimeMs = Date.now() - questionShownAtRef.current
    try {
      await api.submitAnswer(code, playerId, session.currentQuestionIndex, selectedAnswer, responseTimeMs)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to submit answer')
      setAnswerLocked(false)
    }
  }

  if (!session) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center">
        <div className="animate-pulse text-xl mb-4">Connecting...</div>
        <p className="text-white/60">{nickname}</p>
      </div>
    )
  }

  const currentQuestion = session.status === 'playing' && session.questions[session.currentQuestionIndex]
  const myScore = results?.players.find(p => p.id === playerId)

  // Helper to get ordinal suffix
  const getOrdinal = (n: number) => {
    const s = ['th', 'st', 'nd', 'rd']
    const v = n % 100
    return n + (s[(v - 20) % 10] || s[v] || s[0])
  }

  // Option colors for visual variety
  const optionColors = [
    'bg-red-900/40',
    'bg-blue-900/40',
    'bg-amber-900/40',
    'bg-emerald-900/40',
  ]

  return (
    <div className="h-[100dvh] p-4 sm:p-5 max-w-2xl mx-auto flex flex-col overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between mb-3 sm:mb-4">
        <div>
          <span className="text-white/60 text-sm">Playing as</span>
          <p className="font-bold">{nickname}</p>
          {/* Show current rank during play */}
          {session.status === 'playing' && myRank !== null && (
            <p className="text-sm text-white/70">
              {getOrdinal(myRank)} place
            </p>
          )}
        </div>
        <div className="text-right flex items-center gap-4">
          {/* Timer */}
          {session.status === 'playing' && session.settings?.timerMode && timerRemaining !== null && (
            <div className={`w-12 h-12 rounded-full flex items-center justify-center font-bold text-lg ${
              timerRemaining <= 5 ? 'bg-red-900/30 text-red-300/80 animate-pulse' :
              timerRemaining <= 10 ? 'bg-amber-900/30 text-amber-300/70' :
              'bg-white/10'
            }`}>
              {timerRemaining}
            </div>
          )}
          {session.status === 'playing' && (
            <div>
              <span className="text-white/60 text-sm">Question</span>
              <p className="font-bold">{session.currentQuestionIndex + 1} / {session.questions.length}</p>
            </div>
          )}
        </div>
      </div>

      {/* Connection mode indicator */}
      {connectionMode === 'polling' && (
        <div className="mb-4 p-2 bg-amber-900/20 border border-amber-800/30 rounded-lg text-amber-300/70 text-sm text-center">
          Corporate network mode
        </div>
      )}

      {error && (
        <div className="mb-4 p-4 bg-red-900/20 border border-red-800/30 rounded-lg text-red-300/80">
          {error}
          <button onClick={() => setError(null)} className="ml-2 underline">dismiss</button>
        </div>
      )}

      {challengeMessage && (
        <div className="mb-4 p-3 bg-white/10 border border-white/20 rounded-lg text-white/80 text-sm">
          {challengeMessage}
          <button onClick={() => setChallengeMessage(null)} className="ml-2 underline">dismiss</button>
        </div>
      )}

      {/* Lobby State */}
      {session.status === 'lobby' && (
        <div className="flex-1 flex flex-col items-center justify-center animate-slide-up">
          <div className="animate-pulse-glow w-24 h-24 rounded-full bg-slate-600/30 flex items-center justify-center mb-6">
            <span className="w-4 h-4 rounded-full border-2 border-white/20 border-t-white/60 animate-spin"></span>
          </div>
          <h2 className="text-2xl font-bold mb-2">Waiting for host</h2>
          <p className="text-white/60">Get ready!</p>
          <p className="mt-4 text-white/40 text-sm">
            {session.players.length} player{session.players.length !== 1 ? 's' : ''} joined
          </p>
        </div>
      )}

      {/* Playing State */}
      {session.status === 'playing' && currentQuestion && (
        <div className="flex-1 flex flex-col min-h-0 animate-slide-up">
          {/* Timer expired warning */}
          {session.settings?.timerMode && timerRemaining === 0 && !answerLocked && (
            <div className="mb-2 p-2 bg-red-900/20 border border-red-800/30 rounded-xl text-red-300/80 text-center animate-pulse text-sm">
              Time's up!
            </div>
          )}

          {/* Question */}
          <div className="bg-white/10 rounded-xl p-3 sm:p-4 mb-2 shrink-0">
            <h2 className="text-base sm:text-lg md:text-xl font-bold text-center line-clamp-3">
              {currentQuestion.question}
            </h2>
          </div>

          <div className="flex items-center justify-between mb-2">
            <button
              onClick={() => setChallengeForm({ questionIndex: session.currentQuestionIndex, source: 'mid_game' })}
              disabled={challengedQuestions.has(session.currentQuestionIndex)}
              className="text-xs px-2 py-1 rounded-lg bg-white/10 border border-white/20 hover:bg-white/20 disabled:opacity-50"
            >
              {challengedQuestions.has(session.currentQuestionIndex) ? 'Flagged' : 'Flag / Challenge'}
            </button>
            {/* Live challenge badge — shows when other players have challenged this question */}
            {challengeBadges[session.currentQuestionIndex] && challengeBadges[session.currentQuestionIndex].count > 0 && (
              <div className="flex items-center gap-1.5 text-xs px-2 py-1 rounded-lg bg-amber-900/15 border border-amber-700/30 text-orange-300 animate-[fadeIn_0.5s_ease-in-out]">
                <span>{challengeBadges[session.currentQuestionIndex].count} challenged</span>
              </div>
            )}
          </div>

          {challengeForm?.source === 'mid_game' && challengeForm.questionIndex === session.currentQuestionIndex && (
            <div className="mb-2 p-3 rounded-xl bg-white/5 border border-white/10">
              <div className="text-xs text-white/60 mb-2">Quick flag (optional note)</div>
              <select
                value={challengeCategory}
                onChange={(e) => setChallengeCategory(e.target.value)}
                className="w-full mb-2 rounded-lg bg-white text-gray-900 border border-white/20 px-2 py-1 text-sm"
              >
                <option value="">Select a category (optional)</option>
                {challengeCategories.map(category => (
                  <option key={category} value={category}>{category}</option>
                ))}
              </select>
              <textarea
                value={challengeNote}
                onChange={(e) => setChallengeNote(e.target.value)}
                className="w-full rounded-lg bg-white/10 border border-white/20 px-2 py-1 text-sm"
                rows={2}
                placeholder="Short note (optional)"
              />
              <div className="mt-2 flex gap-2">
                <button
                  onClick={() => submitChallenge(session.currentQuestionIndex, 'mid_game')}
                  disabled={challengeSubmitting}
                  className="flex-1 px-3 py-2 rounded-lg bg-white/10 border border-white/20 text-sm hover:bg-white/20 disabled:opacity-50"
                >
                  {challengeSubmitting ? 'Submitting...' : 'Submit Flag'}
                </button>
                <button
                  onClick={() => setChallengeForm(null)}
                  className="px-3 py-2 rounded-lg bg-white/5 text-sm"
                >
                  Cancel
                </button>
              </div>
            </div>
          )}

          {/* Options */}
          <div className="flex-1 grid grid-cols-1 sm:grid-cols-2 gap-2 sm:gap-3 min-h-0 auto-rows-fr">
            {currentQuestion.options.map((opt, i) => {
              const timerExpired = session.settings?.timerMode && timerRemaining === 0
              const isDisabled = answerLocked || timerExpired
              
              return (
                <button
                  key={i}
                  onClick={() => handleSelectAnswer(i)}
                  disabled={isDisabled}
                  className={`px-4 py-3 rounded-xl text-left text-base font-medium leading-snug transition-all active:scale-[0.98] flex items-center ${
                    isDisabled 
                      ? selectedAnswer === i 
                        ? `${optionColors[i]} opacity-100`
                        : 'bg-white/5 opacity-50'
                      : selectedAnswer === i
                        ? `${optionColors[i]} ring-2 ring-white/30`
                        : `${optionColors[i]} opacity-80 hover:opacity-100`
                  }`}
                >
                  <span className="font-bold mr-2 shrink-0 text-lg">{String.fromCharCode(65 + i)}.</span>
                  <span className="line-clamp-2 md:line-clamp-3">{opt}</span>
                </button>
              )
            })}
          </div>

          {/* Confirm Button */}
          {!answerLocked && !(session.settings?.timerMode && timerRemaining === 0) ? (
            <button
              onClick={handleConfirmAnswer}
              disabled={selectedAnswer === null}
              className="mt-3 py-3 sm:py-3.5 text-lg sm:text-xl font-semibold rounded-xl bg-white text-gray-900 disabled:opacity-30 disabled:cursor-not-allowed transition-all shrink-0"
            >
              Lock In Answer
            </button>
          ) : answerLocked ? (
            <div className="mt-3 py-3 sm:py-3.5 text-lg sm:text-xl font-bold text-center rounded-xl bg-green-500/20 border border-green-500 shrink-0">
              ✓ Answer Locked
            </div>
          ) : (
            <div className="mt-3 py-3 sm:py-3.5 text-lg sm:text-xl font-bold text-center rounded-xl bg-red-900/20 border border-red-800/30 text-red-300/80 shrink-0">
              Time Expired
            </div>
          )}
        </div>
      )}

      {/* Revealed State */}
      {session.status === 'revealed' && results && (
        <div className="flex-1 animate-slide-up overflow-y-auto min-h-0">
          {/* My Score */}
          {myScore && (
            <div className="bg-slate-700/60 border border-slate-600/40 rounded-xl p-6 text-center mb-6">
              <p className="text-white/80 mb-1">Your Score</p>
              <p className="text-5xl font-black">{myScore.score}</p>
              <p className="mt-2 text-xl">
                {myScore.rank === 1 ? '1st Place!' :
                 myScore.rank === 2 ? '2nd Place!' :
                 myScore.rank === 3 ? '3rd Place!' :
                 `${myScore.rank}th Place`}
              </p>
              <p className="text-white/60 text-sm mt-1">
                Total time: {myScore.totalTime.toFixed(1)}s
              </p>
            </div>
          )}

          {/* Leaderboard */}
          <div className="bg-white/10 rounded-xl overflow-hidden mb-6">
            <h3 className="p-4 font-bold border-b border-white/10">Leaderboard</h3>
            {results.players.slice(0, 5).map((p, i) => (
              <div 
                key={p.id}
                className={`flex items-center p-3 ${i > 0 ? 'border-t border-white/10' : ''} ${
                  p.id === playerId ? 'bg-primary/20' : ''
                }`}
              >
                <span className={`w-8 h-8 rounded-full flex items-center justify-center font-bold mr-3 text-sm ${
                  i === 0 ? 'bg-amber-700/60 text-amber-100' :
                  i === 1 ? 'bg-slate-500/50 text-slate-200' :
                  i === 2 ? 'bg-amber-800/40 text-amber-200' :
                  'bg-white/20'
                }`}>
                  {p.rank}
                </span>
                <div className="flex-1 truncate">
                  <span>{p.nickname}</span>
                  <span className="text-white/40 text-xs ml-1">{p.totalTime.toFixed(1)}s</span>
                </div>
                <span className="font-bold">{p.score}</span>
              </div>
            ))}
          </div>
          <p className="text-center text-white/40 text-xs mb-4">
            Ties broken by fastest total answer time
          </p>

          {/* Post-Game Actions */}
          <div className="flex gap-3 mb-6">
            <Link
              to="/join"
              className="flex-1 py-3 text-center font-semibold rounded-xl bg-slate-600/60 border border-slate-500/40 hover:bg-slate-600/80 transition-all"
            >
              Join New Game
            </Link>
            <Link
              to="/"
              className="flex-1 py-3 text-center font-semibold rounded-xl bg-white/10 border border-white/30 hover:bg-white/20 transition-all"
            >
              Home
            </Link>
          </div>

          {/* Question Review */}
          <div className="space-y-3">
            <h3 className="font-bold">Your Answers</h3>
            {myResults?.map((q, i) => (
              <div key={i} className={`rounded-xl p-4 ${
                q.yourAnswer != null
                  ? (q.answeredCorrectly ? 'bg-green-500/20' : 'bg-red-500/20')
                  : 'bg-white/5 border border-white/10'
              }`}>
                <p className="text-sm text-white/80 mb-1">Q{i + 1}. {q.question}</p>
                <div className="flex items-center gap-2 text-sm">
                  {q.yourAnswer != null ? (
                    <>
                      <span className={q.answeredCorrectly ? 'text-green-400' : 'text-red-400'}>
                        Your answer: {String.fromCharCode(65 + q.yourAnswer)}
                      </span>
                      {!q.answeredCorrectly && (
                        <span className="text-green-400">
                          • Correct: {String.fromCharCode(65 + q.correct)}
                        </span>
                      )}
                    </>
                  ) : (
                    <span className="text-white/50">Not answered • Correct: {String.fromCharCode(65 + q.correct)}</span>
                  )}
                </div>
                <div className="mt-2 space-y-1 text-sm text-white/70">
                  {q.options.map((option, idx) => (
                    <div key={idx} className={idx === q.correct ? 'text-green-300' : ''}>
                      {String.fromCharCode(65 + idx)}. {option}{idx === q.correct ? ' ✓' : ''}
                    </div>
                  ))}
                </div>
                {q.explanation && (
                  <p className="text-white/60 text-sm mt-2 italic">
                    {q.explanation}
                  </p>
                )}

                {/* Challenge badge — visible to ALL players when anyone has challenged this question */}
                {(() => {
                  const badge = challengeBadges[i]
                  if (!badge && !q.challengeStatus) return null
                  const count = badge?.count || 0
                  const status = q.challengeStatus || badge?.status || 'open'
                  const statusLabel = status.replace(/_/g, ' ')
                  const isUnderReview = status === 'under_review'
                  const isResolved = status === 'resolved'
                  const badgeBg = isResolved ? 'bg-green-500/15 border-green-400/30' : isUnderReview ? 'bg-amber-900/15 border-amber-700/30' : 'bg-amber-900/15 border-amber-700/30'
                  const badgeIcon = isResolved ? '✅' : ''

                  return (
                    <div className={`mt-3 rounded-xl border p-3 ${badgeBg} animate-[fadeIn_0.5s_ease-in-out]`}>
                      {/* Badge header */}
                      <div className="flex items-center gap-2">
                        {badgeIcon && <span className="text-lg">{badgeIcon}</span>}
                        <span className="font-bold text-sm uppercase tracking-wide text-white/90">
                          Challenge {statusLabel}
                        </span>
                        {count > 0 && (
                          <span className="text-xs px-2 py-0.5 rounded-full bg-white/15 text-white/70">
                            {count} {count === 1 ? 'challenge' : 'challenges'}
                          </span>
                        )}
                        {q.resolutionVerdict && (() => {
                          const isValid = q.resolutionVerdict?.toLowerCase().includes('valid') && !q.resolutionVerdict?.toLowerCase().includes('invalid')
                          const isInvalid = q.resolutionVerdict?.toLowerCase().includes('invalid')
                          return (
                            <span className={`ml-auto text-xs font-semibold px-2.5 py-0.5 rounded-full ${
                              isValid ? 'bg-green-500/25 text-green-200' : isInvalid ? 'bg-red-500/25 text-red-200' : 'bg-yellow-500/25 text-yellow-200'
                            }`}>
                              {q.resolutionVerdict}
                            </span>
                          )
                        })()}
                      </div>

                      {/* Latest challenge preview */}
                      {badge?.latestNickname && (
                        <p className="text-xs text-white/60 mt-1.5 pl-7">
                          <span className="font-medium text-white/80">{badge.latestNickname}</span>
                          {badge.latestNote ? `: "${badge.latestNote}"` : ' challenged this question'}
                        </p>
                      )}

                      {/* Resolution note */}
                      {q.resolutionNote && (
                        <p className="text-sm text-white/80 mt-2 pl-7 italic">
                          "{q.resolutionNote}"
                        </p>
                      )}

                      {/* AI verification */}
                      {q.aiVerdict && (
                        <div className="mt-3 pt-3 border-t border-white/10 pl-7">
                          <div className="flex items-center gap-2 mb-1">
                            <span className="text-xs font-semibold text-white/90 uppercase tracking-wide">AI Verification</span>
                            <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${
                              q.aiVerdict === 'valid' ? 'bg-green-500/25 text-green-200' : 'bg-red-500/25 text-red-200'
                            }`}>
                              {q.aiVerdict} &middot; {Math.round((q.aiConfidence ?? 0) * 100)}%
                            </span>
                          </div>
                          {q.aiRationale && (
                            <p className="text-xs text-white/60 mt-1 leading-relaxed">{q.aiRationale}</p>
                          )}
                        </div>
                      )}

                      {/* Scoring policy */}
                      {q.scoringPolicy && (
                        <div className="mt-3 pt-3 border-t border-white/10 pl-7">
                          <div className="flex items-center gap-2">
                            <span className="text-xs font-semibold text-white/90 uppercase tracking-wide">Scoring</span>
                            <span className="text-xs text-white/70">{q.scoringPolicy}</span>
                            {q.acceptedAnswers && q.acceptedAnswers.length > 0 && (
                              <span className="text-xs text-white/50">(accepted: {q.acceptedAnswers.map(a => String.fromCharCode(65 + a)).join(', ')})</span>
                            )}
                          </div>
                        </div>
                      )}

                      {/* View Thread button */}
                      <button
                        onClick={() => openThread(i)}
                        className="mt-3 w-full text-xs py-2 rounded-lg bg-white/10 border border-white/20 hover:bg-white/20 transition-all flex items-center justify-center gap-1.5"
                      >
                        View Discussion Thread
                      </button>
                    </div>
                  )
                })()}

                {!q.challengeStatus && !challengeBadges[i] && q.scoringPolicy && (
                  <div className="mt-1 text-xs text-white/60">
                    Scoring policy: {q.scoringPolicy}
                    {q.acceptedAnswers && q.acceptedAnswers.length > 0 && (
                      <span> (accepted: {q.acceptedAnswers.join(', ')})</span>
                    )}
                  </div>
                )}

                {!q.challengeStatus && !challengeBadges[i] && q.aiVerdict && (
                  <div className="mt-2 text-xs text-white/60">
                    AI: {q.aiVerdict} ({Math.round((q.aiConfidence ?? 0) * 100)}%)
                    {q.aiRationale && <span className="block mt-1">{q.aiRationale}</span>}
                  </div>
                )}

                <div className="mt-3 flex items-center gap-2">
                  <button
                    onClick={() => setChallengeForm({ questionIndex: i, source: 'review' })}
                    disabled={challengedQuestions.has(i)}
                    className="text-xs px-3 py-1.5 rounded-lg bg-white/10 border border-white/20 hover:bg-white/20 disabled:opacity-50"
                  >
                    {challengedQuestions.has(i) ? 'Challenge submitted' : 'Challenge this question'}
                  </button>
                  {challengeBadges[i] && challengeBadges[i].count > 0 && (
                    <button
                      onClick={() => openThread(i)}
                      className="text-xs px-3 py-1.5 rounded-lg bg-white/10 border border-white/20 hover:bg-white/20"
                    >
                      {challengeBadges[i].count} discussion{challengeBadges[i].count !== 1 ? 's' : ''}
                    </button>
                  )}
                </div>

                {challengeForm?.source === 'review' && challengeForm.questionIndex === i && (
                  <div className="mt-2 p-3 rounded-xl bg-white/5 border border-white/10">
                    <select
                      value={challengeCategory}
                      onChange={(e) => setChallengeCategory(e.target.value)}
                      className="w-full mb-2 rounded-lg bg-white text-gray-900 border border-white/20 px-2 py-1 text-sm"
                    >
                      <option value="">Select a category (optional)</option>
                      {challengeCategories.map(category => (
                        <option key={category} value={category}>{category}</option>
                      ))}
                    </select>
                    <textarea
                      value={challengeNote}
                      onChange={(e) => setChallengeNote(e.target.value)}
                      className="w-full rounded-lg bg-white/10 border border-white/20 px-2 py-1 text-sm"
                      rows={2}
                      placeholder="Optional feedback"
                    />
                    <div className="mt-2 flex gap-2">
                      <button
                        onClick={() => submitChallenge(i, 'review')}
                        disabled={challengeSubmitting}
                        className="flex-1 px-3 py-2 rounded-lg bg-white/10 border border-white/20 text-sm hover:bg-white/20 disabled:opacity-50"
                      >
                        {challengeSubmitting ? 'Submitting...' : 'Submit Challenge'}
                      </button>
                      <button
                        onClick={() => setChallengeForm(null)}
                        className="px-3 py-2 rounded-lg bg-white/5 text-sm"
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                )}


              </div>
            ))}
          </div>
        </div>
      )}

      {/* Challenge Thread Modal */}
      {threadOpen !== null && (
        <div className="fixed inset-0 z-50 bg-black/70 flex items-end sm:items-center justify-center p-0 sm:p-4">
          <div className="bg-gray-900 border border-white/20 rounded-t-xl sm:rounded-xl w-full sm:max-w-lg max-h-[85vh] flex flex-col animate-slide-up">
            {/* Thread header */}
            <div className="flex items-center justify-between p-4 border-b border-white/10 shrink-0">
              <div>
                <h3 className="font-bold text-base">Challenge Discussion</h3>
                <p className="text-xs text-white/50">
                  Q{threadOpen + 1}{threadData ? ` — ${threadData.status.replace(/_/g, ' ')}` : ''}
                </p>
              </div>
              <button
                onClick={() => { setThreadOpen(null); setThreadData(null) }}
                className="w-8 h-8 rounded-full bg-white/10 flex items-center justify-center hover:bg-white/20"
              >
                ✕
              </button>
            </div>

            {/* Thread content */}
            <div className="flex-1 overflow-y-auto p-4 space-y-3 min-h-0">
              {threadLoading && (
                <div className="text-center text-white/50 py-8 animate-pulse">Loading thread...</div>
              )}

              {!threadLoading && threadData && threadData.thread.length === 0 && (
                <div className="text-center text-white/50 py-8">No challenges yet for this question.</div>
              )}

              {!threadLoading && threadData && threadData.thread.map((entry, idx) => (
                <div key={idx} className="rounded-xl bg-white/5 border border-white/10 p-3">
                  {/* Challenge submission */}
                  <div className="flex items-start gap-2">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-semibold text-sm text-white/90">{entry.nickname}</span>
                        {entry.category && (
                          <span className="text-xs px-2 py-0.5 rounded-full bg-orange-500/20 text-orange-300">{entry.category}</span>
                        )}
                        <span className="text-xs text-white/40 ml-auto shrink-0">
                          {new Date(entry.createdAt * 1000).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </span>
                      </div>
                      {entry.note && (
                        <p className="text-sm text-white/70 mt-1">{entry.note}</p>
                      )}
                      {!entry.note && (
                        <p className="text-sm text-white/50 mt-1 italic">Challenged without comment</p>
                      )}

                      {/* Vote buttons */}
                      <div className="flex items-center gap-3 mt-2">
                        <button
                          onClick={() => handleVote(threadOpen, entry.playerId, entry.myVote === 1 ? 0 : 1)}
                          className={`flex items-center gap-1 text-xs px-2 py-1 rounded-lg border transition-all ${
                            entry.myVote === 1
                              ? 'bg-green-500/20 border-green-400/40 text-green-300'
                              : 'bg-white/5 border-white/10 text-white/50 hover:bg-white/10'
                          }`}
                        >
                          Agree
                        </button>
                        <button
                          onClick={() => handleVote(threadOpen, entry.playerId, entry.myVote === -1 ? 0 : -1)}
                          className={`flex items-center gap-1 text-xs px-2 py-1 rounded-lg border transition-all ${
                            entry.myVote === -1
                              ? 'bg-red-500/20 border-red-400/40 text-red-300'
                              : 'bg-white/5 border-white/10 text-white/50 hover:bg-white/10'
                          }`}
                        >
                          Disagree
                        </button>
                        <span className={`text-xs font-medium ${
                          entry.voteScore > 0 ? 'text-green-400' : entry.voteScore < 0 ? 'text-red-400' : 'text-white/40'
                        }`}>
                          {entry.voteScore > 0 ? '+' : ''}{entry.voteScore}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Replies to this challenge */}
                  {entry.replies.length > 0 && (
                    <div className="mt-3 ml-6 space-y-2 border-l-2 border-white/10 pl-3">
                      {entry.replies.map((reply) => (
                        <div key={reply.replyId} className="text-sm">
                          <div className="flex items-center gap-2">
                            <span className="font-medium text-white/80">{reply.nickname}</span>
                            <span className="text-xs text-white/40">
                              {new Date(reply.createdAt * 1000).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                            </span>
                          </div>
                          <p className="text-white/60 mt-0.5">{reply.text}</p>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              ))}

              {/* AI Verification in thread */}
              {!threadLoading && threadData?.aiVerification && (
                <div className={`rounded-xl p-3 border ${
                  threadData.aiVerification.verdict === 'valid'
                    ? 'bg-green-500/10 border-green-400/30'
                    : threadData.aiVerification.verdict === 'invalid'
                    ? 'bg-red-500/10 border-red-400/30'
                    : 'bg-amber-500/10 border-amber-400/30'
                }`}>
                  <div className="flex items-center gap-2 mb-1">
                    <span className="font-bold text-xs text-white/90 uppercase tracking-wide">AI Verification</span>
                    <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${
                      threadData.aiVerification.verdict === 'valid'
                        ? 'bg-green-500/25 text-green-200'
                        : threadData.aiVerification.verdict === 'invalid'
                        ? 'bg-red-500/25 text-red-200'
                        : 'bg-amber-500/25 text-amber-200'
                    }`}>
                      {threadData.aiVerification.verdict} &middot; {Math.round(threadData.aiVerification.confidence * 100)}%
                    </span>
                  </div>
                  {threadData.aiVerification.rationale && (
                    <p className="text-sm text-white/70 mt-1 pl-7 leading-relaxed">{threadData.aiVerification.rationale}</p>
                  )}
                  {threadData.aiVerification.suggested_correction && (
                    <p className="text-xs text-white/50 mt-1 pl-7 italic">Suggested: {threadData.aiVerification.suggested_correction}</p>
                  )}
                </div>
              )}

              {/* Resolution notice in thread */}
              {!threadLoading && threadData?.resolution && (
                <div className="rounded-xl bg-green-500/10 border border-green-400/30 p-3">
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-sm text-green-300 uppercase">
                      Resolution: {threadData.resolution.verdict || threadData.resolution.status.replace(/_/g, ' ')}
                    </span>
                  </div>
                  {threadData.resolution.resolutionNote && (
                    <p className="text-sm text-white/70 mt-1 pl-7 italic">"{threadData.resolution.resolutionNote}"</p>
                  )}
                </div>
              )}
            </div>

            {/* Reply input */}
            <div className="border-t border-white/10 p-3 shrink-0">
              <div className="flex gap-2">
                <input
                  type="text"
                  value={replyText}
                  onChange={(e) => setReplyText(e.target.value)}
                  onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); submitReply() } }}
                  placeholder="Add to the discussion..."
                  className="flex-1 rounded-lg bg-white/10 border border-white/20 px-3 py-2 text-sm placeholder-white/40 focus:outline-none focus:border-white/40"
                />
                <button
                  onClick={submitReply}
                  disabled={!replyText.trim() || replySubmitting}
                  className="px-4 py-2 rounded-lg bg-slate-600/60 hover:bg-slate-600/80 text-sm font-medium disabled:opacity-40 transition-all shrink-0"
                >
                  {replySubmitting ? '...' : 'Send'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
