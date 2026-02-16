import { useState, useEffect, useRef } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useConfig } from '../context/ConfigContext'
import { useTheme } from '../context/ThemeContext'
import { ApiClient, createSmartConnection } from '../api/client'
import { SessionState, ServerMessage, RevealResults, LiveLeaderboardEntry, QuestionStats } from '../types'
import { useSessionLeaveGuard } from '../hooks/useSessionLeaveGuard'

export default function AudienceSession() {
  const { code } = useParams<{ code: string }>()
  const config = useConfig()
  const navigate = useNavigate()
  const { applyTheme } = useTheme()
  
  const [session, setSession] = useState<SessionState | null>(null)
  const [results, setResults] = useState<RevealResults | null>(null)
  const [leaderboard, setLeaderboard] = useState<LiveLeaderboardEntry[]>([])
  const [questionStats, setQuestionStats] = useState<QuestionStats | null>(null)
  const [timerRemaining, setTimerRemaining] = useState<number | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [connectionMode, setConnectionMode] = useState<'websocket' | 'polling' | null>(null)
  const connectionRef = useRef<{ send: (data: unknown) => void; close: () => void } | null>(null)
  
  // Hide live stats to prevent players from gaming the system
  const [hideStats, setHideStats] = useState(() => localStorage.getItem('audience_hide_stats') === 'true')
  
  const observerId = sessionStorage.getItem(`observer_${code}`)
  const api = new ApiClient(config.apiBaseUrl)
  const shouldGuard = Boolean(session && code && observerId)

  useSessionLeaveGuard(shouldGuard, 'You have an active session. Leaving will end your participation. Continue?')

  useEffect(() => {
    if (!code || !observerId) {
      navigate(`/watch/${code || ''}`)
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
          // Handle initial leaderboard from session_state
          if ('leaderboard' in msg && Array.isArray(msg.leaderboard)) {
            setLeaderboard(msg.leaderboard as LiveLeaderboardEntry[])
          }
          // Handle initial stats from session_state
          if ('stats' in msg && msg.stats) {
            setQuestionStats(msg.stats as QuestionStats)
          }
          break
        case 'theme_updated':
          applyTheme(msg.theme, false)
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
        case 'question_started':
          setSession(prev => prev ? {
            ...prev,
            status: 'playing',
            currentQuestionIndex: msg.questionIndex
          } : null)
          // Reset stats for new question
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
        case 'error':
          setError(msg.message)
          break
      }
    }

    setError(null)
    const connection = createSmartConnection(
      api,
      code,
      { observerId },
      (data) => handleMessage(data as ServerMessage),
      (err) => setError(err.message),
      (mode) => setConnectionMode(mode)
    )
    connectionRef.current = connection

    return () => {
      connection.close()
    }
  }, [code, observerId, config.apiBaseUrl])

  if (!session) {
    return (
      <div className="min-h-[100dvh] flex flex-col items-center justify-center">
        <div className="animate-pulse text-xl mb-4">Connecting...</div>
        <p className="text-white/60">Observer mode</p>
      </div>
    )
  }

  const currentQuestion = session.status === 'playing' && session.questions[session.currentQuestionIndex]

  // Option colors matching player view
  const optionColors = [
    'bg-red-500',
    'bg-blue-500',
    'bg-yellow-500',
    'bg-green-500',
  ]

  // Calculate percentage for stats bars
  const getStatPercentage = (index: number) => {
    if (!questionStats || questionStats.answeredCount === 0) return 0
    return (questionStats.distribution[index] / questionStats.answeredCount) * 100
  }

  return (
    <div className="min-h-[100dvh] px-4 pt-16 pb-4 sm:px-5 sm:pt-16 sm:pb-5 max-w-4xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold font-mono text-secondary">{code}</h1>
        </div>
        <div className="flex items-center gap-4">
          {session.status === 'playing' && session.settings?.timerMode && timerRemaining !== null && (
            <div className={`w-16 h-16 rounded-full flex items-center justify-center font-bold text-2xl ${
              timerRemaining <= 5 ? 'bg-red-500/30 text-red-300 animate-pulse' :
              timerRemaining <= 10 ? 'bg-yellow-500/30 text-yellow-300' :
              'bg-white/10'
            }`}>
              {timerRemaining}
            </div>
          )}
          <div className="text-right">
            <span className="text-white/60 text-sm">Players</span>
            <p className="text-2xl font-bold">{session.players.length}</p>
          </div>
        </div>
      </div>

      {/* Hide Stats Toggle - for preventing players from gaming the system */}
      <div className="mb-4 flex justify-end">
        <button
          onClick={() => {
            const newValue = !hideStats
            setHideStats(newValue)
            localStorage.setItem('audience_hide_stats', String(newValue))
          }}
          className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
            hideStats 
              ? 'bg-orange-500/20 border border-orange-500/50 text-orange-300' 
              : 'bg-white/10 border border-white/20 text-white/60 hover:bg-white/20'
          }`}
        >
          {hideStats ? '🙈 Stats Hidden' : '👁️ Showing Stats'}
        </button>
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

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Left Column - Question/Status */}
        <div className="space-y-4">
          {/* Lobby State */}
          {session.status === 'lobby' && (
            <div className="bg-white/10 rounded-2xl p-8 text-center animate-slide-up">
              <div className="animate-pulse-glow w-20 h-20 rounded-full bg-primary/30 flex items-center justify-center mb-4 mx-auto">
                <span className="text-3xl">⏳</span>
              </div>
              <h2 className="text-2xl font-bold mb-2">Waiting to Start</h2>
              <p className="text-white/60">
                {session.players.length} player{session.players.length !== 1 ? 's' : ''} joined
              </p>
              <p className="text-white/40 text-sm mt-2">
                {session.questions.length} questions loaded
              </p>
            </div>
          )}

          {/* Playing State - Current Question */}
          {session.status === 'playing' && currentQuestion && (
            <div className="space-y-4 animate-slide-up">
              {/* Progress */}
              <div className="flex items-center gap-4">
                <div className="flex-1 h-3 bg-white/20 rounded-full overflow-hidden">
                  <div 
                    className="h-full bg-primary transition-all duration-300"
                    style={{ width: `${((session.currentQuestionIndex + 1) / session.questions.length) * 100}%` }}
                  />
                </div>
                <span className="text-white/60 text-sm whitespace-nowrap">
                  Q{session.currentQuestionIndex + 1}/{session.questions.length}
                </span>
              </div>

              {/* Question */}
              <div className="bg-white/10 rounded-2xl p-6">
                <h2 className="text-xl md:text-2xl font-bold text-center">
                  {currentQuestion.question}
                </h2>
              </div>

              {/* Live Answer Statistics */}
              {!hideStats ? (
                <div className="bg-white/5 rounded-2xl p-6">
                  <h3 className="font-bold mb-4 flex items-center justify-between">
                    <span>📊 Live Responses</span>
                    <span className="text-sm font-normal text-white/60">
                      {questionStats?.answeredCount || 0} / {session.players.length} answered
                    </span>
                  </h3>
                  
                  <div className="space-y-3">
                    {currentQuestion.options.map((opt, i) => {
                      const count = questionStats?.distribution[i] || 0
                      const percentage = getStatPercentage(i)
                      
                      return (
                        <div key={i} className="space-y-1">
                          <div className="flex items-center justify-between text-sm">
                            <span className="truncate flex-1 mr-2">
                              <span className="font-bold">{String.fromCharCode(65 + i)}.</span> {opt}
                            </span>
                            <span className="font-mono text-white/60">{count}</span>
                          </div>
                          <div className="h-8 bg-white/10 rounded-lg overflow-hidden">
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
                </div>
              ) : (
                <div className="bg-white/5 rounded-2xl p-6 text-center">
                  <div className="text-4xl mb-3">🙈</div>
                  <p className="text-white/60">Stats hidden to prevent peeking</p>
                  <p className="text-sm text-white/40 mt-1">
                    {questionStats?.answeredCount || 0} / {session.players.length} answered
                  </p>
                </div>
              )}
            </div>
          )}

          {/* Revealed State - Final Results */}
          {session.status === 'revealed' && results && (
            <div className="space-y-4 animate-slide-up">
              <div className="bg-gradient-to-r from-amber-500 to-orange-500 rounded-2xl p-6 text-center">
                <h2 className="text-3xl font-black">🏆 Final Results</h2>
              </div>

              {/* Top 3 Podium */}
              {results.players.length >= 1 && (
                <div className="bg-white/10 rounded-2xl p-6">
                  <div className="flex items-end justify-center gap-4 h-40">
                    {/* 2nd Place */}
                    {results.players[1] && (
                      <div className="flex flex-col items-center">
                        <span className="text-2xl mb-2">🥈</span>
                        <div className="w-20 bg-gray-300/20 rounded-t-lg flex flex-col items-center justify-end pb-2" style={{ height: '80px' }}>
                          <p className="font-bold text-sm truncate max-w-full px-1">{results.players[1].nickname}</p>
                          <p className="text-lg font-black text-secondary">{results.players[1].score}</p>
                        </div>
                      </div>
                    )}
                    
                    {/* 1st Place */}
                    {results.players[0] && (
                      <div className="flex flex-col items-center">
                        <span className="text-3xl mb-2">🥇</span>
                        <div className="w-24 bg-yellow-500/20 rounded-t-lg flex flex-col items-center justify-end pb-2" style={{ height: '100px' }}>
                          <p className="font-bold truncate max-w-full px-1">{results.players[0].nickname}</p>
                          <p className="text-2xl font-black text-yellow-400">{results.players[0].score}</p>
                        </div>
                      </div>
                    )}
                    
                    {/* 3rd Place */}
                    {results.players[2] && (
                      <div className="flex flex-col items-center">
                        <span className="text-xl mb-2">🥉</span>
                        <div className="w-20 bg-amber-700/20 rounded-t-lg flex flex-col items-center justify-end pb-2" style={{ height: '60px' }}>
                          <p className="font-bold text-sm truncate max-w-full px-1">{results.players[2].nickname}</p>
                          <p className="text-lg font-black text-amber-500">{results.players[2].score}</p>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Right Column - Leaderboard */}
        <div className="bg-white/10 rounded-2xl overflow-hidden h-fit">
          <div className="p-4 bg-white/5 border-b border-white/10">
            <h3 className="font-bold text-lg">📊 Live Leaderboard</h3>
          </div>
          
          <div className="max-h-[500px] overflow-y-auto">
            {leaderboard.length === 0 && session.status === 'lobby' ? (
              <div className="p-6 text-center text-white/40">
                Leaderboard will appear once the game starts
              </div>
            ) : leaderboard.length === 0 ? (
              <div className="p-6 text-center text-white/40">
                No scores yet
              </div>
            ) : (
              leaderboard.map((entry, i) => (
                <div 
                  key={entry.id}
                  className={`flex items-center p-4 ${i > 0 ? 'border-t border-white/10' : ''} ${
                    i < 3 ? 'bg-gradient-to-r from-white/5 to-transparent' : ''
                  }`}
                >
                  <span className={`w-10 h-10 rounded-full flex items-center justify-center font-bold mr-4 ${
                    i === 0 ? 'bg-yellow-500 text-black' :
                    i === 1 ? 'bg-gray-300 text-black' :
                    i === 2 ? 'bg-amber-700 text-white' :
                    'bg-white/20'
                  }`}>
                    {entry.rank}
                  </span>
                  <div className="flex-1 min-w-0">
                    <p className="font-medium truncate">{entry.nickname}</p>
                    <p className="text-xs text-white/40">
                      {entry.correctAnswers}/{entry.totalAnswers} correct
                    </p>
                  </div>
                  <span className="text-2xl font-black text-primary">{entry.score}</span>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
