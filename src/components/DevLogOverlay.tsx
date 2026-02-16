import { useEffect, useRef, useState } from 'react'
import { useDevMode, DevLogEntry } from '../context/DevModeContext'
import AIInspectorPanel from './AIInspectorPanel'

type OverlayTab = 'console' | 'ai'

const LEVEL_COLORS: Record<DevLogEntry['level'], string> = {
  log: 'text-green-300',
  info: 'text-blue-300',
  warn: 'text-yellow-300',
  error: 'text-red-400',
  debug: 'text-gray-400',
}

const LEVEL_BADGE: Record<DevLogEntry['level'], string> = {
  log: 'bg-green-800/60',
  info: 'bg-blue-800/60',
  warn: 'bg-yellow-800/60',
  error: 'bg-red-800/60',
  debug: 'bg-gray-700/60',
}

function formatTime(ts: number) {
  const d = new Date(ts)
  return d.toLocaleTimeString('en-US', { hour12: false, hour: '2-digit', minute: '2-digit', second: '2-digit' }) +
    '.' + String(d.getMilliseconds()).padStart(3, '0')
}

function ConsolePanel({ logs, clearLogs }: { logs: DevLogEntry[]; clearLogs: () => void }) {
  const [filter, setFilter] = useState<DevLogEntry['level'] | 'all'>('all')
  const scrollRef = useRef<HTMLDivElement>(null)
  const [autoScroll, setAutoScroll] = useState(true)

  useEffect(() => {
    if (autoScroll && scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight
    }
  }, [logs, autoScroll])

  const filtered = filter === 'all' ? logs : logs.filter(l => l.level === filter)

  const counts = { log: 0, warn: 0, error: 0, info: 0, debug: 0 }
  for (const l of logs) counts[l.level]++

  return (
    <>
      {/* Toolbar */}
      <div className="flex items-center gap-2 px-3 py-1 border-b border-gray-800">
        {(['all', 'log', 'info', 'warn', 'error', 'debug'] as const).map(lvl => (
          <button
            key={lvl}
            onClick={(e) => { e.stopPropagation(); setFilter(lvl) }}
            className={`px-2 py-0.5 rounded text-[10px] uppercase tracking-wider transition-colors ${
              filter === lvl
                ? 'bg-yellow-500/20 text-yellow-300 border border-yellow-500/40'
                : 'text-gray-500 hover:text-gray-300'
            }`}
          >
            {lvl}{lvl !== 'all' ? ` (${counts[lvl]})` : ''}
          </button>
        ))}
        <div className="flex-1" />
        <label className="flex items-center gap-1 text-gray-500 cursor-pointer">
          <input
            type="checkbox"
            checked={autoScroll}
            onChange={(e) => { e.stopPropagation(); setAutoScroll(e.target.checked) }}
            className="h-3 w-3"
          />
          auto-scroll
        </label>
        <button
          onClick={(e) => { e.stopPropagation(); clearLogs() }}
          className="text-gray-500 hover:text-red-400 px-2 py-0.5 rounded hover:bg-red-900/20 transition-colors"
        >
          clear
        </button>
      </div>

      {/* Scrollable log area */}
      <div
        ref={scrollRef}
        className="overflow-y-auto overflow-x-hidden"
        style={{ maxHeight: '30vh' }}
      >
        {filtered.length === 0 ? (
          <div className="text-gray-600 text-center py-6">
            No log entries{filter !== 'all' ? ` matching "${filter}"` : ''} yet.
            <br />
            <span className="text-gray-700">Console output will appear here in real time.</span>
          </div>
        ) : (
          filtered.map(entry => (
            <div
              key={entry.id}
              className="flex items-start gap-2 px-3 py-0.5 hover:bg-white/[0.02] border-b border-gray-900"
            >
              <span className="text-gray-600 shrink-0 w-[85px]">{formatTime(entry.timestamp)}</span>
              <span className={`shrink-0 w-[42px] text-center rounded px-1 ${LEVEL_BADGE[entry.level]} ${LEVEL_COLORS[entry.level]}`}>
                {entry.level.toUpperCase()}
              </span>
              <span className={`${LEVEL_COLORS[entry.level]} break-all whitespace-pre-wrap`}>
                {entry.args}
              </span>
            </div>
          ))
        )}
      </div>
    </>
  )
}

export default function DevLogOverlay() {
  const { devMode, logs, clearLogs } = useDevMode()
  const [collapsed, setCollapsed] = useState(false)
  const [activeTab, setActiveTab] = useState<OverlayTab>('console')

  if (!devMode) return null

  const counts = { log: 0, warn: 0, error: 0, info: 0, debug: 0 }
  for (const l of logs) counts[l.level]++

  return (
    <div
      className="fixed bottom-0 left-0 right-0 z-[9999] font-mono text-xs"
      style={{ pointerEvents: 'auto' }}
    >
      {/* Title bar */}
      <div
        className="flex items-center justify-between bg-gray-900/95 border-t border-yellow-500/50 px-3 py-1.5 cursor-pointer select-none backdrop-blur-sm"
        onClick={() => setCollapsed(c => !c)}
      >
        <div className="flex items-center gap-2">
          <span className="text-yellow-400 font-bold text-sm">⚙ DEV</span>
          {/* Tab switcher */}
          <button
            onClick={(e) => { e.stopPropagation(); setActiveTab('console'); setCollapsed(false) }}
            className={`px-2 py-0.5 rounded text-[10px] uppercase tracking-wider transition-colors ${
              activeTab === 'console' ? 'bg-yellow-500/20 text-yellow-300' : 'text-gray-500 hover:text-gray-300'
            }`}
          >
            Console ({logs.length})
          </button>
          <button
            onClick={(e) => { e.stopPropagation(); setActiveTab('ai'); setCollapsed(false) }}
            className={`px-2 py-0.5 rounded text-[10px] uppercase tracking-wider transition-colors ${
              activeTab === 'ai' ? 'bg-cyan-500/20 text-cyan-300' : 'text-gray-500 hover:text-gray-300'
            }`}
          >
            AI Inspector
          </button>
          {counts.error > 0 && <span className="text-red-400">{counts.error} err</span>}
          {counts.warn > 0 && <span className="text-yellow-300">{counts.warn} warn</span>}
        </div>
        <div className="flex items-center gap-2">
          <span className="text-gray-500">{collapsed ? '▲ expand' : '▼ collapse'}</span>
        </div>
      </div>

      {/* Panel content */}
      {!collapsed && (
        <div className="bg-gray-950/95 backdrop-blur-sm border-t border-gray-700/50">
          {activeTab === 'console' ? (
            <ConsolePanel logs={logs} clearLogs={clearLogs} />
          ) : (
            <AIInspectorPanel />
          )}
        </div>
      )}
    </div>
  )
}
