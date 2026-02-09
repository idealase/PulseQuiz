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

export interface GameSettings {
  timerMode: boolean
  timerSeconds: number
  autoProgressMode: boolean
  autoProgressPercent: number
}

export interface SessionState {
  code: string
  status: 'lobby' | 'playing' | 'revealed'
  currentQuestionIndex: number
  players: Player[]
  questions: Question[]
  roundSize: number
  settings: GameSettings
  timerRemaining?: number
}

export interface AnswerStatus {
  answered: string[]  // Player IDs
  waiting: string[]   // Player IDs
}

export interface AnswerStatusWithNames {
  answered: { id: string; nickname: string }[]
  waiting: { id: string; nickname: string }[]
}

export interface LiveLeaderboardEntry {
  id: string
  nickname: string
  score: number
  rank: number
  correctAnswers: number
  totalAnswers: number
}

export interface QuestionStats {
  questionIndex: number
  totalPlayers: number
  answeredCount: number
  distribution: number[]
}

// Messages from server
export type ServerMessage = 
  | { type: 'session_state'; state: SessionState; leaderboard?: LiveLeaderboardEntry[]; stats?: QuestionStats }
  | { type: 'player_joined'; player: Player }
  | { type: 'player_left'; playerId: string }
  | { type: 'question_started'; questionIndex: number }
  | { type: 'answer_received'; playerId: string; questionIndex: number; answerStatus?: AnswerStatus }
  | { type: 'revealed'; results: RevealResults }
  | { type: 'timer_tick'; remaining: number; questionIndex: number }
  | { type: 'leaderboard_update'; leaderboard: LiveLeaderboardEntry[] }
  | { type: 'question_stats'; stats: QuestionStats }
  | { type: 'questions_updated'; totalQuestions: number; addedCount: number }
  | { type: 'challenge_updated'; questionIndex: number; count: number; status: string }
  | { type: 'challenge_resolution'; questionIndex: number; resolution: ChallengeResolution }
  | { type: 'challenge_ai_verified'; questionIndex: number; aiVerification: AIVerification }
  | { type: 'challenge_ai_published'; questionIndex: number; aiVerification: AIVerification }
  | { type: 'scores_reconciled'; questionIndex: number; policy: ReconciliationPolicy; deltas: Record<string, number> }
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
  challengeStatus?: string
  resolutionVerdict?: string
  resolutionNote?: string
  aiVerdict?: string
  aiConfidence?: number
  aiRationale?: string
  aiSuggestedCorrection?: string
  scoringPolicy?: string
  acceptedAnswers?: number[]
}

export interface ChallengeSubmission {
  playerId: string
  nickname: string
  questionIndex: number
  category?: string
  note?: string
  source: string
  createdAt: number
}

export interface ChallengeResolution {
  status: string
  verdict?: string
  resolutionNote?: string
  resolvedAt?: number
  resolvedBy?: string
  published: boolean
}

export interface AIVerification {
  verdict: string
  confidence: number
  rationale: string
  suggested_correction?: string
  requestedAt: number
  published: boolean
  publishedAt?: number
}

export interface ReconciliationPolicy {
  policy: string
  acceptedAnswers?: number[]
  appliedAt: number
  appliedBy: string
}

export interface ChallengeSummary {
  questionIndex: number
  question: string
  count: number
  status: string
  categories: Record<string, number>
  lastUpdatedAt: number
}

export interface ChallengeDetail {
  questionIndex: number
  question: string
  options: string[]
  correct: number
  explanation?: string
  submissions: ChallengeSubmission[]
  resolution?: ChallengeResolution | null
  aiVerification?: AIVerification | null
  reconciliation?: ReconciliationPolicy | null
}

export interface PerformanceData {
  avg_score_percent: number
  avg_response_time_ms: number
  player_count: number
  questions_answered: number
  per_question?: {
    questionIndex: number
    correct: number
    attempts: number
    score_percent: number
    avg_response_time_ms: number
  }[]
}

// Messages to server
export type ClientMessage = 
  | { type: 'identify_host'; hostToken: string }
  | { type: 'identify_player'; playerId: string }
  | { type: 'identify_observer'; observerId: string }
