import { useState, useEffect, useRef } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useConfig } from '../context/ConfigContext'
import { ApiClient } from '../api/client'
import { SessionState, ServerMessage, RevealResults } from '../types'

export default function HostSession() {
  const { code } = useParams<{ code: string }>()
  const config = useConfig()
  const navigate = useNavigate()
  
  const [session, setSession] = useState<SessionState | null>(null)
  const [results, setResults] = useState<RevealResults | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const wsRef = useRef<WebSocket | null>(null)
  
  const hostToken = sessionStorage.getItem(`host_${code}`)
  const api = new ApiClient(config.apiBaseUrl)

  useEffect(() => {
    if (!code || !hostToken) {
      navigate('/host')
      return
    }

    const ws = new WebSocket(api.getWebSocketUrl(code))
    wsRef.current = ws

    ws.onopen = () => {
      ws.send(JSON.stringify({ type: 'identify_host', hostToken }))
    }

    ws.onmessage = (event) => {
      const msg: ServerMessage = JSON.parse(event.data)
      
      switch (msg.type) {
        case 'session_state':
          setSession(msg.state)
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
          break
        case 'revealed':
          setSession(prev => prev ? { ...prev, status: 'revealed' } : null)
          setResults(msg.results)
          break
        case 'error':
          setError(msg.message)
          break
      }
    }

    ws.onerror = () => {
      setError('Connection error')
    }

    ws.onclose = () => {
      console.log('WebSocket closed')
    }

    return () => {
      ws.close()
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
    setLoading(true)
    try {
      await api.nextQuestion(code, hostToken)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to advance')
    }
    setLoading(false)
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
          <span className="text-white/60 text-sm">Session</span>
          <h1 className="text-2xl font-bold font-mono text-secondary">{code}</h1>
        </div>
        <div className="text-right">
          <span className="text-white/60 text-sm">Players</span>
          <p className="text-2xl font-bold">{session.players.length}</p>
        </div>
      </div>

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
          {/* Progress */}
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

          {/* Answer Status */}
          <div className="bg-white/5 rounded-xl p-4 text-center">
            <p className="text-white/60">
              <span className="text-2xl font-bold text-primary">{answeredCount}</span>
              <span className="mx-1">/</span>
              <span>{session.players.length}</span>
              <span className="ml-2">answered</span>
            </p>
          </div>

          {/* Controls */}
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
                  {i + 1}
                </div>
                <span className="flex-1 font-medium">{p.nickname}</span>
                <span className="text-xl font-bold text-primary">{p.score}</span>
              </div>
            ))}
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
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
