import { useEffect, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { useTheme } from '../context/ThemeContext'
import { useDevMode } from '../context/DevModeContext'

export default function Settings() {
  const navigate = useNavigate()
  const location = useLocation()
  const fromPath = (location.state as { from?: string })?.from
  const {
    theme,
    lockTheme,
    intensity,
    experimentalTheme,
    applyTheme,
    applyPreset,
    setLockTheme,
    setIntensity,
    setExperimentalTheme
  } = useTheme()
  const { devMode, setDevMode } = useDevMode()
  const [reduceMotion, setReduceMotion] = useState(false)
  const [showHints, setShowHints] = useState(true)

  useEffect(() => {
    const storedReduceMotion = localStorage.getItem('pref_reduce_motion') === 'true'
    const storedHints = localStorage.getItem('pref_show_hints') !== 'false'
    setReduceMotion(storedReduceMotion)
    setShowHints(storedHints)
  }, [])

  useEffect(() => {
    localStorage.setItem('pref_reduce_motion', String(reduceMotion))
    applyTheme(theme, false)
  }, [reduceMotion, theme, applyTheme])

  useEffect(() => {
    localStorage.setItem('pref_show_hints', String(showHints))
  }, [showHints])

  const handleBack = () => {
    if (fromPath) {
      navigate(fromPath)
    } else {
      navigate(-1)
    }
  }

  return (
    <div className="min-h-[100dvh] px-4 pt-16 pb-6 sm:px-6 sm:pt-16 sm:pb-6 max-w-lg mx-auto">
      <div className="mb-8">
        <button
          onClick={handleBack}
          className="inline-flex items-center gap-2 text-white/70 hover:text-white transition-colors mb-4"
        >
          <svg xmlns="http://www.w3.org/2000/svg" className="w-5 h-5" viewBox="0 0 20 20" fill="currentColor">
            <path fillRule="evenodd" d="M9.707 16.707a1 1 0 01-1.414 0l-6-6a1 1 0 010-1.414l6-6a1 1 0 011.414 1.414L5.414 9H17a1 1 0 110 2H5.414l4.293 4.293a1 1 0 010 1.414z" clipRule="evenodd" />
          </svg>
          <span className="text-sm font-medium">Back</span>
        </button>
        <div className="text-center">
          <h1 className="text-3xl sm:text-4xl font-bold tracking-tight">Settings</h1>
          <p className="text-white/60 text-base mt-2">Customize your experience</p>
        </div>
      </div>

      <div className="space-y-4">
        <div className="rounded-xl bg-white/10 border border-white/20 px-4 py-4">
          <div className="mb-3">
            <p className="font-semibold">Visual Theme</p>
            <p className="text-sm text-white/50">Choose your interface style</p>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <button
              onClick={() => applyPreset('terminal')}
              className={`px-4 py-3 rounded-lg border-2 text-left transition-all ${
                theme.themeId === 'terminal'
                  ? 'border-primary bg-primary/10'
                  : 'border-white/20 bg-white/5 hover:bg-white/10'
              }`}
            >
              <div className="font-semibold text-sm">Terminal</div>
              <div className="text-xs text-white/60 mt-0.5">Retro green phosphor</div>
            </button>
            <button
              onClick={() => applyPreset('classic')}
              className={`px-4 py-3 rounded-lg border-2 text-left transition-all ${
                theme.themeId === 'classic'
                  ? 'border-primary bg-primary/10'
                  : 'border-white/20 bg-white/5 hover:bg-white/10'
              }`}
            >
              <div className="font-semibold text-sm">Classic</div>
              <div className="text-xs text-white/60 mt-0.5">Slate blue</div>
            </button>
          </div>
        </div>

        <label className="flex items-center justify-between rounded-xl bg-white/10 border border-white/20 px-4 py-4">
          <div>
            <p className="font-semibold">Experimental Theme Generation</p>
            <p className="text-sm text-white/50">Let AI apply theme tokens for new quizzes</p>
          </div>
          <input
            type="checkbox"
            checked={experimentalTheme}
            onChange={(e) => setExperimentalTheme(e.target.checked)}
            className="h-5 w-5 accent-slate-500"
          />
        </label>

        <label className="flex items-center justify-between rounded-xl bg-white/10 border border-white/20 px-4 py-4">
          <div>
            <p className="font-semibold">Lock Theme</p>
            <p className="text-sm text-white/50">Keep the current theme unless you unlock</p>
          </div>
          <input
            type="checkbox"
            checked={lockTheme}
            onChange={(e) => setLockTheme(e.target.checked)}
            className="h-5 w-5 accent-slate-500"
          />
        </label>

        <label className="flex items-center justify-between rounded-xl bg-white/10 border border-white/20 px-4 py-4">
          <div>
            <p className="font-semibold">Theme Intensity</p>
            <p className="text-sm text-white/50">Subtle or bold styling</p>
          </div>
          <select
            value={intensity}
            onChange={(e) => setIntensity(e.target.value as 'subtle' | 'strong')}
            className="bg-white/10 border border-white/20 rounded-lg px-3 py-2 text-sm"
          >
            <option value="subtle">Subtle</option>
            <option value="strong">Strong</option>
          </select>
        </label>

        <label className="flex items-center justify-between rounded-xl bg-white/10 border border-white/20 px-4 py-4">
          <div>
            <p className="font-semibold">Reduce Motion</p>
            <p className="text-sm text-white/50">Use fewer animations</p>
          </div>
          <input
            type="checkbox"
            checked={reduceMotion}
            onChange={(e) => setReduceMotion(e.target.checked)}
            className="h-5 w-5 accent-slate-500"
          />
        </label>

        <label className="flex items-center justify-between rounded-xl bg-white/10 border border-white/20 px-4 py-4">
          <div>
            <p className="font-semibold">Show Hints</p>
            <p className="text-sm text-white/50">Show helper text in menus</p>
          </div>
          <input
            type="checkbox"
            checked={showHints}
            onChange={(e) => setShowHints(e.target.checked)}
            className="h-5 w-5 accent-slate-500"
          />
        </label>

        <label className="flex items-center justify-between rounded-xl bg-amber-900/10 border border-amber-800/20 px-4 py-4">
          <div>
            <p className="font-semibold text-amber-300/70">Dev Mode</p>
            <p className="text-sm text-white/50">Show verbose console output in an on-screen overlay</p>
          </div>
          <input
            type="checkbox"
            checked={devMode}
            onChange={(e) => setDevMode(e.target.checked)}
            className="h-5 w-5 accent-amber-400"
          />
        </label>
      </div>
    </div>
  )
}
