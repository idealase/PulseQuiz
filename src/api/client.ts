import { Question, LiveLeaderboardEntry, QuestionStats, AnswerStatusWithNames, PerformanceData } from '../types'

interface CreateSessionRequest {
  timerMode?: boolean
  timerSeconds?: number
  autoProgressMode?: boolean
  autoProgressPercent?: number
}

interface CreateSessionResponse {
  code: string
  hostToken: string
}

interface JoinSessionResponse {
  playerId: string
}

interface ObserveSessionResponse {
  observerId: string
}

interface PollEvent {
  type: string
  _eventId?: number
  _timestamp?: number
  [key: string]: unknown
}

interface PollEventsResponse {
  events: PollEvent[]
  lastEventId: number
}

// --- AI Generation Types ---

interface GenerateQuestionsRequest {
  topics: string
  count?: number
  research_mode?: boolean
  difficulty?: 'easy' | 'medium' | 'hard' | 'mixed'
}

interface GenerateQuestionsResponse {
  questions: Question[]
  topics_clarified?: string
  generation_time_ms: number
}

interface GenerateDynamicBatchRequest {
  topics: string
  session_code: string
  batch_number: number
  performance?: PerformanceData
  previous_difficulty?: string
  batch_size?: number
}

interface GenerateDynamicBatchResponse {
  questions: Question[]
  suggested_difficulty: string
  difficulty_reason: string
  batch_number: number
}

interface FactCheckRequest {
  question: string
  claimed_answer: string
  all_options: string[]
}

interface FactCheckResponse {
  verified: boolean
  confidence: number
  explanation: string
  source_hint?: string
}

export class ApiClient {
  constructor(private baseUrl: string) {}

  private async request<T>(path: string, options: RequestInit = {}): Promise<T> {
    const url = `${this.baseUrl}${path}`
    const response = await fetch(url, {
      ...options,
      headers: {
        'Content-Type': 'application/json',
        'ngrok-skip-browser-warning': 'true',  // Bypass ngrok interstitial
        ...options.headers,
      },
    })

    if (!response.ok) {
      const error = await response.json().catch(() => ({ detail: 'Unknown error' }))
      throw new Error(error.detail || `HTTP ${response.status}`)
    }

    return response.json()
  }

  async createSession(options?: CreateSessionRequest): Promise<CreateSessionResponse> {
    return this.request('/api/session', { 
      method: 'POST',
      body: JSON.stringify(options || {})
    })
  }

  async joinSession(code: string, nickname: string): Promise<JoinSessionResponse> {
    return this.request(`/api/session/${code}/join`, {
      method: 'POST',
      body: JSON.stringify({ nickname }),
    })
  }

  async observeSession(code: string): Promise<ObserveSessionResponse> {
    return this.request(`/api/session/${code}/observe`, {
      method: 'POST',
    })
  }

  async uploadQuestions(code: string, hostToken: string, questions: Question[]): Promise<void> {
    return this.request(`/api/session/${code}/questions`, {
      method: 'POST',
      headers: { 'X-Host-Token': hostToken },
      body: JSON.stringify({ questions }),
    })
  }

  async startRound(code: string, hostToken: string): Promise<void> {
    return this.request(`/api/session/${code}/start`, {
      method: 'POST',
      headers: { 'X-Host-Token': hostToken },
    })
  }

  async nextQuestion(code: string, hostToken: string): Promise<void> {
    return this.request(`/api/session/${code}/next`, {
      method: 'POST',
      headers: { 'X-Host-Token': hostToken },
    })
  }

  async reveal(code: string, hostToken: string): Promise<void> {
    return this.request(`/api/session/${code}/reveal`, {
      method: 'POST',
      headers: { 'X-Host-Token': hostToken },
    })
  }

  async submitAnswer(code: string, playerId: string, questionIndex: number, choice: number, responseTimeMs?: number): Promise<void> {
    return this.request(`/api/session/${code}/answer`, {
      method: 'POST',
      body: JSON.stringify({ playerId, questionIndex, choice, response_time_ms: responseTimeMs ?? null }),
    })
  }

  async getLeaderboard(code: string): Promise<{ leaderboard: LiveLeaderboardEntry[] }> {
    return this.request(`/api/session/${code}/leaderboard`)
  }

