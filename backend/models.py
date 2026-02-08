from pydantic import BaseModel
from typing import Optional
from dataclasses import dataclass, field
import secrets
import string


class Question(BaseModel):
    question: str
    options: list[str]
    correct: int  # 0-indexed
    explanation: Optional[str] = None
    points: int = 1


class Player(BaseModel):
    id: str
    nickname: str
    score: int = 0
    answers: dict[int, int] = {}  # questionIndex -> choiceIndex
    answer_times: dict[int, float] = {}  # questionIndex -> seconds to answer


class GameSettings(BaseModel):
    timerMode: bool = False
    timerSeconds: int = 15
    autoProgressMode: bool = False
    autoProgressPercent: int = 90  # Progress when X% have answered


class SessionState(BaseModel):
    code: str
    status: str  # 'lobby' | 'playing' | 'revealed'
    currentQuestionIndex: int
    players: list[Player]
    questions: list[Question]
    roundSize: int = 10
    settings: GameSettings = GameSettings()
    timerRemaining: Optional[int] = None  # Seconds remaining on current question


class PlayerResult(BaseModel):
    id: str
    nickname: str
    score: int
    rank: int
    totalTime: float = 0.0  # Total time to answer all questions (tie-breaker)


class QuestionResult(BaseModel):
    question: str
    options: list[str]
    correct: int
    explanation: Optional[str]
    points: int
    yourAnswer: Optional[int] = None
    answeredCorrectly: Optional[bool] = None


class RevealResults(BaseModel):
    players: list[PlayerResult]
    questions: list[QuestionResult]


class LiveLeaderboardEntry(BaseModel):
    id: str
    nickname: str
    score: int
    rank: int
    correctAnswers: int
    totalAnswers: int


class QuestionStats(BaseModel):
    questionIndex: int
    totalPlayers: int
    answeredCount: int
    distribution: list[int]  # Count per option


class AnswerStatus(BaseModel):
    answered: list[str]  # Player IDs who answered
    waiting: list[str]   # Player IDs who haven't answered


