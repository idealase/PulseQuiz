import { createContext, ReactNode, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react'
import { AIMeta, DevInfo, TokenUsageSummary, ApiClient } from '../api/client'
import { useDevMode } from './DevModeContext'
import { useConfig } from './ConfigContext'

/** A single recorded AI call with timing + UI label */
export interface AICallRecord {
  id: number
  label: string          // e.g. "generate_questions", "generate_theme"
  timestamp: number
  meta: AIMeta
}

interface AITelemetryContextValue {
  /** All recorded AI calls (newest last) */
  calls: AICallRecord[]
  /** Record a new AI call from any page */
  recordCall: (label: string, meta: AIMeta) => void
  /** Clear all recorded calls */
  clearCalls: () => void

  /** Backend system info (fetched once when dev mode turns on) */
  devInfo: DevInfo | null
  devInfoLoading: boolean
  refreshDevInfo: () => void

  /** Aggregated token usage summary from backend logs */
  tokenSummary: TokenUsageSummary | null
  tokenSummaryLoading: boolean
  refreshTokenSummary: (hours?: number) => void

  /** Aggregated session totals from in-memory calls */
  sessionTotals: {
    totalCalls: number
    totalPromptTokens: number
    totalCompletionTokens: number
    totalTokens: number
    totalElapsedMs: number
    anyEstimated: boolean
  }
}

const AITelemetryContext = createContext<AITelemetryContextValue | null>(null)

const MAX_CALLS = 200

function sumTokenField(calls: AICallRecord[], field: 'prompt_tokens' | 'completion_tokens' | 'total_tokens'): number {
  return calls.reduce((sum, c) => {
    const usage = c.meta.total_token_usage ?? c.meta.token_usage
    return sum + (usage?.[field] ?? 0)
  }, 0)
}

export function AITelemetryProvider({ children }: { children: ReactNode }) {
  const { devMode } = useDevMode()
  const config = useConfig()

  const [calls, setCalls] = useState<AICallRecord[]>([])
  const nextId = useRef(0)

  const [devInfo, setDevInfo] = useState<DevInfo | null>(null)
  const [devInfoLoading, setDevInfoLoading] = useState(false)

  const [tokenSummary, setTokenSummary] = useState<TokenUsageSummary | null>(null)
  const [tokenSummaryLoading, setTokenSummaryLoading] = useState(false)

  const apiRef = useRef<ApiClient | null>(null)
  if (!apiRef.current) {
    apiRef.current = new ApiClient(config.apiBaseUrl)
  }

  const recordCall = useCallback((label: string, meta: AIMeta) => {
    setCalls(prev => {
      const entry: AICallRecord = { id: nextId.current++, label, timestamp: Date.now(), meta }
      const next = [...prev, entry]
      return next.length > MAX_CALLS ? next.slice(next.length - MAX_CALLS) : next
    })
  }, [])

  const clearCalls = useCallback(() => setCalls([]), [])

  const refreshDevInfo = useCallback(async () => {
    if (!apiRef.current) return
    setDevInfoLoading(true)
    try {
      const info = await apiRef.current.getDevInfo()
      setDevInfo(info)
    } catch {
      // Silently ignore fetch failures (backend might not be running)
    }
    setDevInfoLoading(false)
  }, [])

  const refreshTokenSummary = useCallback(async (hours = 24) => {
    if (!apiRef.current) return
    setTokenSummaryLoading(true)
    try {
      const summary = await apiRef.current.getTokenUsage(hours)
      setTokenSummary(summary)
    } catch {
      // Silently ignore
    }
    setTokenSummaryLoading(false)
  }, [])

  // Auto-fetch dev info/token summary when dev mode is enabled
  useEffect(() => {
    if (devMode) {
      refreshDevInfo()
      refreshTokenSummary()
    }
  }, [devMode, refreshDevInfo, refreshTokenSummary])

  const sessionTotals = useMemo(() => {
    const totalPromptTokens = sumTokenField(calls, 'prompt_tokens')
    const totalCompletionTokens = sumTokenField(calls, 'completion_tokens')
    const totalElapsedMs = calls.reduce((sum, c) => sum + (c.meta.total_elapsed_ms ?? c.meta.elapsed_ms ?? 0), 0)
    const anyEstimated = calls.some(c => {
      const usage = c.meta.total_token_usage ?? c.meta.token_usage
      return usage?.estimated === true
    })
    return {
      totalCalls: calls.length,
      totalPromptTokens,
      totalCompletionTokens,
      totalTokens: totalPromptTokens + totalCompletionTokens,
      totalElapsedMs,
      anyEstimated,
    }
  }, [calls])

  const value = useMemo(
    () => ({
      calls, recordCall, clearCalls,
      devInfo, devInfoLoading, refreshDevInfo,
      tokenSummary, tokenSummaryLoading, refreshTokenSummary,
      sessionTotals,
    }),
    [calls, recordCall, clearCalls, devInfo, devInfoLoading, refreshDevInfo, tokenSummary, tokenSummaryLoading, refreshTokenSummary, sessionTotals]
  )

  return <AITelemetryContext.Provider value={value}>{children}</AITelemetryContext.Provider>
}

export function useAITelemetry() {
  const ctx = useContext(AITelemetryContext)
  if (!ctx) throw new Error('useAITelemetry must be used within AITelemetryProvider')
  return ctx
}
