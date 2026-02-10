import { useEffect, useState } from 'react'

export default function Settings() {
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
  }, [reduceMotion])

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
