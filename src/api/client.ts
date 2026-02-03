import { Question } from '../types'

interface CreateSessionResponse {
  code: string
  hostToken: string
}

interface JoinSessionResponse {
  playerId: string
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

  async createSession(): Promise<CreateSessionResponse> {
    return this.request('/api/session', { method: 'POST' })
  }

  async joinSession(code: string, nickname: string): Promise<JoinSessionResponse> {
    return this.request(`/api/session/${code}/join`, {
      method: 'POST',
      body: JSON.stringify({ nickname }),
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

  async submitAnswer(code: string, playerId: string, questionIndex: number, choice: number): Promise<void> {
    return this.request(`/api/session/${code}/answer`, {
      method: 'POST',
      body: JSON.stringify({ playerId, questionIndex, choice }),
    })
  }

  getWebSocketUrl(code: string): string {
    const wsBase = this.baseUrl.replace(/^http/, 'ws')
    return `${wsBase}/ws/session/${code}`
  }
}
