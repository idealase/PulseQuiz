import { useState, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { useConfig } from '../context/ConfigContext'
import { ApiClient } from '../api/client'
import { parseCSV } from '../utils/csvParser'
import { Question } from '../types'
import { QRCodeSVG } from 'qrcode.react'
import { getShuffledQuestions } from '../data/defaultQuestions'

export default function HostCreate() {
  const config = useConfig()
  const navigate = useNavigate()
  
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

  const api = new ApiClient(config.apiBaseUrl)

  const handleCreateSession = async () => {
    setLoading(true)
    setError(null)
    try {
      const result = await api.createSession({ 
        timerMode, 
        timerSeconds: timerMode ? timerSeconds : 15 
      })
      setSessionCode(result.code)
      setHostToken(result.hostToken)
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
      await api.uploadQuestions(sessionCode, hostToken, questions)
      // Store host token in sessionStorage for the session page
      sessionStorage.setItem(`host_${sessionCode}`, hostToken)
      navigate(`/host/${sessionCode}`)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to upload questions')
    }
    setLoading(false)
  }

  const joinUrl = sessionCode 
    ? `${window.location.origin}${import.meta.env.BASE_URL}#/join/${sessionCode}`
    : ''

  return (
    <div className="min-h-screen p-6 max-w-lg mx-auto">
      <h1 className="text-3xl font-bold mb-8 text-center">Host a Quiz</h1>

      {!sessionCode ? (
        <div className="space-y-6 animate-slide-up">
          {/* Timer Mode Settings */}
          <div className="bg-white/10 rounded-2xl p-6">
            <h2 className="text-lg font-bold mb-4">Game Settings</h2>
            
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
              <div className="ml-8 space-y-2">
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
          </div>

          <button
            onClick={handleCreateSession}
            disabled={loading}
            className="w-full py-4 px-8 text-xl font-bold rounded-2xl bg-gradient-to-r from-primary to-indigo-500 hover:from-indigo-600 hover:to-primary transition-all disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading ? 'Creating...' : 'Create Session'}
          </button>
          
          {error && (
            <div className="p-4 bg-red-500/20 border border-red-500 rounded-lg text-red-300">
              {error}
            </div>
          )}
        </div>
      ) : (
        <div className="space-y-6 animate-slide-up">
          {/* Session Code Display */}
          <div className="bg-white/10 rounded-2xl p-6 text-center">
            <p className="text-white/60 mb-2">Session Code</p>
            <p className="text-5xl font-mono font-bold tracking-wider text-secondary">
              {sessionCode}
            </p>
          </div>

          {/* QR Code */}
          <div className="bg-white rounded-2xl p-6 flex flex-col items-center">
            <QRCodeSVG value={joinUrl} size={180} level="M" />
            <p className="text-gray-600 text-sm mt-3">Scan to join</p>
          </div>

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

          {/* Default Quiz Button */}
          <div className="text-center">
            <p className="text-white/40 text-sm mb-2">— or —</p>
            <button
              onClick={() => {
                const questions = getShuffledQuestions(20)
                setQuestions(questions)
                setCsvErrors([])
              }}
              className="px-6 py-3 text-lg font-bold rounded-xl bg-white/10 border border-white/30 hover:bg-white/20 hover:border-white/50 transition-all"
            >
              🎲 Use Default Quiz (20 random Qs)
            </button>
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
            disabled={loading || questions.length === 0}
            className="w-full py-4 px-8 text-xl font-bold rounded-2xl bg-gradient-to-r from-green-500 to-emerald-500 hover:from-green-600 hover:to-emerald-600 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading ? 'Starting...' : `Start with ${questions.length} Questions`}
          </button>
        </div>
      )}
    </div>
  )
}