  async getQuestionStats(code: string, questionIndex: number): Promise<{ stats: QuestionStats }> {
    return this.request(`/api/session/${code}/stats/${questionIndex}`)
  }

  async getAnswerStatus(code: string, hostToken: string): Promise<AnswerStatusWithNames> {
    return this.request(`/api/session/${code}/answer-status`, {
      headers: { 'X-Host-Token': hostToken },
    })
  }

  async appendQuestions(code: string, hostToken: string, questions: Question[]): Promise<{ ok: boolean; previousCount: number; newCount: number; appended: number }> {
    return this.request(`/api/session/${code}/append-questions`, {
      method: 'POST',
      headers: { 'X-Host-Token': hostToken },
      body: JSON.stringify({ questions }),
    })
  }

  async getPerformance(code: string, hostToken: string, lastN?: number): Promise<PerformanceData> {
    const params = lastN ? `?last_n=${lastN}` : ''
    return this.request(`/api/session/${code}/performance${params}`, {
      headers: { 'X-Host-Token': hostToken },
    })
  }

  // --- AI Generation Methods ---

  async generateQuestions(
    request: GenerateQuestionsRequest,
    authToken: string
  ): Promise<GenerateQuestionsResponse> {
    return this.request('/api/generate-questions', {
      method: 'POST',
      headers: { 'X-Auth-Token': authToken },
      body: JSON.stringify({
        topics: request.topics,
        count: request.count ?? 10,
        research_mode: request.research_mode ?? false,
        difficulty: request.difficulty ?? 'mixed',
      }),
    })
  }

  async generateDynamicBatch(
    request: GenerateDynamicBatchRequest,
    authToken: string
  ): Promise<GenerateDynamicBatchResponse> {
    return this.request('/api/generate-dynamic-batch', {
      method: 'POST',
      headers: { 'X-Auth-Token': authToken },
      body: JSON.stringify(request),
    })
  }

  async factCheck(
    request: FactCheckRequest,
    authToken: string
  ): Promise<FactCheckResponse> {
    return this.request('/api/fact-check', {
      method: 'POST',
      headers: { 'X-Auth-Token': authToken },
      body: JSON.stringify(request),
    })
  }

  getWebSocketUrl(code: string): string {
    // If baseUrl is empty (same-origin proxy), construct from window.location
    if (!this.baseUrl) {
      const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:'
      return `${protocol}//${window.location.host}/ws/session/${code}`
    }
    const wsBase = this.baseUrl.replace(/^http/, 'ws')
    return `${wsBase}/ws/session/${code}`
  }

  // --- Polling Fallback Methods (for Zscaler/corporate networks) ---

  async getSessionState(code: string, auth: { hostToken?: string; playerId?: string; observerId?: string }): Promise<unknown> {
    const params = new URLSearchParams()
    if (auth.playerId) params.set('player_id', auth.playerId)
    if (auth.observerId) params.set('observer_id', auth.observerId)
    
    const headers: Record<string, string> = {}
    if (auth.hostToken) headers['X-Host-Token'] = auth.hostToken
    
    return this.request(`/api/session/${code}/state?${params}`, { headers })
  }

  async pollEvents(
    code: string, 
    sinceId: number, 
    auth: { hostToken?: string; playerId?: string; observerId?: string }
  ): Promise<PollEventsResponse> {
    const params = new URLSearchParams()
    params.set('since_id', sinceId.toString())
    if (auth.playerId) params.set('player_id', auth.playerId)
    if (auth.observerId) params.set('observer_id', auth.observerId)
    
    const headers: Record<string, string> = {}
    if (auth.hostToken) headers['X-Host-Token'] = auth.hostToken
    
    return this.request(`/api/session/${code}/events?${params}`, { headers })
  }
}

// Polling-based connection that mimics WebSocket interface
export class PollingConnection {
  private lastEventId = 0
  private pollInterval: ReturnType<typeof setInterval> | null = null
  private isActive = false
  public onmessage: ((event: { data: string }) => void) | null = null
  public onclose: (() => void) | null = null
  public onerror: ((error: Error) => void) | null = null

  constructor(
    private client: ApiClient,
    private code: string,
    private auth: { hostToken?: string; playerId?: string; observerId?: string },
    private intervalMs = 1000  // Poll every second
  ) {}