@dataclass
class Session:
    code: str
    host_token: str
    status: str = 'lobby'  # 'lobby' | 'playing' | 'revealed'
    current_question_index: int = 0
    players: dict[str, Player] = field(default_factory=dict)  # id -> Player
    questions: list[Question] = field(default_factory=list)
    round_size: int = 10
    question_start_times: dict[int, float] = field(default_factory=dict)  # questionIndex -> timestamp
    observers: dict[str, str] = field(default_factory=dict)  # observer_id -> connection_id
    timer_mode: bool = False
    timer_seconds: int = 15
    timer_remaining: Optional[int] = None
    timer_task: Optional[object] = None  # asyncio Task reference
    auto_progress_mode: bool = False
    auto_progress_percent: int = 90
    
    def to_state(self, include_answers: bool = False) -> SessionState:
        """Convert to client-facing state (without correct answers during play)"""
        players_list = list(self.players.values())
        
        # Don't include correct answers during play
        if self.status == 'playing' and not include_answers:
            questions_for_client = [
                Question(
                    question=q.question,
                    options=q.options,
                    correct=-1,  # Hide correct answer
                    explanation=None,
                    points=q.points
                )
                for q in self.questions
            ]
        else:
            questions_for_client = self.questions
        
        return SessionState(
            code=self.code,
            status=self.status,
            currentQuestionIndex=self.current_question_index,
            players=players_list,
            questions=questions_for_client,
            roundSize=self.round_size,
            settings=GameSettings(
                timerMode=self.timer_mode, 
                timerSeconds=self.timer_seconds,
                autoProgressMode=self.auto_progress_mode,
                autoProgressPercent=self.auto_progress_percent
            ),
            timerRemaining=self.timer_remaining
        )
    
    def calculate_scores(self) -> None:
        """Calculate scores for all players based on their answers"""
        for player in self.players.values():
            score = 0
            for q_idx, choice in player.answers.items():
                if q_idx < len(self.questions):
                    question = self.questions[q_idx]
                    if choice == question.correct:
                        score += question.points
            player.score = score
    
    def get_reveal_results(self, player_id: Optional[str] = None) -> RevealResults:
        """Get results for reveal, optionally personalized for a player"""
        self.calculate_scores()
        
        # Calculate total answer time for each player
        def get_total_time(player: Player) -> float:
            return sum(player.answer_times.values())
        
        # Sort players by score (desc), then by total time (asc) for tie-break
        sorted_players = sorted(
            self.players.values(),
            key=lambda p: (-p.score, get_total_time(p))
        )
        
        # Assign ranks (players with same score and ~same time get same rank)
        player_results = []
        current_rank = 1
        for i, p in enumerate(sorted_players):
            # Check if this player ties with previous (same score)
            if i > 0:
                prev = sorted_players[i-1]
                if p.score == prev.score:
                    # Same score - rank based on time (already sorted)
                    current_rank = i + 1
                else:
                    current_rank = i + 1
            
            player_results.append(PlayerResult(
                id=p.id,
                nickname=p.nickname,
                score=p.score,
                rank=current_rank,
                totalTime=round(get_total_time(p), 2)
            ))
        
        # Get the requesting player's answers
        requesting_player = self.players.get(player_id) if player_id else None
        
        question_results = []
        for i, q in enumerate(self.questions):
            your_answer = None
            answered_correctly = None
            
            if requesting_player and i in requesting_player.answers:
                your_answer = requesting_player.answers[i]
                answered_correctly = your_answer == q.correct
            
            question_results.append(QuestionResult(
                question=q.question,
                options=q.options,
                correct=q.correct,
                explanation=q.explanation,
                points=q.points,
                yourAnswer=your_answer,
                answeredCorrectly=answered_correctly
            ))
        
        return RevealResults(
            players=player_results,
            questions=question_results
        )

    def get_live_leaderboard(self) -> list[LiveLeaderboardEntry]:
        """Get current leaderboard with scores calculated so far"""
        # Calculate current scores
        entries = []
        for player in self.players.values():
            score = 0
            correct_count = 0
            for q_idx, choice in player.answers.items():
                if q_idx < len(self.questions):
                    question = self.questions[q_idx]
                    if choice == question.correct:
                        score += question.points
                        correct_count += 1
            entries.append({
                'id': player.id,
                'nickname': player.nickname,
                'score': score,
                'correctAnswers': correct_count,
                'totalAnswers': len(player.answers),
                'totalTime': sum(player.answer_times.values())
            })
        
        # Sort by score desc, then by time asc
        entries.sort(key=lambda e: (-e['score'], e['totalTime']))
        
        # Assign ranks
        result = []
        for i, e in enumerate(entries):
            result.append(LiveLeaderboardEntry(
                id=e['id'],
                nickname=e['nickname'],
                score=e['score'],
                rank=i + 1,
                correctAnswers=e['correctAnswers'],
                totalAnswers=e['totalAnswers']
            ))
        return result

    def get_question_stats(self, question_index: int) -> QuestionStats:
        """Get answer distribution for a specific question"""
        if question_index >= len(self.questions):
            return QuestionStats(
                questionIndex=question_index,
                totalPlayers=len(self.players),
                answeredCount=0,
                distribution=[]
            )
        
        question = self.questions[question_index]
        num_options = len(question.options)
        distribution = [0] * num_options
        answered_count = 0
        
        for player in self.players.values():
            if question_index in player.answers:
                answered_count += 1
                choice = player.answers[question_index]
                if 0 <= choice < num_options:
                    distribution[choice] += 1
        
        return QuestionStats(
            questionIndex=question_index,
            totalPlayers=len(self.players),
            answeredCount=answered_count,
            distribution=distribution
        )

    def get_answer_status(self, question_index: int) -> AnswerStatus:
        """Get which players have/haven't answered the current question"""
        answered = []
        waiting = []
        
        for player in self.players.values():
            if question_index in player.answers:
                answered.append(player.id)
            else:
                waiting.append(player.id)
        
        return AnswerStatus(answered=answered, waiting=waiting)


def generate_session_code(length: int = 6) -> str:
    """Generate a random session code"""
    chars = string.ascii_uppercase + string.digits
    # Remove confusing characters
    chars = chars.replace('O', '').replace('0', '').replace('I', '').replace('1', '')
    return ''.join(secrets.choice(chars) for _ in range(length))


def generate_token() -> str:
    """Generate a secure random token"""
    return secrets.token_urlsafe(32)


def generate_player_id() -> str:
    """Generate a player ID"""
    return secrets.token_urlsafe(16)
