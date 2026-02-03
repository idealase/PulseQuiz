export interface Question {
  question: string
  options: string[]
  correct: number // 0-indexed
  explanation?: string
  points: number
}

export interface Player {
  id: string
  nickname: string
  score: number
  answers: Record<number, number> // questionIndex -> choiceIndex
}

export interface SessionState {
  code: string
  status: 'lobby' | 'playing' | 'revealed'
  currentQuestionIndex: number
  players: Player[]
  questions: Question[]
  roundSize: number
}

// Messages from server
export type ServerMessage = 
  | { type: 'session_state'; state: SessionState }
  | { type: 'player_joined'; player: Player }
  | { type: 'player_left'; playerId: string }
  | { type: 'question_started'; questionIndex: number }
  | { type: 'answer_received'; playerId: string; questionIndex: number }
  | { type: 'revealed'; results: RevealResults }
  | { type: 'error'; message: string }

export interface RevealResults {
  players: PlayerResult[]
  questions: QuestionResult[]
}

export interface PlayerResult {
  id: string
  nickname: string
  score: number
  rank: number
  totalTime: number  // Total seconds to answer (tie-breaker)
}

export interface QuestionResult {
  question: string
  options: string[]
  correct: number
  explanation?: string
  points: number
  yourAnswer?: number
  answeredCorrectly?: boolean
}

// Messages to server
export type ClientMessage = 
  | { type: 'identify_host'; hostToken: string }
  | { type: 'identify_player'; playerId: string }
