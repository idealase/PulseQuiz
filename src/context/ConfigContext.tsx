import { createContext, useContext, useEffect, useState, ReactNode } from 'react'

interface Config {
  apiBaseUrl: string
}

const ConfigContext = createContext<Config | null>(null)

export function ConfigProvider({ children }: { children: ReactNode }) {
  const [config, setConfig] = useState<Config | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    // Try to load config.json from public folder
    const basePath = import.meta.env.BASE_URL || '/'
    fetch(`${basePath}config.json`)
      .then(res => {
        if (!res.ok) throw new Error('Failed to load config')
        return res.json()
      })
      .then(data => {
        setConfig(data)
      })
      .catch(err => {
        console.error('Config load error:', err)
        // Fallback to localhost for development
        setConfig({ apiBaseUrl: 'http://localhost:8000' })
      })
  }, [])

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4">
        <div className="bg-red-500/20 border border-red-500 rounded-lg p-6 max-w-md">
          <h2 className="text-xl font-bold text-red-400 mb-2">Configuration Error</h2>
          <p className="text-white/80">{error}</p>
        </div>
      </div>
    )
  }

  if (!config) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-pulse text-xl">Loading...</div>
      </div>
    )
  }

  return (
    <ConfigContext.Provider value={config}>
      {children}
    </ConfigContext.Provider>
  )
}

export function useConfig(): Config {
  const config = useContext(ConfigContext)
  if (!config) {
    throw new Error('useConfig must be used within ConfigProvider')
  }
  return config
}
