import { useState, useEffect, useRef } from 'react'
import { useParams, useNavigate, Link } from 'react-router-dom'
import { useConfig } from '../context/ConfigContext'
import { ApiClient, createSmartConnection } from '../api/client'
import { SessionState, ServerMessage, RevealResults, QuestionResult } from '../types'

export default function PlayerSession() {
  const { code } = useParams<{ code: string }>()
  const config = useConfig()
  const navigate = useNavigate()
  
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
  
  const playerId = sessionStorage.getItem(`player_${code}`)
  const nickname = sessionStorage.getItem(`nickname_${code}`)
  const api = new ApiClient(config.apiBaseUrl)

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
          break
        case 'error':
          setError(msg.message)
          break
      }
    }

    const handleAutoSubmit = async () => {
      if (selectedAnswer === null || !code || !playerId || !session) return
      setAnswerLocked(true)
      try {
        await api.submitAnswer(code, playerId, session.currentQuestionIndex, selectedAnswer)
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
    try {
      await api.submitAnswer(code, playerId, session.currentQuestionIndex, selectedAnswer)
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
  const optionBackgrounds = [
    'bg-red-500',
    'bg-blue-500',
    'bg-yellow-500',
    'bg-green-500',
  ]

  return (
    <div className="h-[100dvh] p-4 max-w-lg mx-auto flex flex-col overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div>
          <span className="text-white/60 text-sm">Playing as</span>
          <p className="font-bold">{nickname}</p>
          {/* Show current rank during play */}
          {session.status === 'playing' && myRank !== null && (
            <p className="text-sm text-secondary">
              {myRank === 1 ? '🥇' : myRank === 2 ? '🥈' : myRank === 3 ? '🥉' : '📊'} {getOrdinal(myRank)} place
            </p>
          )}
        </div>
        <div className="text-right flex items-center gap-4">
          {/* Timer */}
          {session.status === 'playing' && session.settings?.timerMode && timerRemaining !== null && (
            <div className={`w-12 h-12 rounded-full flex items-center justify-center font-bold text-lg ${
              timerRemaining <= 5 ? 'bg-red-500/30 text-red-300 animate-pulse' :
              timerRemaining <= 10 ? 'bg-yellow-500/30 text-yellow-300' :
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
        <div className="mb-4 p-2 bg-yellow-500/20 border border-yellow-500/50 rounded-lg text-yellow-300 text-sm text-center">
          📡 Corporate network mode
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
        <div className="flex-1 flex flex-col items-center justify-center animate-slide-up">
          <div className="animate-pulse-glow w-24 h-24 rounded-full bg-primary/30 flex items-center justify-center mb-6">
            <span className="text-4xl">⏳</span>
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
            <div className="mb-2 p-2 bg-red-500/20 border border-red-500/50 rounded-xl text-red-300 text-center animate-pulse text-sm">
              ⏰ Time's up!
            </div>
          )}

          {/* Question */}
          <div className="bg-white/10 rounded-2xl p-3 mb-2 shrink-0">
            <h2 className="text-base md:text-xl font-bold text-center">
              {currentQuestion.question}
            </h2>
          </div>

          {/* Options */}
          <div className="flex-1 grid grid-cols-1 gap-2 min-h-0 auto-rows-fr">
            {currentQuestion.options.map((opt, i) => {
              const timerExpired = session.settings?.timerMode && timerRemaining === 0
              const isDisabled = answerLocked || timerExpired
              
              return (
                <button
                  key={i}
                  onClick={() => handleSelectAnswer(i)}
                  disabled={isDisabled}
                  className={`px-3 py-2 rounded-xl text-left text-sm font-medium transition-all active:scale-98 flex items-center ${
                    isDisabled 
                      ? selectedAnswer === i 
                        ? `${optionBackgrounds[i]} opacity-100`
                        : 'bg-white/5 opacity-50'
                      : selectedAnswer === i
                        ? `${optionBackgrounds[i]} ring-4 ring-white/50`
                        : `${optionBackgrounds[i]} opacity-80 hover:opacity-100`
                  }`}
                >
                  <span className="font-bold mr-2 shrink-0">{String.fromCharCode(65 + i)}.</span>
                  <span className="line-clamp-2">{opt}</span>
                </button>
              )
            })}
          </div>

          {/* Confirm Button */}
          {!answerLocked && !(session.settings?.timerMode && timerRemaining === 0) ? (
            <button
              onClick={handleConfirmAnswer}
              disabled={selectedAnswer === null}
              className="mt-2 py-3 text-lg font-bold rounded-2xl bg-white text-gray-900 disabled:opacity-30 disabled:cursor-not-allowed transition-all shrink-0"
            >
              Lock In Answer
            </button>
          ) : answerLocked ? (
            <div className="mt-2 py-3 text-lg font-bold text-center rounded-2xl bg-green-500/20 border-2 border-green-500 shrink-0">
              ✓ Answer Locked
            </div>
          ) : (
            <div className="mt-2 py-3 text-lg font-bold text-center rounded-2xl bg-red-500/20 border-2 border-red-500/50 text-red-300 shrink-0">
              ⏰ Time Expired
            </div>
          )}
        </div>
      )}

      {/* Revealed State */}
      {session.status === 'revealed' && results && (
        <div className="flex-1 animate-slide-up overflow-y-auto min-h-0">
          {/* My Score */}
          {myScore && (
            <div className="bg-primary rounded-2xl p-6 text-center mb-6">
              <p className="text-white/80 mb-1">Your Score</p>
              <p className="text-5xl font-black">{myScore.score}</p>
              <p className="mt-2 text-xl">
                {myScore.rank === 1 ? '🥇 1st Place!' :
                 myScore.rank === 2 ? '🥈 2nd Place!' :
                 myScore.rank === 3 ? '🥉 3rd Place!' :
                 `${myScore.rank}th Place`}
              </p>
              <p className="text-white/60 text-sm mt-1">
                Total time: {myScore.totalTime.toFixed(1)}s ⚡
              </p>
            </div>
          )}

          {/* Leaderboard */}
          <div className="bg-white/10 rounded-2xl overflow-hidden mb-6">
            <h3 className="p-4 font-bold border-b border-white/10">Leaderboard</h3>
            {results.players.slice(0, 5).map((p, i) => (
              <div 
                key={p.id}
                className={`flex items-center p-3 ${i > 0 ? 'border-t border-white/10' : ''} ${
                  p.id === playerId ? 'bg-primary/20' : ''
                }`}
              >
                <span className={`w-8 h-8 rounded-full flex items-center justify-center font-bold mr-3 text-sm ${
                  i === 0 ? 'bg-yellow-500 text-black' :
                  i === 1 ? 'bg-gray-300 text-black' :
                  i === 2 ? 'bg-amber-700 text-white' :
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
            Ties broken by fastest total answer time ⚡
          </p>

          {/* Post-Game Actions */}
          <div className="flex gap-3 mb-6">
            <Link
              to="/join"
              className="flex-1 py-3 text-center font-bold rounded-2xl bg-primary hover:bg-indigo-600 transition-all"
            >
              🎮 Join New Game
            </Link>
            <Link
              to="/"
              className="flex-1 py-3 text-center font-bold rounded-2xl bg-white/10 border border-white/30 hover:bg-white/20 transition-all"
            >
              🏠 Home
            </Link>
          </div>

          {/* Question Review */}
          <div className="space-y-3">
            <h3 className="font-bold">Your Answers</h3>
            {myResults?.map((q, i) => (
              <div key={i} className={`rounded-xl p-4 ${
                q.answeredCorrectly ? 'bg-green-500/20' : 'bg-red-500/20'
              }`}>
                <p className="text-sm text-white/80 mb-1">Q{i + 1}. {q.question}</p>
                <div className="flex items-center gap-2 text-sm">
                  {q.yourAnswer !== undefined ? (
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
                    <span className="text-white/50">Not answered</span>
                  )}
                </div>
                {q.explanation && (
                  <p className="text-white/60 text-sm mt-2 italic">
                    💡 {q.explanation}
                  </p>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
