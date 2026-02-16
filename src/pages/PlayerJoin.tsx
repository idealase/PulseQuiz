import { useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useConfig } from '../context/ConfigContext'
import { ApiClient } from '../api/client'
import { setLastSession } from '../utils/sessionResume'

export default function PlayerJoin() {
  const { code: urlCode } = useParams<{ code: string }>()
  const config = useConfig()
  const navigate = useNavigate()
  
  const [code, setCode] = useState(urlCode || '')
  const [nickname, setNickname] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const api = new ApiClient(config.apiBaseUrl)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    
    if (!code.trim() || !nickname.trim()) {
      setError('Please enter both code and nickname')
      return
    }

    setLoading(true)
    setError(null)
    
    try {
      const result = await api.joinSession(code.toUpperCase(), nickname.trim())
      // Store player ID
      sessionStorage.setItem(`player_${code.toUpperCase()}`, result.playerId)
      sessionStorage.setItem(`nickname_${code.toUpperCase()}`, nickname.trim())
      setLastSession('player', code.toUpperCase())
      navigate(`/play/${code.toUpperCase()}`)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to join session')
    }
    
    setLoading(false)
  }

  return (
    <div className="h-[100dvh] flex flex-col items-center justify-center px-4 py-3 sm:p-6">
      <div className="w-full max-w-sm animate-slide-up">
        <h1 className="text-3xl font-bold text-center mb-8">Join Game</h1>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-white/60 text-sm mb-2">Session Code</label>
            <input
              type="text"
              value={code}
              onChange={(e) => setCode(e.target.value.toUpperCase())}
              placeholder="ABC123"
              maxLength={6}
              className="w-full px-4 py-4 text-2xl font-mono text-center tracking-widest rounded-xl bg-white/10 border-2 border-white/20 focus:border-primary focus:outline-none transition-colors uppercase"
              autoComplete="off"
              autoFocus={!urlCode}
            />
          </div>

          <div>
            <label className="block text-white/60 text-sm mb-2">Your Nickname</label>
            <input
              type="text"
              value={nickname}
              onChange={(e) => setNickname(e.target.value)}
              placeholder="Enter nickname"
              maxLength={20}
              className="w-full px-4 py-4 text-xl rounded-xl bg-white/10 border-2 border-white/20 focus:border-primary focus:outline-none transition-colors"
              autoComplete="off"
              autoFocus={!!urlCode}
            />
          </div>

          {error && (
            <div className="p-4 bg-red-500/20 border border-red-500 rounded-lg text-red-300 text-center">
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={loading || !code.trim() || !nickname.trim()}
            className="w-full py-4 px-8 text-xl font-bold rounded-2xl bg-gradient-to-r from-primary to-indigo-500 hover:from-indigo-600 hover:to-primary transition-all disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading ? 'Joining...' : 'Join'}
          </button>
        </form>
      </div>
    </div>
  )
}