  async start(): Promise<void> {
    this.isActive = true
    
    // Get initial state
    try {
      const state = await this.client.getSessionState(this.code, this.auth)
      if (this.onmessage) {
        this.onmessage({ data: JSON.stringify({ type: 'session_state', state }) })
      }
    } catch (error) {
      if (this.onerror) this.onerror(error as Error)
      return
    }

    // Start polling for events
    this.pollInterval = setInterval(() => this.poll(), this.intervalMs)
  }

  private async poll(): Promise<void> {
    if (!this.isActive) return

    try {
      const response = await this.client.pollEvents(this.code, this.lastEventId, this.auth)
      
      for (const event of response.events) {
        if (this.onmessage) {
          // Remove internal fields before sending
          const cleanEvent = { ...event }
          delete cleanEvent._eventId
          delete cleanEvent._timestamp
          delete cleanEvent._hostOnly
          this.onmessage({ data: JSON.stringify(cleanEvent) })
        }
      }
      
      if (response.lastEventId > this.lastEventId) {
        this.lastEventId = response.lastEventId
      }
    } catch (error) {
      console.warn('Polling error:', error)
      // Don't call onerror for transient failures, just log
    }
  }

  close(): void {
    this.isActive = false
    if (this.pollInterval) {
      clearInterval(this.pollInterval)
      this.pollInterval = null
    }
    if (this.onclose) this.onclose()
  }
}

// Smart connection that tries WebSocket first, falls back to polling
export function createSmartConnection(
  client: ApiClient,
  code: string,
  auth: { hostToken?: string; playerId?: string; observerId?: string },
  onMessage: (data: unknown) => void,
  onError?: (error: Error) => void,
  onConnectionModeChange?: (mode: 'websocket' | 'polling') => void
): { send: (data: unknown) => void; close: () => void } {
  let ws: WebSocket | null = null
  let polling: PollingConnection | null = null
  let closed = false
  let wsConnected = false

  const handleMessage = (event: { data: string }) => {
    try {
      const data = JSON.parse(event.data)
      onMessage(data)
    } catch {
      console.error('Failed to parse message:', event.data)
    }
  }

  // Try WebSocket first
  const wsUrl = client.getWebSocketUrl(code)
  ws = new WebSocket(wsUrl)

  const wsTimeout = setTimeout(() => {
    if (!wsConnected && !closed) {
      console.log('WebSocket connection timeout, switching to polling')
      ws?.close()
      startPolling()
    }
  }, 5000)  // 5 second timeout for WebSocket

  ws.onopen = () => {
    clearTimeout(wsTimeout)
    wsConnected = true
    onConnectionModeChange?.('websocket')
    
    // Send identification
    if (auth.hostToken) {
      ws?.send(JSON.stringify({ type: 'identify_host', hostToken: auth.hostToken }))
    } else if (auth.playerId) {
      ws?.send(JSON.stringify({ type: 'identify_player', playerId: auth.playerId }))
    } else if (auth.observerId) {
      ws?.send(JSON.stringify({ type: 'identify_observer', observerId: auth.observerId }))
    }
  }

  ws.onmessage = handleMessage

  ws.onerror = (event) => {
    console.warn('WebSocket error, will try polling fallback:', event)
  }

  ws.onclose = () => {
    clearTimeout(wsTimeout)
    if (!closed && !wsConnected) {
      // WebSocket failed before connecting, try polling
      startPolling()
    } else if (!closed && wsConnected) {
      // WebSocket was working but disconnected, try to reconnect or fall back
      console.log('WebSocket disconnected, switching to polling')
      startPolling()
    }
  }

  function startPolling() {
    if (closed || polling) return
    
    console.log('Starting polling fallback for Zscaler/corporate network compatibility')
    onConnectionModeChange?.('polling')
    
    polling = new PollingConnection(client, code, auth)
    polling.onmessage = handleMessage
    polling.onerror = (error) => onError?.(error)
    polling.start()
  }

  return {
    send: (data: unknown) => {
      // For polling mode, we use REST API calls instead
      // The send() method is mainly used for WebSocket identification
      if (ws && wsConnected && ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify(data))
      }
    },
    close: () => {
      closed = true
      ws?.close()
      polling?.close()
    }
  }
}
