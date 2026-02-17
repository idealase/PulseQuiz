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

  useEffect(() => {
    resetToDefault()
  }, [resetToDefault])
  const resumeLabel = resumeInfo
    ? `${resumeInfo.role === 'host' ? 'Resume Host' : resumeInfo.role === 'player' ? 'Resume Play' : 'Resume Watch'} (${resumeInfo.code})`
    : null
  
  return (
    <div className="h-[100dvh] flex flex-col items-center justify-center px-5 py-3 sm:p-6 overflow-hidden">
      <div className="text-center mb-5 sm:mb-8 animate-slide-up">
        <h1 className="text-5xl sm:text-6xl md:text-7xl font-bold tracking-tight mb-2 sm:mb-4 text-white">
          PulseQuiz
        </h1>
        <p className="text-white/50 text-base sm:text-lg md:text-xl font-light">
          Real-time team quiz battles{config.customMessage && ` — ${config.customMessage}`}
        </p>
      </div>

      <div className="flex flex-col gap-3 sm:gap-3.5 w-full max-w-md animate-slide-up" style={{ animationDelay: '0.1s' }}>
        <Link
          to="/solo"
          className="block w-full py-3.5 sm:py-4 px-6 sm:px-8 text-lg sm:text-xl font-semibold text-center rounded-xl bg-slate-700/60 border border-slate-600/50 hover:bg-slate-700/80 hover:border-slate-500/60 transition-all shadow-sm hover:shadow-md active:scale-[0.98]"
        >
          Solo Mode
        </Link>

        <Link
          to="/host"
          className="block w-full py-3.5 sm:py-4 px-6 sm:px-8 text-lg sm:text-xl font-semibold text-center rounded-xl bg-slate-600/50 border border-slate-500/40 hover:bg-slate-600/70 hover:border-slate-400/50 text-white transition-all shadow-sm hover:shadow-md active:scale-[0.98]"
        >
          Start Game
        </Link>

        <Link
          to="/join"
          className="block w-full py-3.5 sm:py-4 px-6 sm:px-8 text-lg sm:text-xl font-semibold text-center rounded-xl bg-white/5 border border-white/15 hover:bg-white/10 hover:border-white/25 transition-all active:scale-[0.98]"
        >
          Join Game
        </Link>
        
        {resumeInfo && resumeLabel && (
          <Link
            to={resumeInfo.path}
            className="block w-full py-3 sm:py-3.5 px-6 sm:px-8 text-base sm:text-lg font-medium text-center rounded-xl bg-teal-900/30 border border-teal-700/30 hover:bg-teal-900/40 hover:border-teal-600/40 text-teal-300/80 transition-all active:scale-[0.98]"
          >
            {resumeLabel}
          </Link>
        )}

        <Link
          to="/watch"
          className="block w-full py-3 sm:py-3.5 px-6 sm:px-8 text-base sm:text-lg font-medium text-center rounded-xl bg-white/[0.03] border border-white/10 hover:bg-white/[0.06] hover:border-white/20 text-white/60 transition-all active:scale-[0.98]"
        >
          Watch Game
        </Link>
        
      </div>

      <button
        onClick={() => setShowHelp(!showHelp)}
        className="mt-4 sm:mt-6 text-white/40 hover:text-white/60 text-sm font-medium transition-colors duration-200 flex items-center gap-1.5"
      >
        <svg xmlns="http://www.w3.org/2000/svg" className={`w-3.5 h-3.5 transition-transform duration-200 ${showHelp ? 'rotate-90' : ''}`} viewBox="0 0 20 20" fill="currentColor">
          <path fillRule="evenodd" d="M7.293 14.707a1 1 0 010-1.414L10.586 10 7.293 6.707a1 1 0 011.414-1.414l4 4a1 1 0 010 1.414l-4 4a1 1 0 01-1.414 0z" clipRule="evenodd" />
        </svg>
        How does PulseQuiz work?
      </button>

      {showHelp && (
        <div className="mt-3 w-full max-w-md sm:max-w-lg animate-slide-up text-left space-y-4 bg-white/[0.03] border border-white/10 rounded-xl p-4 sm:p-6 max-h-[40vh] overflow-y-auto">
          <div>
            <h3 className="text-white/80 font-semibold text-sm tracking-wide uppercase mb-1.5">Solo Mode</h3>
            <p className="text-white/45 text-sm leading-relaxed">
              Play on your own. Import a CSV question file or enter topics and let the <strong className="text-white/65">AI generate questions</strong> for you instantly.
            </p>
          </div>
          <div>
            <h3 className="text-white/80 font-semibold text-sm tracking-wide uppercase mb-1.5">Hosting a Game</h3>
            <p className="text-white/45 text-sm leading-relaxed">
              Click <strong className="text-white/65">Start Game</strong> to create a session and share the code. Load questions via CSV or <strong className="text-white/65">AI generation</strong>.
            </p>
          </div>
          <div>
            <h3 className="text-white/80 font-semibold text-sm tracking-wide uppercase mb-1.5">Joining a Game</h3>
            <p className="text-white/45 text-sm leading-relaxed">
              Enter the session code and your nickname, then wait for the host to start.
            </p>
          </div>
          <div>
            <h3 className="text-white/80 font-semibold text-sm tracking-wide uppercase mb-1.5">Challenge System</h3>
            <p className="text-white/45 text-sm leading-relaxed">
              Players can <strong className="text-white/65">challenge</strong> any question after reveal. The host can request <strong className="text-white/65">AI verification</strong> with a confidence score.
            </p>
          </div>
          <div>
            <h3 className="text-white/80 font-semibold text-sm tracking-wide uppercase mb-1.5">Watch Mode</h3>
            <p className="text-white/45 text-sm leading-relaxed">
              Spectate a live game without playing. See questions, leaderboard, and results in real time.
            </p>
          </div>
        </div>
      )}

      <div className="mt-4 sm:mt-8 text-white/25 text-xs sm:text-sm text-center">
        <p>Made for quiz night fun</p>
      </div>
    </div>
  )
}
