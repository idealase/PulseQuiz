import { useState, useCallback, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { useConfig } from '../context/ConfigContext'
import { useTheme } from '../context/ThemeContext'
import { ApiClient } from '../api/client'
import { parseCSV } from '../utils/csvParser'
import { Question } from '../types'
import { questionSets, getShuffledQuestionsFromSet, QuestionSetId } from '../data/defaultQuestions'

type GamePhase = 'setup' | 'playing' | 'result'

type DynamicConfig = {
  enabled: boolean
  topics: string
  authToken: string
  targetCount: number
  batchSize: number
  currentBatch: number
  lastDifficulty: string
  sessionCode: string
}

export default function SoloPlay() {
  const config = useConfig()
  const { applyTheme, lockTheme, intensity, experimentalTheme } = useTheme()
  const api = new ApiClient(config.apiBaseUrl)

  // Setup phase state
  const [questions, setQuestions] = useState<Question[]>([])
  const [csvErrors, setCsvErrors] = useState<string[]>([])
  const [dragActive, setDragActive] = useState(false)
  
  // AI Generation settings
  const [aiTopics, setAiTopics] = useState('')
  const [aiQuestionCount, setAiQuestionCount] = useState(10)
  const [aiResearchMode, setAiResearchMode] = useState(false)
  const [aiDynamicMode, setAiDynamicMode] = useState(false)
  const [aiGenerating, setAiGenerating] = useState(false)
  const [themeGenerating, setThemeGenerating] = useState(false)
  const [aiAuthToken, setAiAuthToken] = useState(() => localStorage.getItem('quiz_auth_token') || '')
  const [generationTime, setGenerationTime] = useState<number | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [dynamicConfig, setDynamicConfig] = useState<DynamicConfig | null>(null)
  const [generatingBatch, setGeneratingBatch] = useState(false)

  // Game phase state
  const [phase, setPhase] = useState<GamePhase>('setup')
  const [currentIndex, setCurrentIndex] = useState(0)
  const [selectedAnswer, setSelectedAnswer] = useState<number | null>(null)
  const [showResult, setShowResult] = useState(false)
  const [score, setScore] = useState(0)
  const [answers, setAnswers] = useState<{ questionIndex: number; selected: number; correct: boolean; responseTimeMs?: number }[]>([])
  const [streak, setStreak] = useState(0)
  const [bestStreak, setBestStreak] = useState(0)
  const [questionStartTime, setQuestionStartTime] = useState<number | null>(null)
  const [feedbackByQuestion, setFeedbackByQuestion] = useState<Record<number, string>>({})
  const [feedbackTypeByQuestion, setFeedbackTypeByQuestion] = useState<Record<number, string>>({})
  const [feedbackSending, setFeedbackSending] = useState<number | null>(null)
  const [feedbackSent, setFeedbackSent] = useState<Record<number, boolean>>({})

  // Timer
  const [timerEnabled, setTimerEnabled] = useState(false)
  const [timerSeconds, setTimerSeconds] = useState(15)
  const [timeRemaining, setTimeRemaining] = useState<number | null>(null)

  // Timer effect
  useEffect(() => {
    if (phase !== 'playing' || showResult || !timerEnabled || timeRemaining === null) return

    if (timeRemaining <= 0) {
      // Time's up - auto submit wrong answer
      handleAnswer(-1)
      return
    }

    const timer = setTimeout(() => {
      setTimeRemaining(t => t !== null ? t - 1 : null)
    }, 1000)

    return () => clearTimeout(timer)
  }, [phase, showResult, timerEnabled, timeRemaining])

  useEffect(() => {
    if (phase === 'playing') {
      setQuestionStartTime(Date.now())
    }
  }, [phase, currentIndex])

  const handleFileUpload = useCallback((file: File) => {
    const reader = new FileReader()
    reader.onload = (e) => {
      const content = e.target?.result as string
      const result = parseCSV(content)
      
      if (result.errors.length > 0) {
        setCsvErrors(result.errors)
        if (result.questions.length === 0) return
      } else {
        setCsvErrors([])
      }
      
      setQuestions(result.questions)
      setDynamicConfig(null)
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
    if (file) handleFileUpload(file)
  }

  const handlePresetSelect = (setId: QuestionSetId, count: number) => {
    const presetQuestions = getShuffledQuestionsFromSet(setId, count)
    setQuestions(presetQuestions)
    setCsvErrors([])
    setDynamicConfig(null)
  }

  const buildDynamicPerformance = (batchSize: number) => {
    const recentAnswers = answers.slice(-batchSize)
    if (recentAnswers.length === 0) {
      return {
        avg_score_percent: 60,
        avg_response_time_ms: 8000,
        player_count: 1,
        questions_answered: 0
      }
    }

    const correctCount = recentAnswers.filter(a => a.correct).length
    const avgScore = (correctCount / recentAnswers.length) * 100
    const timingValues = recentAnswers
      .map(a => a.responseTimeMs)
      .filter((value): value is number => typeof value === 'number' && !Number.isNaN(value))
    const avgTime = timingValues.length > 0
      ? Math.round(timingValues.reduce((sum, value) => sum + value, 0) / timingValues.length)
      : 8000

    return {
      avg_score_percent: Number(avgScore.toFixed(1)),
      avg_response_time_ms: avgTime,
      player_count: 1,
      questions_answered: recentAnswers.length
    }
  }

  const generateNextBatch = async () => {
    if (!dynamicConfig) return
    const remaining = dynamicConfig.targetCount - questions.length
    if (remaining <= 0) return

    setGeneratingBatch(true)
    setError(null)
    try {
      const nextBatchNumber = dynamicConfig.currentBatch + 1
      const batchSize = Math.min(dynamicConfig.batchSize, remaining)
      const performance = buildDynamicPerformance(dynamicConfig.batchSize)

      const result = await api.generateDynamicBatch({
        topics: dynamicConfig.topics,
        session_code: dynamicConfig.sessionCode,
        batch_number: nextBatchNumber,
        batch_size: batchSize,
        previous_difficulty: dynamicConfig.lastDifficulty || 'medium',
        performance
      }, dynamicConfig.authToken)

      if (result.questions.length > 0) {
        setQuestions(prev => [...prev, ...result.questions])
        setDynamicConfig(prev => prev ? {
          ...prev,
          currentBatch: nextBatchNumber,
          lastDifficulty: result.suggested_difficulty
        } : prev)
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to generate next batch')
    }
    setGeneratingBatch(false)
  }

  const handleAiGenerate = async () => {
    if (!aiTopics.trim()) {
      setError('Please enter at least one topic')
      return
    }
    
    if (!aiAuthToken.trim()) {
      setError('Auth token required for AI generation')
      return
    }

    setAiGenerating(true)
    setError(null)
    setGenerationTime(null)
    setCsvErrors([])
    setDynamicConfig(null)
    const startTime = Date.now()

    try {
      localStorage.setItem('quiz_auth_token', aiAuthToken)

      const dynamicEnabled = aiDynamicMode
      const initialBatchSize = dynamicEnabled ? Math.min(10, aiQuestionCount) : aiQuestionCount
      
      const result = await api.generateQuestions({
        topics: aiTopics.trim(),
        count: initialBatchSize,
        research_mode: aiResearchMode
      }, aiAuthToken)

      setQuestions(result.questions)
      setCsvErrors([])
      setGenerationTime(Date.now() - startTime)

      if (!lockTheme && experimentalTheme) {
        setThemeGenerating(true)
        try {
          const themeResult = await api.generateTheme({
            topic: aiTopics.trim(),
            intensity
          }, aiAuthToken)
          applyTheme(themeResult.theme)
        } catch (themeError) {
          console.warn('Theme generation failed', themeError)
        } finally {
          setThemeGenerating(false)
        }
      }

      if (dynamicEnabled) {
        const sessionCode = `solo-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`
        setDynamicConfig({
          enabled: true,
          topics: aiTopics.trim(),
          authToken: aiAuthToken,
          targetCount: aiQuestionCount,
          batchSize: 10,
          currentBatch: 1,
          lastDifficulty: 'medium',
          sessionCode
        })
        setCsvErrors([
          `Dynamic Mode: Generated initial batch of ${result.questions.length} questions. Target: ${aiQuestionCount} total.`
        ])
      } else {
        setDynamicConfig(null)
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to generate questions')
    }
    setAiGenerating(false)
  }

  const handleThemePreview = async () => {
    if (!aiTopics.trim()) {
      setError('Please enter at least one topic')
      return
    }

    if (!aiAuthToken.trim()) {
      setError('Auth token required for theme preview')
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
        topic: aiTopics.trim(),
        intensity
      }, aiAuthToken)
      applyTheme(themeResult.theme)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Theme preview failed')
    }

    setThemeGenerating(false)
  }

  const startGame = () => {
    if (questions.length === 0) return
    setPhase('playing')
    setCurrentIndex(0)
    setScore(0)
    setAnswers([])
    setStreak(0)
    setBestStreak(0)
    setSelectedAnswer(null)
    setShowResult(false)
    if (timerEnabled) setTimeRemaining(timerSeconds)
  }

  const handleAnswer = (answerIndex: number) => {
    if (showResult) return
    
    const question = questions[currentIndex]
    const isCorrect = answerIndex === question.correct
    const responseTimeMs = questionStartTime ? Date.now() - questionStartTime : undefined
    
    setSelectedAnswer(answerIndex)
    setShowResult(true)
    setTimeRemaining(null)
    
    if (isCorrect) {
      const newStreak = streak + 1
      setStreak(newStreak)
      if (newStreak > bestStreak) setBestStreak(newStreak)
      
      // Bonus points for streaks
      const streakBonus = Math.min(newStreak - 1, 5) * 50
      setScore(s => s + question.points + streakBonus)
    } else {
      setStreak(0)
    }
    
    setAnswers(prev => [...prev, { 
      questionIndex: currentIndex, 
      selected: answerIndex, 
      correct: isCorrect,
      responseTimeMs
    }])
  }

  const handleSubmitFeedback = async (questionIndex: number, selectedChoiceOverride?: number | null) => {
    const question = questions[questionIndex]
    if (!question) return

    const message = (feedbackByQuestion[questionIndex] || '').trim()
    if (!message) {
      setError('Please enter feedback before sending')
      return
    }

    const selectedChoice = selectedChoiceOverride ?? selectedAnswer ?? null

    setFeedbackSending(questionIndex)
    try {
      await api.submitSoloFeedback({
        question: question.question,
        options: question.options,
        message,
        feedbackType: feedbackTypeByQuestion[questionIndex] || 'question',
        selectedChoice,
        correctChoice: question.correct
      })
      setFeedbackSent(prev => ({ ...prev, [questionIndex]: true }))
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to send feedback')
    }
    setFeedbackSending(null)
  }

  const nextQuestion = async () => {
    const isAtLastLoadedQuestion = currentIndex >= questions.length - 1
    const needsMoreQuestions = dynamicConfig ? questions.length < dynamicConfig.targetCount : false

    if (dynamicConfig) {
      const questionsRemaining = questions.length - currentIndex - 1
      if (!generatingBatch && questionsRemaining <= 5 && needsMoreQuestions) {
        void generateNextBatch()
      }
      if (isAtLastLoadedQuestion && needsMoreQuestions) {
        return
      }
    }

    if (isAtLastLoadedQuestion) {
      setPhase('result')
    } else {
      setCurrentIndex(i => i + 1)
      setSelectedAnswer(null)
      setShowResult(false)
      if (timerEnabled) setTimeRemaining(timerSeconds)
    }
  }

  const restartGame = () => {
    setPhase('setup')
    setQuestions([])
    setCurrentIndex(0)
    setScore(0)
    setAnswers([])
    setStreak(0)
    setBestStreak(0)
    setDynamicConfig(null)
    setGeneratingBatch(false)
  }

  const playAgain = () => {
    // Shuffle questions for replay
    const shuffled = [...questions].sort(() => Math.random() - 0.5)
    setQuestions(shuffled)
    startGame()
  }

  const currentQuestion = questions[currentIndex]
  const correctCount = answers.filter(a => a.correct).length
  const accuracy = answers.length > 0 ? Math.round((correctCount / answers.length) * 100) : 0
  const generationActive = aiGenerating || themeGenerating

  // Setup Phase
  if (phase === 'setup') {
    return (
      <div className="min-h-screen p-6">
        <div className="max-w-2xl mx-auto">
          <Link to="/" className="text-white/60 hover:text-white mb-6 inline-block">
            ← Back
          </Link>

          <h1 className="text-4xl font-bold mb-2 bg-gradient-to-r from-yellow-400 to-orange-500 bg-clip-text text-transparent">
            🎯 Solo Mode
          </h1>
          <p className="text-white/60 mb-8">Practice on your own - no pressure!</p>

          {error && (
            <div className="mb-6 p-4 bg-red-500/20 border border-red-500/50 rounded-xl text-red-300">
              {error}
            </div>
          )}

          {/* AI Generation Section */}
          <div className="bg-gradient-to-br from-indigo-500/20 to-purple-500/20 border border-indigo-500/30 rounded-2xl p-6 mb-6">
            <h2 className="text-xl font-bold mb-4 flex items-center gap-2">
              <span className="text-2xl">🤖</span> AI Quiz Generator
            </h2>
            
            <div className="space-y-4">
              <div>
                <label className="block text-sm text-white/70 mb-2">Topics (comma-separated)</label>
                <input
                  type="text"
                  value={aiTopics}
                  onChange={(e) => setAiTopics(e.target.value)}
                  placeholder="e.g., Space exploration, Ancient Rome, 90s movies"
                  className="w-full px-4 py-3 bg-white/10 border border-white/20 rounded-xl focus:outline-none focus:border-indigo-500"
                  disabled={aiGenerating}
                />
              </div>

              <div className="flex gap-4 items-end">
                <div className="flex-1">
                  <label className="block text-sm text-white/70 mb-2">
                    Questions: {aiQuestionCount}
                  </label>
                  <input
                    type="range"
                    min="5"
                    max="50"
                    value={aiQuestionCount}
                    onChange={(e) => setAiQuestionCount(Number(e.target.value))}
                    className="w-full"
                    disabled={aiGenerating}
                  />
                </div>
                
                <label className="flex items-center gap-2 cursor-pointer pb-1">
                  <input
                    type="checkbox"
                    checked={aiResearchMode}
                    onChange={(e) => setAiResearchMode(e.target.checked)}
                    className="w-5 h-5 rounded"
                    disabled={aiGenerating}
                  />
                  <span className="text-sm">🔬 Research Mode</span>
                </label>
              </div>

              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={aiDynamicMode}
                  onChange={(e) => setAiDynamicMode(e.target.checked)}
                  className="w-5 h-5 rounded"
                  disabled={aiGenerating}
                />
                <span className="text-sm">🎲 Dynamic Mode (adapts difficulty)</span>
              </label>

              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="block text-sm text-white/70">Auth Token</label>
                  {aiAuthToken && (
                    <span className="text-xs text-green-400">✓ Saved</span>
                  )}
                </div>
                <input
                  type="password"
                  value={aiAuthToken}
                  onChange={(e) => setAiAuthToken(e.target.value)}
                  placeholder="Enter auth token"
                  className="w-full px-4 py-3 bg-white/10 border border-white/20 rounded-xl focus:outline-none focus:border-indigo-500"
                />
              </div>

              <button
                onClick={handleAiGenerate}
                disabled={aiGenerating || !aiTopics.trim()}
                className="w-full py-3 px-6 bg-gradient-to-r from-indigo-500 to-purple-500 rounded-xl font-bold hover:from-indigo-600 hover:to-purple-600 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {aiGenerating ? (
                  <span className="flex items-center justify-center gap-2">
                    <span className="animate-spin">⚡</span> Generating...
                  </span>
                ) : (
                  '✨ Generate Quiz'
                )}
              </button>

              <button
                onClick={handleThemePreview}
                disabled={themeGenerating || !aiTopics.trim() || lockTheme || !experimentalTheme}
                className="w-full py-2.5 px-6 border border-indigo-500/50 rounded-xl font-semibold text-indigo-200 hover:bg-indigo-500/10 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {themeGenerating ? 'Previewing Theme...' : '🎨 Preview Theme'}
              </button>

              {generationTime && (
                <p className="text-sm text-white/50 text-center">
                  Generated in {(generationTime / 1000).toFixed(1)}s
                </p>
              )}
            </div>
          </div>

          {/* Preset Questions */}
          <details className="mb-6">
            <summary className="cursor-pointer text-white/60 hover:text-white mb-4">
              📚 Or use preset questions...
            </summary>
            <div className="grid grid-cols-2 gap-3 mt-4">
              {questionSets.map((set) => (
                <button
                  key={set.id}
                  onClick={() => handlePresetSelect(set.id, 10)}
                  className="p-4 bg-white/10 hover:bg-white/20 rounded-xl text-left transition-all"
                >
                  <span className="text-2xl">{set.emoji}</span>
                  <div className="font-medium mt-1">{set.name}</div>
                  <div className="text-sm text-white/50">{set.questions.length} questions</div>
                </button>
              ))}
            </div>
          </details>

          {/* CSV Upload */}
          <details className="mb-6">
            <summary className="cursor-pointer text-white/60 hover:text-white">
              📄 Or upload CSV...
            </summary>
            <div
              className={`mt-4 border-2 border-dashed rounded-xl p-8 text-center transition-all ${
                dragActive ? 'border-primary bg-primary/10' : 'border-white/30 hover:border-white/50'
              }`}
              onDragOver={(e) => { e.preventDefault(); setDragActive(true) }}
              onDragLeave={() => setDragActive(false)}
              onDrop={handleDrop}
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
                <p className="text-white/80">Drop CSV here or click to browse</p>
              </label>
            </div>
          </details>

          {csvErrors.length > 0 && (
            <div className="mb-6 p-4 bg-yellow-500/20 border border-yellow-500/50 rounded-xl">
              <p className="font-medium text-yellow-300 mb-2">⚠️ CSV Warnings:</p>
              <ul className="text-sm text-yellow-200/80 list-disc list-inside">
                {csvErrors.map((err, i) => <li key={i}>{err}</li>)}
              </ul>
            </div>
          )}

          {/* Questions Preview */}
          {questions.length > 0 && (
            <div className="mb-6 p-4 bg-green-500/20 border border-green-500/50 rounded-xl">
              <p className="font-medium text-green-300">
                ✅ {questions.length} questions loaded!
              </p>
            </div>
          )}

          {/* Timer Setting */}
          <div className="mb-6 p-4 bg-white/5 rounded-xl">
            <label className="flex items-center gap-3 cursor-pointer">
              <input
                type="checkbox"
                checked={timerEnabled}
                onChange={(e) => setTimerEnabled(e.target.checked)}
                className="w-5 h-5 rounded"
              />
              <span>⏱️ Enable Timer</span>
              {timerEnabled && (
                <input
                  type="number"
                  value={timerSeconds}
                  onChange={(e) => setTimerSeconds(Math.max(5, Math.min(60, Number(e.target.value))))}
                  className="w-16 px-2 py-1 bg-white/10 rounded text-center"
                  min={5}
                  max={60}
                />
              )}
              {timerEnabled && <span className="text-white/50">seconds per question</span>}
            </label>
          </div>

          {/* Start Button */}
          <button
            onClick={startGame}
            disabled={questions.length === 0 || generationActive}
            className="w-full py-4 px-8 text-xl font-bold rounded-2xl bg-gradient-to-r from-yellow-500 to-orange-500 hover:from-yellow-400 hover:to-orange-400 transition-all disabled:opacity-50 disabled:cursor-not-allowed hover:scale-105 active:scale-95"
          >
            {generationActive ? 'Preparing...' : '🎮 Start Solo Quiz!'}
          </button>
        </div>
      </div>

      {generationActive && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm">
          <div className="w-full max-w-sm rounded-2xl border border-white/10 bg-slate-900/90 p-6 text-center">
            <div className="text-3xl mb-3">⏳</div>
            <h3 className="text-lg font-bold">Preparing your quiz</h3>
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
    )
  }

  // Playing Phase
  if (phase === 'playing' && currentQuestion) {
    const totalQuestions = dynamicConfig ? dynamicConfig.targetCount : questions.length
    const isAtLastLoadedQuestion = currentIndex >= questions.length - 1
    const needsMoreQuestions = dynamicConfig ? questions.length < dynamicConfig.targetCount : false
    const shouldBlockForBatch = generatingBatch && isAtLastLoadedQuestion && needsMoreQuestions
    return (
      <div className="h-[100dvh] p-4 flex flex-col overflow-hidden">
        {/* Header */}
        <div className="flex justify-between items-center mb-2 shrink-0">
          <div className="text-white/60">
            Question {currentIndex + 1} / {totalQuestions}
          </div>
          <div className="flex items-center gap-4">
            {dynamicConfig && (
              <div className="px-3 py-1 bg-purple-500/20 text-purple-300 rounded-full text-xs font-bold">
                🎲 Dynamic {questions.length}/{dynamicConfig.targetCount}
                {generatingBatch && <span className="ml-1 animate-pulse">• Generating</span>}
              </div>
            )}
            {streak > 1 && (
              <div className="px-3 py-1 bg-orange-500/20 text-orange-400 rounded-full text-sm font-bold">
                🔥 {streak} streak!
              </div>
            )}
            <div className="text-xl font-bold text-yellow-400">
              {score} pts
            </div>
          </div>
        </div>

        {/* Timer */}
        {timerEnabled && timeRemaining !== null && !showResult && (
          <div className="mb-2 shrink-0">
            <div className="h-2 bg-white/10 rounded-full overflow-hidden">
              <div 
                className={`h-full transition-all duration-1000 ${
                  timeRemaining <= 5 ? 'bg-red-500' : 'bg-green-500'
                }`}
                style={{ width: `${(timeRemaining / timerSeconds) * 100}%` }}
              />
            </div>
            <div className={`text-center mt-1 text-sm ${timeRemaining <= 5 ? 'text-red-400' : 'text-white/50'}`}>
              {timeRemaining}s
            </div>
          </div>
        )}

        {/* Question */}
        <div className="flex-1 flex flex-col min-h-0 max-w-2xl mx-auto w-full">
          <div className="bg-white/10 backdrop-blur-lg rounded-2xl p-4 md:p-8 mb-3 shrink-0">
            <h2 className="text-lg md:text-3xl font-bold text-center">
              {currentQuestion.question}
            </h2>
          </div>

          {/* Options */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-2 md:gap-4 flex-1 min-h-0 auto-rows-fr">
            {currentQuestion.options.map((option, index) => {
              let bgClass = 'bg-white/10 hover:bg-white/20 border-white/20 hover:border-white/40'
              
              if (showResult) {
                if (index === currentQuestion.correct) {
                  bgClass = 'bg-green-500/30 border-green-500'
                } else if (index === selectedAnswer && index !== currentQuestion.correct) {
                  bgClass = 'bg-red-500/30 border-red-500'
                } else {
                  bgClass = 'bg-white/5 border-white/10 opacity-50'
                }
              }

              return (
                <button
                  key={index}
                  onClick={() => !showResult && handleAnswer(index)}
                  disabled={showResult}
                  className={`px-4 py-3 md:p-6 rounded-2xl border-2 text-left transition-all flex items-center ${bgClass} ${
                    !showResult ? 'hover:scale-102 active:scale-98' : ''
                  }`}
                >
                  <span className="text-sm md:text-lg line-clamp-2">{option}</span>
                </button>
              )
            })}
          </div>

          {/* Result feedback */}
          {showResult && (
            <div className="mt-3 text-center animate-slide-up shrink-0">
              {selectedAnswer === currentQuestion.correct ? (
                <div className="text-green-400 text-xl font-bold mb-1">
                  ✅ Correct! +{currentQuestion.points}{streak > 1 ? ` +${Math.min(streak - 1, 5) * 50} streak bonus` : ''}
                </div>
              ) : selectedAnswer === -1 ? (
                <div className="text-red-400 text-xl font-bold mb-1">
                  ⏱️ Time's up!
                </div>
              ) : (
                <div className="text-red-400 text-xl font-bold mb-1">
                  ❌ Incorrect
                </div>
              )}
              
              {currentQuestion.explanation && (
                <p className="text-white/70 text-sm mb-2">{currentQuestion.explanation}</p>
              )}

              <div className="mt-3 max-w-xl mx-auto text-left bg-white/5 border border-white/10 rounded-xl p-3">
                <div className="flex items-center gap-2 mb-2">
                  <label className="text-xs text-white/60">Feedback about</label>
                  <select
                    value={feedbackTypeByQuestion[currentIndex] || 'question'}
                    onChange={(e) => setFeedbackTypeByQuestion(prev => ({ ...prev, [currentIndex]: e.target.value }))}
                    className="bg-white/10 border border-white/20 rounded-md text-xs px-2 py-1"
                    disabled={feedbackSent[currentIndex]}
                  >
                    <option value="question">Question</option>
                    <option value="answer">Answer</option>
                    <option value="both">Both</option>
                    <option value="other">Other</option>
                  </select>
                </div>
                <textarea
                  value={feedbackByQuestion[currentIndex] || ''}
                  onChange={(e) => setFeedbackByQuestion(prev => ({ ...prev, [currentIndex]: e.target.value }))}
                  placeholder="Spot an issue? Tell us right away..."
                  rows={2}
                  className="w-full text-xs px-3 py-2 bg-white/10 border border-white/20 rounded-lg focus:border-secondary focus:outline-none"
                  disabled={feedbackSent[currentIndex]}
                />
                <div className="mt-2 flex items-center justify-between">
                  <span className="text-xs text-white/40">Feedback goes to backend logs</span>
                  <button
                    onClick={() => handleSubmitFeedback(currentIndex)}
                    disabled={feedbackSent[currentIndex] || feedbackSending === currentIndex}
                    className="px-3 py-1 text-xs font-semibold rounded-lg bg-white/20 hover:bg-white/30 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {feedbackSent[currentIndex] ? 'Sent' : feedbackSending === currentIndex ? 'Sending...' : 'Send'}
                  </button>
                </div>
              </div>

              <button
                onClick={nextQuestion}
                disabled={shouldBlockForBatch}
                className="px-8 py-3 bg-gradient-to-r from-primary to-indigo-500 rounded-xl font-bold hover:scale-105 active:scale-95 transition-all disabled:opacity-60 disabled:cursor-not-allowed"
              >
                {shouldBlockForBatch
                  ? 'Generating next batch...'
                  : currentIndex >= questions.length - 1
                    ? 'See Results'
                    : 'Next Question'} →
              </button>
            </div>
          )}
        </div>
      </div>
    )
  }

  // Result Phase
  if (phase === 'result') {
    const maxPossibleScore = questions.reduce((sum, q) => sum + q.points, 0)
    const scorePercent = Math.round((score / maxPossibleScore) * 100)
    
    let grade = '🌟'
    let message = 'Amazing!'
    if (scorePercent < 30) { grade = '😅'; message = 'Keep practicing!' }
    else if (scorePercent < 50) { grade = '🙂'; message = 'Not bad!' }
    else if (scorePercent < 70) { grade = '😊'; message = 'Good job!' }
    else if (scorePercent < 90) { grade = '🎉'; message = 'Great work!' }
    else { grade = '🏆'; message = 'Outstanding!' }

    return (
      <div className="min-h-screen p-6 flex items-center justify-center">
        <div className="max-w-md w-full text-center">
          <div className="text-8xl mb-4">{grade}</div>
          <h1 className="text-4xl font-bold mb-2">{message}</h1>
          
          <div className="bg-white/10 backdrop-blur-lg rounded-3xl p-8 my-8">
            <div className="text-5xl font-black text-yellow-400 mb-2">
              {score}
            </div>
            <div className="text-white/60 mb-6">points</div>
            
            <div className="grid grid-cols-3 gap-4 text-center">
              <div>
                <div className="text-2xl font-bold text-green-400">{correctCount}</div>
                <div className="text-sm text-white/50">Correct</div>
              </div>
              <div>
                <div className="text-2xl font-bold">{accuracy}%</div>
                <div className="text-sm text-white/50">Accuracy</div>
              </div>
              <div>
                <div className="text-2xl font-bold text-orange-400">{bestStreak}</div>
                <div className="text-sm text-white/50">Best Streak</div>
              </div>
            </div>
          </div>

          {/* Question Review */}
          <details className="mb-6 text-left">
            <summary className="cursor-pointer text-white/60 hover:text-white text-center">
              📋 Review Answers
            </summary>
            <div className="mt-4 space-y-3">
              {answers.map((answer, i) => {
                const q = questions[answer.questionIndex]
                return (
                  <div 
                    key={i}
                    className={`p-4 rounded-xl ${answer.correct ? 'bg-green-500/20' : 'bg-red-500/20'}`}
                  >
                    <p className="font-medium mb-1">{q.question}</p>
                    <p className={`text-sm ${answer.correct ? 'text-green-400' : 'text-red-400'}`}>
                      {answer.selected === -1 ? 'No answer (time out)' : `Your answer: ${q.options[answer.selected]}`}
                    </p>
                    {!answer.correct && (
                      <p className="text-sm text-green-400">
                        Correct: {q.options[q.correct]}
                      </p>
                    )}

                    <div className="mt-3 pt-3 border-t border-white/10">
                      <div className="flex items-center gap-2 mb-2">
                        <label className="text-xs text-white/60">Feedback about</label>
                        <select
                          value={feedbackTypeByQuestion[answer.questionIndex] || 'question'}
                          onChange={(e) => setFeedbackTypeByQuestion(prev => ({ ...prev, [answer.questionIndex]: e.target.value }))}
                          className="bg-white/10 border border-white/20 rounded-md text-xs px-2 py-1"
                          disabled={feedbackSent[answer.questionIndex]}
                        >
                          <option value="question">Question</option>
                          <option value="answer">Answer</option>
                          <option value="both">Both</option>
                          <option value="other">Other</option>
                        </select>
                      </div>
                      <textarea
                        value={feedbackByQuestion[answer.questionIndex] || ''}
                        onChange={(e) => setFeedbackByQuestion(prev => ({ ...prev, [answer.questionIndex]: e.target.value }))}
                        placeholder="Tell us what's unclear or incorrect..."
                        rows={2}
                        className="w-full text-xs px-3 py-2 bg-white/10 border border-white/20 rounded-lg focus:border-secondary focus:outline-none"
                        disabled={feedbackSent[answer.questionIndex]}
                      />
                      <div className="mt-2 flex items-center justify-between">
                        <span className="text-xs text-white/40">Feedback goes to backend logs</span>
                        <button
                          onClick={() => handleSubmitFeedback(answer.questionIndex, answer.selected)}
                          disabled={feedbackSent[answer.questionIndex] || feedbackSending === answer.questionIndex}
                          className="px-3 py-1 text-xs font-semibold rounded-lg bg-white/20 hover:bg-white/30 disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                          {feedbackSent[answer.questionIndex] ? 'Sent' : feedbackSending === answer.questionIndex ? 'Sending...' : 'Send'}
                        </button>
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          </details>

          <div className="flex flex-col gap-3">
            <button
              onClick={playAgain}
              className="w-full py-4 px-8 text-xl font-bold rounded-2xl bg-gradient-to-r from-yellow-500 to-orange-500 hover:from-yellow-400 hover:to-orange-400 transition-all hover:scale-105 active:scale-95"
            >
              🔄 Play Again
            </button>
            
            <button
              onClick={restartGame}
              className="w-full py-3 px-8 font-medium rounded-2xl bg-white/10 hover:bg-white/20 transition-all"
            >
              📝 New Quiz
            </button>
            
            <Link
              to="/"
              className="w-full py-3 px-8 font-medium rounded-2xl border border-white/30 hover:bg-white/10 transition-all text-center"
            >
              🏠 Home
            </Link>
          </div>
        </div>
      </div>
    )
  }

  return null
}
