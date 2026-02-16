import { useEffect } from 'react'
import { Link } from 'react-router-dom'
import { useConfig } from '../context/ConfigContext'
import { useTheme } from '../context/ThemeContext'
import { getResumeInfo } from '../utils/sessionResume'

export default function Landing() {
  const config = useConfig()
  const { resetToDefault } = useTheme()
  const resumeInfo = getResumeInfo()

  // Reset theme to default when returning to the landing page
  useEffect(() => {
    resetToDefault()
  }, [resetToDefault])
  const resumeLabel = resumeInfo
    ? `${resumeInfo.role === 'host' ? 'Resume Host' : resumeInfo.role === 'player' ? 'Resume Play' : 'Resume Watch'} (${resumeInfo.code})`
    : null
  
  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-6">
      <div className="text-center mb-12 animate-slide-up">
        <h1 className="text-5xl md:text-7xl font-black mb-4 bg-gradient-to-r from-primary to-secondary bg-clip-text text-transparent">
          PulseQuiz
        </h1>
        <p className="text-white/60 text-lg md:text-xl">
          Real-time team quiz battles{config.customMessage && ` — ${config.customMessage}`}
        </p>
      </div>

      <div className="flex flex-col gap-4 w-full max-w-xs animate-slide-up" style={{ animationDelay: '0.1s' }}>
        <Link
          to="/solo"
          className="block w-full py-4 px-8 text-xl font-bold text-center rounded-2xl bg-gradient-to-r from-yellow-500 to-orange-500 hover:from-yellow-400 hover:to-orange-400 transition-all duration-300 shadow-lg hover:shadow-orange-500/40 hover:scale-105 active:scale-95"
        >
          🎯 Solo Mode
        </Link>

        <Link
          to="/host"
          className="block w-full py-4 px-8 text-xl font-bold text-center rounded-2xl bg-gradient-to-r from-primary to-indigo-500 hover:from-indigo-600 hover:to-primary transition-all duration-300 shadow-lg hover:shadow-primary/50 hover:scale-105 active:scale-95"
        >
          Start Game
        </Link>

        <Link
          to="/join"
          className="block w-full py-4 px-8 text-xl font-bold text-center rounded-2xl bg-white/10 border-2 border-white/30 hover:bg-white/20 hover:border-white/50 transition-all duration-300 hover:scale-105 active:scale-95"
        >
          Join Game
        </Link>
        
        {resumeInfo && resumeLabel && (
          <Link
            to={resumeInfo.path}
            className="block w-full py-3 px-8 text-lg font-semibold text-center rounded-2xl bg-emerald-500/20 border border-emerald-500/50 hover:bg-emerald-500/30 hover:border-emerald-400 text-emerald-200 transition-all duration-300 hover:scale-105 active:scale-95"
          >
            {resumeLabel}
          </Link>
        )}

        <Link
          to="/watch"
          className="block w-full py-3 px-8 text-lg font-medium text-center rounded-2xl bg-purple-500/20 border border-purple-500/50 hover:bg-purple-500/30 hover:border-purple-500 text-purple-300 transition-all duration-300 hover:scale-105 active:scale-95"
        >
          👀 Watch Game
        </Link>
        
      </div>

      <div className="mt-12 text-white/40 text-sm text-center">
        <p>Made for quiz night fun 🎉</p>
      </div>
    </div>
  )
}
