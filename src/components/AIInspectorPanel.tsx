import { useState } from 'react'
import { useAITelemetry, AICallRecord } from '../context/AITelemetryContext'

function formatMs(ms: number): string {
  if (ms < 1000) return `${ms}ms`
  return `${(ms / 1000).toFixed(1)}s`
}

function TokenBadge({ value, estimated, label }: { value: number | null | undefined; estimated?: boolean; label: string }) {
  if (value == null || value === 0) return null
  return (
    <span className="inline-flex items-center gap-1 text-[10px] rounded px-1.5 py-0.5 bg-white/5 text-white/70">
      <span className="text-white/40">{label}</span>
      <span className="font-medium text-white/90">{value.toLocaleString()}</span>
      {estimated && <span className="text-yellow-400" title="Estimated (not from API)">~</span>}
    </span>
  )
}

function CallRow({ call }: { call: AICallRecord }) {
  const [expanded, setExpanded] = useState(false)
  const m = call.meta
  const usage = m.total_token_usage ?? m.token_usage
  const elapsed = m.total_elapsed_ms ?? m.elapsed_ms ?? 0
  const isMulti = (m.total_calls ?? 0) > 1

  return (
    <div className="border-b border-gray-800">
      <div
        className="flex items-center gap-2 px-3 py-1.5 cursor-pointer hover:bg-white/[0.03] text-xs"
        onClick={() => setExpanded(e => !e)}
      >
        <span className="text-gray-500 shrink-0 w-[60px]">
          {new Date(call.timestamp).toLocaleTimeString('en-US', { hour12: false, hour: '2-digit', minute: '2-digit', second: '2-digit' })}
        </span>
        <span className={`shrink-0 font-mono font-medium ${m.success === false ? 'text-red-400' : 'text-cyan-300'}`}>
          {call.label}
        </span>
        {isMulti && <span className="text-purple-300 text-[10px]">{m.total_calls} calls</span>}
        <span className="text-white/40 text-[10px]">{m.model}</span>
        <div className="flex-1" />
        <span className="text-green-300 text-[10px] font-mono">{formatMs(elapsed)}</span>
        <TokenBadge value={usage?.total_tokens} estimated={usage?.estimated} label="tok" />
        <span className="text-gray-600">{expanded ? '▼' : '▶'}</span>
      </div>
      {expanded && (
        <div className="bg-gray-950/50 px-4 py-2 text-[11px] space-y-1.5">
          <div className="grid grid-cols-2 gap-x-6 gap-y-1 text-white/60">
            <div>Model: <span className="text-white/90">{m.model ?? 'unknown'}</span></div>
            <div>Endpoint: <span className="text-white/90">{m.endpoint ?? call.label}</span></div>
            <div>Latency: <span className="text-green-300">{formatMs(elapsed)}</span></div>
            <div>Success: <span className={m.success === false ? 'text-red-400' : 'text-green-400'}>{m.success === false ? 'FAIL' : 'OK'}</span></div>
            <div>Prompt chars: <span className="text-white/90">{(m.prompt_chars ?? 0).toLocaleString()}</span></div>
            <div>Response chars: <span className="text-white/90">{(m.response_chars ?? 0).toLocaleString()}</span></div>
          </div>
          {usage && (
            <div className="flex gap-3 mt-1">
              <TokenBadge value={usage.prompt_tokens} estimated={usage.estimated} label="prompt" />
              <TokenBadge value={usage.completion_tokens} estimated={usage.estimated} label="completion" />
              <TokenBadge value={usage.total_tokens} estimated={usage.estimated} label="total" />
              {usage.ratelimit_remaining_tokens != null && (
                <TokenBadge value={usage.ratelimit_remaining_tokens} label="rl-remaining" />
              )}
            </div>
          )}
          {m.error && <div className="text-red-400 mt-1">Error: {m.error}</div>}
          {m.timestamp && <div className="text-white/30 mt-1">Server time: {m.timestamp}</div>}
          {isMulti && m.calls && (
            <div className="mt-2 border-t border-gray-800 pt-1.5">
              <div className="text-white/40 text-[10px] mb-1">Sub-calls:</div>
              {m.calls.map((sub, i) => (
                <div key={i} className="flex gap-3 text-[10px] text-white/50 ml-2">
                  <span className="text-cyan-400">{sub.endpoint}</span>
                  <span>{formatMs(sub.elapsed_ms ?? 0)}</span>
                  <TokenBadge value={sub.token_usage?.total_tokens} estimated={sub.token_usage?.estimated} label="tok" />
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  )
}

function SystemInfoPanel() {
  const { devInfo, devInfoLoading, refreshDevInfo, tokenSummary, tokenSummaryLoading, refreshTokenSummary } = useAITelemetry()

  return (
    <div className="p-3 text-xs space-y-3 overflow-y-auto" style={{ maxHeight: '25vh' }}>
      {/* Backend system info */}
      <div>
        <div className="flex items-center justify-between mb-1">
          <span className="text-white/50 uppercase tracking-wider text-[10px]">Backend System</span>
          <button onClick={refreshDevInfo} disabled={devInfoLoading} className="text-[10px] text-cyan-400 hover:text-cyan-300 disabled:text-gray-600">
            {devInfoLoading ? 'loading...' : 'refresh'}
          </button>
        </div>
        {devInfo ? (
          <div className="grid grid-cols-2 gap-x-4 gap-y-0.5 text-white/60">
            <div>Copilot SDK: <span className={devInfo.copilot_sdk_available ? 'text-green-400' : 'text-red-400'}>{devInfo.copilot_sdk_available ? 'Available' : 'Not available'}</span></div>
            <div>Active model: <span className="text-cyan-300">{devInfo.active_model}</span></div>
            <div>CLI path: <span className="text-white/90 break-all">{devInfo.copilot_cli_path ?? 'not found'}</span></div>
            <div>Auth configured: <span className={devInfo.auth_configured ? 'text-green-400' : 'text-yellow-400'}>{devInfo.auth_configured ? 'Yes' : 'No (open)'}</span></div>
            <div>Active sessions: <span className="text-white/90">{devInfo.active_sessions}</span></div>
            <div>Python: <span className="text-white/90">{devInfo.python_version.split(' ')[0]}</span></div>
            {devInfo.copilot_module_info && (
              <div className="col-span-2 text-white/40 break-all">SDK: {devInfo.copilot_module_info}</div>
            )}
            <div className="col-span-2 text-white/40">Valid models: {devInfo.valid_models.join(', ')}</div>
          </div>
        ) : (
          <div className="text-gray-600">{devInfoLoading ? 'Fetching...' : 'No backend info available'}</div>
        )}
      </div>

      {/* Token usage summary from backend logs */}
      <div>
        <div className="flex items-center justify-between mb-1">
          <span className="text-white/50 uppercase tracking-wider text-[10px]">Backend Token Usage (24h)</span>
          <button onClick={() => refreshTokenSummary(24)} disabled={tokenSummaryLoading} className="text-[10px] text-cyan-400 hover:text-cyan-300 disabled:text-gray-600">
            {tokenSummaryLoading ? 'loading...' : 'refresh'}
          </button>
        </div>
        {tokenSummary ? (
          <div className="space-y-1">
            <div className="grid grid-cols-3 gap-x-4 gap-y-0.5 text-white/60">
              <div>Total calls: <span className="text-white/90 font-medium">{tokenSummary.total_calls}</span></div>
              <div>Successful: <span className="text-green-400">{tokenSummary.successful_calls}</span></div>
              <div>Failed: <span className={tokenSummary.failed_calls > 0 ? 'text-red-400' : 'text-white/40'}>{tokenSummary.failed_calls}</span></div>
              <div>Prompt tokens: <span className="text-white/90">{tokenSummary.total_prompt_tokens.toLocaleString()}</span></div>
              <div>Completion tokens: <span className="text-white/90">{tokenSummary.total_completion_tokens.toLocaleString()}</span></div>
              <div>Total tokens: <span className="text-cyan-300 font-medium">{tokenSummary.total_tokens.toLocaleString()}</span></div>
              <div>Avg latency: <span className="text-green-300">{formatMs(tokenSummary.avg_elapsed_ms)}</span></div>
              <div>Error rate: <span className={tokenSummary.error_rate_pct > 10 ? 'text-red-400' : 'text-white/90'}>{tokenSummary.error_rate_pct}%</span></div>
              <div>Models: <span className="text-white/90">{tokenSummary.models_used.join(', ')}</span></div>
            </div>
            {tokenSummary.endpoint_breakdown && Object.keys(tokenSummary.endpoint_breakdown).length > 0 && (
              <div className="mt-1">
                <span className="text-white/40 text-[10px]">By endpoint: </span>
                {Object.entries(tokenSummary.endpoint_breakdown).map(([ep, count]) => (
                  <span key={ep} className="inline-flex items-center gap-1 mr-2 text-[10px]">
                    <span className="text-cyan-400">{ep}</span>
                    <span className="text-white/60">x{count}</span>
                  </span>
                ))}
              </div>
            )}
            {tokenSummary.slowest_call && (
              <div className="text-white/40 text-[10px]">
                Slowest: {tokenSummary.slowest_call.endpoint} ({formatMs(tokenSummary.slowest_call.elapsed_ms)})
                {tokenSummary.fastest_call && <> | Fastest: {tokenSummary.fastest_call.endpoint} ({formatMs(tokenSummary.fastest_call.elapsed_ms)})</>}
              </div>
            )}
          </div>
        ) : (
          <div className="text-gray-600">{tokenSummaryLoading ? 'Fetching...' : 'No token data available'}</div>
        )}
      </div>
    </div>
  )
}

export default function AIInspectorPanel() {
  const { calls, clearCalls, sessionTotals } = useAITelemetry()
  const [tab, setTab] = useState<'calls' | 'system'>('calls')

  return (
    <div>
      {/* Tab bar + session totals */}
      <div className="flex items-center gap-2 px-3 py-1 border-b border-gray-800">
        {(['calls', 'system'] as const).map(t => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`px-2 py-0.5 rounded text-[10px] uppercase tracking-wider transition-colors ${
              tab === t
                ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/40'
                : 'text-gray-500 hover:text-gray-300'
            }`}
          >
            {t === 'calls' ? `Calls (${sessionTotals.totalCalls})` : 'System'}
          </button>
        ))}
        <div className="flex-1" />
        {sessionTotals.totalCalls > 0 && (
          <div className="flex gap-2 text-[10px] text-white/50">
            <span>
              <span className="text-cyan-300">{sessionTotals.totalTokens.toLocaleString()}</span>
              {sessionTotals.anyEstimated && <span className="text-yellow-400">~</span>} tok
            </span>
            <span className="text-green-300">{formatMs(sessionTotals.totalElapsedMs)}</span>
          </div>
        )}
        {tab === 'calls' && sessionTotals.totalCalls > 0 && (
          <button onClick={clearCalls} className="text-[10px] text-gray-500 hover:text-red-400 px-1">clear</button>
        )}
      </div>

      {/* Tab content */}
      {tab === 'calls' ? (
        <div className="overflow-y-auto" style={{ maxHeight: '25vh' }}>
          {calls.length === 0 ? (
            <div className="text-gray-600 text-center py-4 text-xs">
              No AI calls recorded yet.
              <br />
              <span className="text-gray-700">Generate questions, themes, or fact-check to see telemetry.</span>
            </div>
          ) : (
            [...calls].reverse().map(call => <CallRow key={call.id} call={call} />)
          )}
        </div>
      ) : (
        <SystemInfoPanel />
      )}
    </div>
  )
}
