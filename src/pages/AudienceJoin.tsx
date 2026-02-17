import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useConfig } from '../context/ConfigContext'
import { ApiClient } from '../api/client'
import { setLastSession } from '../utils/sessionResume'

export default function AudienceJoin() {
  const { code: urlCode } = useParams<{ code: string }>()
  const config = useConfig()
  const navigate = useNavigate()
  
  const [code, setCode] = useState(urlCode || '')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const api = new ApiClient(config.apiBaseUrl)

  useEffect(() => {
    if (urlCode) {
      setCode(urlCode)
    }
  }, [urlCode])

  const handleJoin = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!code.trim()) return

    setLoading(true)
    setError(null)
    
    try {
      const result = await api.observeSession(code.toUpperCase())
      sessionStorage.setItem(`observer_${code.toUpperCase()}`, result.observerId)
      setLastSession('observer', code.toUpperCase())
      navigate(`/audience/${code.toUpperCase()}`)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to join as observer')
    }
    setLoading(false)
  }

  return (
    <div className="h-[100dvh] flex flex-col items-center justify-center px-5 py-3 sm:p-6">
      <div className="w-full max-w-md animate-slide-up">
        <h1 className="text-3xl sm:text-4xl font-bold mb-2 text-center tracking-tight">Watch Game</h1>
        <p className="text-white/60 text-center text-base mb-8">
          Spectate without playing
        </p>

        <form onSubmit={handleJoin} className="space-y-6">
          <div>
            <label className="block text-white/60 text-sm mb-2">Game Code</label>
            <input
              type="text"
              value={code}
              onChange={(e) => setCode(e.target.value.toUpperCase())}
              placeholder="Enter code"
              maxLength={6}
              className="w-full px-4 py-4 text-2xl font-mono text-center tracking-widest bg-white/10 border border-white/15 rounded-xl focus:outline-none focus:border-slate-500 uppercase placeholder:text-white/30"
              autoFocus
            />
          </div>

          {error && (
            <div className="p-4 bg-red-500/20 border border-red-500 rounded-lg text-red-300">
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={loading || code.length < 4}
            className="w-full py-4 px-8 text-xl font-semibold rounded-xl bg-slate-600/60 border border-slate-500/40 hover:bg-slate-600/80 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading ? 'Connecting...' : 'Watch'}
          </button>
        </form>

        <div className="mt-8 text-center text-white/40 text-sm">
          <p>See live leaderboard and answer statistics</p>
        </div>
      </div>
    </div>
  )
}
