import { useEffect, useState } from 'react'
import { useTheme } from '../context/ThemeContext'

export default function Settings() {
  const { theme, lockTheme, intensity, applyTheme, setLockTheme, setIntensity } = useTheme()
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

  return (
    <div className="min-h-screen p-6 max-w-lg mx-auto">
      <div className="text-center mb-8">
        <h1 className="text-3xl font-bold">Settings</h1>
        <p className="text-white/60 mt-2">Customize your experience</p>
      </div>

      <div className="space-y-4">
        <label className="flex items-center justify-between rounded-2xl bg-white/10 border border-white/20 px-4 py-4">
          <div>
            <p className="font-semibold">Lock Theme</p>
            <p className="text-sm text-white/50">Keep the current theme unless you unlock</p>
          </div>
          <input
            type="checkbox"
            checked={lockTheme}
            onChange={(e) => setLockTheme(e.target.checked)}
            className="h-5 w-5 accent-primary"
          />
        </label>

        <label className="flex items-center justify-between rounded-2xl bg-white/10 border border-white/20 px-4 py-4">
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

        <label className="flex items-center justify-between rounded-2xl bg-white/10 border border-white/20 px-4 py-4">
          <div>
            <p className="font-semibold">Reduce Motion</p>
            <p className="text-sm text-white/50">Use fewer animations</p>
          </div>
          <input
            type="checkbox"
            checked={reduceMotion}
            onChange={(e) => setReduceMotion(e.target.checked)}
            className="h-5 w-5 accent-primary"
          />
        </label>

        <label className="flex items-center justify-between rounded-2xl bg-white/10 border border-white/20 px-4 py-4">
          <div>
            <p className="font-semibold">Show Hints</p>
            <p className="text-sm text-white/50">Show helper text in menus</p>
          </div>
          <input
            type="checkbox"
            checked={showHints}
            onChange={(e) => setShowHints(e.target.checked)}
            className="h-5 w-5 accent-primary"
          />
        </label>
      </div>
    </div>
  )
}
