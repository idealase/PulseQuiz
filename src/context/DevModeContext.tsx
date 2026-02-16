import { createContext, ReactNode, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react'

export interface DevLogEntry {
  id: number
  level: 'log' | 'warn' | 'error' | 'info' | 'debug'
  timestamp: number
  args: string
}

interface DevModeContextValue {
  devMode: boolean
  setDevMode: (value: boolean) => void
  logs: DevLogEntry[]
  clearLogs: () => void
}

const DevModeContext = createContext<DevModeContextValue | null>(null)

const STORAGE_KEY = 'pref_dev_mode'
const MAX_LOGS = 500

export function DevModeProvider({ children }: { children: ReactNode }) {
  const [devMode, setDevModeState] = useState(() => localStorage.getItem(STORAGE_KEY) === 'true')
  const [logs, setLogs] = useState<DevLogEntry[]>([])
  const nextId = useRef(0)
  const originalsRef = useRef<{
    log: typeof console.log
    warn: typeof console.warn
    error: typeof console.error
    info: typeof console.info
    debug: typeof console.debug
  } | null>(null)

  const pushLog = useCallback((level: DevLogEntry['level'], args: unknown[]) => {
    const formatted = args
      .map(a => {
        if (typeof a === 'string') return a
        try { return JSON.stringify(a, null, 2) } catch { return String(a) }
      })
      .join(' ')

    setLogs(prev => {
      const entry: DevLogEntry = { id: nextId.current++, level, timestamp: Date.now(), args: formatted }
      const next = [...prev, entry]
      return next.length > MAX_LOGS ? next.slice(next.length - MAX_LOGS) : next
    })
  }, [])

  useEffect(() => {
    if (!devMode) {
      // Restore originals if we patched
      if (originalsRef.current) {
        console.log = originalsRef.current.log
        console.warn = originalsRef.current.warn
        console.error = originalsRef.current.error
        console.info = originalsRef.current.info
        console.debug = originalsRef.current.debug
        originalsRef.current = null
      }
      return
    }

    // Save originals
    const origLog = console.log
    const origWarn = console.warn
    const origError = console.error
    const origInfo = console.info
    const origDebug = console.debug
    originalsRef.current = { log: origLog, warn: origWarn, error: origError, info: origInfo, debug: origDebug }

    console.log = (...args: unknown[]) => { origLog.apply(console, args); pushLog('log', args) }
    console.warn = (...args: unknown[]) => { origWarn.apply(console, args); pushLog('warn', args) }
    console.error = (...args: unknown[]) => { origError.apply(console, args); pushLog('error', args) }
    console.info = (...args: unknown[]) => { origInfo.apply(console, args); pushLog('info', args) }
    console.debug = (...args: unknown[]) => { origDebug.apply(console, args); pushLog('debug', args) }

    return () => {
      console.log = origLog
      console.warn = origWarn
      console.error = origError
      console.info = origInfo
      console.debug = origDebug
      originalsRef.current = null
    }
  }, [devMode, pushLog])

  const setDevMode = useCallback((value: boolean) => {
    setDevModeState(value)
    localStorage.setItem(STORAGE_KEY, String(value))
  }, [])

  const clearLogs = useCallback(() => setLogs([]), [])

  const value = useMemo(() => ({ devMode, setDevMode, logs, clearLogs }), [devMode, setDevMode, logs, clearLogs])

  return <DevModeContext.Provider value={value}>{children}</DevModeContext.Provider>
}

export function useDevMode() {
  const ctx = useContext(DevModeContext)
  if (!ctx) throw new Error('useDevMode must be used within DevModeProvider')
  return ctx
}
