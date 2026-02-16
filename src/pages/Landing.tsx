import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { useConfig } from '../context/ConfigContext'
import { useTheme } from '../context/ThemeContext'
import { getResumeInfo } from '../utils/sessionResume'

export default function Landing() {
  const config = useConfig()
  const { resetToDefault } = useTheme()
  const resumeInfo = getResumeInfo()
  const [showHelp, setShowHelp] = useState(false)

  // Reset theme to default when returning to the landing page
  useEffect(() => {
    resetToDefault()
  }, [resetToDefault])
  const resumeLabel = resumeInfo
    ? `${resumeInfo.role === 'host' ? 'Resume Host' : resumeInfo.role === 'player' ? 'Resume Play' : 'Resume Watch'} (${resumeInfo.code})`
    : null
  
  return (
    <div className="h-[100dvh] flex flex-col items-center justify-center px-5 py-3 sm:p-6 overflow-hidden">
      <div className="text-center mb-5 sm:mb-8 animate-slide-up">
        <h1 className="text-5xl sm:text-6xl md:text-7xl font-black mb-2 sm:mb-4 bg-gradient-to-r from-primary to-secondary bg-clip-text text-transparent">
          PulseQuiz
        </h1>
        <p className="text-white/60 text-base sm:text-lg md:text-xl">
          Real-time team quiz battles{config.customMessage && ` — ${config.customMessage}`}
        </p>
      </div>

      <div className="flex flex-col gap-3 sm:gap-4 w-full max-w-md animate-slide-up" style={{ animationDelay: '0.1s' }}>
        <Link
          to="/solo"
          className="block w-full py-3.5 sm:py-4 px-6 sm:px-8 text-lg sm:text-xl font-bold text-center rounded-2xl bg-gradient-to-r from-yellow-500 to-orange-500 hover:from-yellow-400 hover:to-orange-400 transition-all duration-300 shadow-lg hover:shadow-orange-500/40 hover:scale-105 active:scale-95"
        >
          🎯 Solo Mode
        </Link>

        <Link
          to="/host"
          className="block w-full py-3.5 sm:py-4 px-6 sm:px-8 text-lg sm:text-xl font-bold text-center rounded-2xl bg-gradient-to-r from-primary to-indigo-500 hover:from-indigo-600 hover:to-primary transition-all duration-300 shadow-lg hover:shadow-primary/50 hover:scale-105 active:scale-95"
        >
          Start Game
        </Link>

        <Link
          to="/join"
          className="block w-full py-3.5 sm:py-4 px-6 sm:px-8 text-lg sm:text-xl font-bold text-center rounded-2xl bg-white/10 border-2 border-white/30 hover:bg-white/20 hover:border-white/50 transition-all duration-300 hover:scale-105 active:scale-95"
        >
          Join Game
        </Link>
        
        {resumeInfo && resumeLabel && (
          <Link
            to={resumeInfo.path}
            className="block w-full py-3 sm:py-3.5 px-6 sm:px-8 text-base sm:text-lg font-semibold text-center rounded-2xl bg-emerald-500/20 border border-emerald-500/50 hover:bg-emerald-500/30 hover:border-emerald-400 text-emerald-200 transition-all duration-300 hover:scale-105 active:scale-95"
          >
            {resumeLabel}
          </Link>
        )}

        <Link
          to="/watch"
          className="block w-full py-3 sm:py-3.5 px-6 sm:px-8 text-base sm:text-lg font-medium text-center rounded-2xl bg-purple-500/20 border border-purple-500/50 hover:bg-purple-500/30 hover:border-purple-500 text-purple-300 transition-all duration-300 hover:scale-105 active:scale-95"
        >
          👀 Watch Game
        </Link>
        
      </div>

      {/* Help Guide Toggle */}
      <button
        onClick={() => setShowHelp(!showHelp)}
        className="mt-4 sm:mt-6 text-white/50 hover:text-white/80 text-sm font-medium transition-colors duration-200 flex items-center gap-1.5"
      >
        <span>{showHelp ? '▾' : '▸'}</span> How does PulseQuiz work?
      </button>

      {/* Help Guide */}
      {showHelp && (
        <div className="mt-3 w-full max-w-md sm:max-w-lg animate-slide-up text-left space-y-4 bg-white/5 border border-white/10 rounded-2xl p-4 sm:p-6 max-h-[40vh] overflow-y-auto">
          <div>
            <h3 className="text-white font-bold text-base mb-1.5">🎯 Solo Mode</h3>
            <p className="text-white/60 text-sm leading-relaxed">
              Play on your own. Import a CSV question file or enter topics and let the <strong className="text-white/80">AI generate questions</strong> for you instantly. Great for practice or studying.
            </p>
          </div>

          <div>
            <h3 className="text-white font-bold text-base mb-1.5">🎮 Hosting a Game</h3>
            <p className="text-white/60 text-sm leading-relaxed">
              Click <strong className="text-white/80">Start Game</strong> to create a session and get a code. Share the code with your players.
              Load questions via CSV upload or <strong className="text-white/80">AI generation</strong> — just type your topics and the AI builds the quiz.
              Enable <strong className="text-white/80">Dynamic Mode</strong> to let the AI auto-adjust difficulty based on player performance between rounds.
              You can also <strong className="text-white/80">generate an AI theme</strong> to match your quiz's topic with custom colors and effects.
            </p>
          </div>

          <div>
            <h3 className="text-white font-bold text-base mb-1.5">🙋 Joining a Game</h3>
            <p className="text-white/60 text-sm leading-relaxed">
              Click <strong className="text-white/80">Join Game</strong>, enter the session code and your nickname, then wait for the host to start. Answer each question before the timer runs out.
            </p>
          </div>

          <div>
            <h3 className="text-white font-bold text-base mb-1.5">⚔️ Challenge System</h3>
            <p className="text-white/60 text-sm leading-relaxed">
              Think an answer is wrong? After reveal, players can <strong className="text-white/80">challenge</strong> any question.
              The host can request an <strong className="text-white/80">AI verification</strong> that fact-checks the question and returns a verdict with a confidence score and rationale.
              If upheld, the host can void the question, award everyone points, or accept multiple answers — with a full audit trail.
            </p>
          </div>

          <div>
            <h3 className="text-white font-bold text-base mb-1.5">👀 Watch Mode</h3>
            <p className="text-white/60 text-sm leading-relaxed">
              Spectate a live game without playing. See questions, the leaderboard, and results in real time.
            </p>
          </div>
        </div>
      )}

      <div className="mt-4 sm:mt-8 text-white/40 text-xs sm:text-sm text-center">
        <p>Made for quiz night fun 🎉</p>
      </div>
    </div>
  )
}
