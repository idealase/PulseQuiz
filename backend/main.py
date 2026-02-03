from fastapi import FastAPI, WebSocket, WebSocketDisconnect, HTTPException, Header
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import Optional
import json
import asyncio

from models import (
    Session, Question, Player,
    generate_session_code, generate_token, generate_player_id
)

app = FastAPI(title="PulseQuiz API")

# CORS - allow all origins for simplicity (adjust for production)
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# In-memory session storage
sessions: dict[str, Session] = {}

# WebSocket connections per session
# session_code -> { connection_id -> (websocket, role, id) }
ws_connections: dict[str, dict[str, tuple[WebSocket, str, str]]] = {}


# --- Request/Response Models ---

class CreateSessionResponse(BaseModel):
    code: str
    hostToken: str


class JoinRequest(BaseModel):
    nickname: str


class JoinResponse(BaseModel):
    playerId: str


class UploadQuestionsRequest(BaseModel):
    questions: list[Question]


class AnswerRequest(BaseModel):
    playerId: str
    questionIndex: int
    choice: int


# --- Helper Functions ---

async def broadcast_to_session(code: str, message: dict, exclude_id: Optional[str] = None):
    """Broadcast a message to all connections in a session"""
    if code not in ws_connections:
        return
    
    dead_connections = []
    for conn_id, (ws, role, identifier) in ws_connections[code].items():
        if conn_id == exclude_id:
            continue
        try:
            # Personalize reveal results for players
            if message.get('type') == 'revealed' and role == 'player':
                session = sessions.get(code)
                if session:
                    personalized_results = session.get_reveal_results(identifier)
                    personalized_msg = {
                        'type': 'revealed',
                        'results': personalized_results.model_dump()
                    }
                    await ws.send_json(personalized_msg)
                    continue
            
            await ws.send_json(message)
        except Exception:
            dead_connections.append(conn_id)
    
    # Clean up dead connections
    for conn_id in dead_connections:
        del ws_connections[code][conn_id]


# --- REST Endpoints ---

@app.post("/api/session", response_model=CreateSessionResponse)
async def create_session():
    """Create a new quiz session"""
    # Generate unique code
    code = generate_session_code()
    while code in sessions:
        code = generate_session_code()
    
    host_token = generate_token()
    sessions[code] = Session(code=code, host_token=host_token)
    ws_connections[code] = {}
    
    return CreateSessionResponse(code=code, hostToken=host_token)


@app.post("/api/session/{code}/join", response_model=JoinResponse)
async def join_session(code: str, request: JoinRequest):
    """Join an existing session as a player"""
    if code not in sessions:
        raise HTTPException(status_code=404, detail="Session not found")
    
    session = sessions[code]
    
    if session.status != 'lobby':
        raise HTTPException(status_code=400, detail="Session already in progress")
    
    # Check for duplicate nickname
    for p in session.players.values():
        if p.nickname.lower() == request.nickname.lower():
            raise HTTPException(status_code=400, detail="Nickname already taken")
    
    player_id = generate_player_id()
    player = Player(id=player_id, nickname=request.nickname)
    session.players[player_id] = player
    
    # Notify all connections
    await broadcast_to_session(code, {
        'type': 'player_joined',
        'player': player.model_dump()
    })
    
    return JoinResponse(playerId=player_id)


@app.post("/api/session/{code}/questions")
async def upload_questions(
    code: str, 
    request: UploadQuestionsRequest,
    x_host_token: str = Header(alias="X-Host-Token")
):
    """Upload questions to a session (host only)"""
    if code not in sessions:
        raise HTTPException(status_code=404, detail="Session not found")
    
    session = sessions[code]
    
    if session.host_token != x_host_token:
        raise HTTPException(status_code=403, detail="Invalid host token")
    
    if session.status != 'lobby':
        raise HTTPException(status_code=400, detail="Cannot modify questions after start")
    
    session.questions = request.questions
    return {"ok": True, "count": len(request.questions)}


@app.post("/api/session/{code}/start")
async def start_round(code: str, x_host_token: str = Header(alias="X-Host-Token")):
    """Start the quiz round (host only)"""
    if code not in sessions:
        raise HTTPException(status_code=404, detail="Session not found")
    
    session = sessions[code]
    
    if session.host_token != x_host_token:
        raise HTTPException(status_code=403, detail="Invalid host token")
    
    if len(session.questions) == 0:
        raise HTTPException(status_code=400, detail="No questions loaded")
    
    session.status = 'playing'
    session.current_question_index = 0
    
    # Broadcast to all
    await broadcast_to_session(code, {
        'type': 'question_started',
        'questionIndex': 0
    })
    
    # Also send updated session state
    await broadcast_to_session(code, {
        'type': 'session_state',
        'state': session.to_state().model_dump()
    })
    
    return {"ok": True}


@app.post("/api/session/{code}/next")
async def next_question(code: str, x_host_token: str = Header(alias="X-Host-Token")):
    """Advance to the next question (host only)"""
    if code not in sessions:
        raise HTTPException(status_code=404, detail="Session not found")
    
    session = sessions[code]
    
    if session.host_token != x_host_token:
        raise HTTPException(status_code=403, detail="Invalid host token")
    
    if session.status != 'playing':
        raise HTTPException(status_code=400, detail="Round not in progress")
    
    if session.current_question_index >= len(session.questions) - 1:
        raise HTTPException(status_code=400, detail="No more questions")
    
    session.current_question_index += 1
    
    await broadcast_to_session(code, {
        'type': 'question_started',
        'questionIndex': session.current_question_index
    })
    
    return {"ok": True}


@app.post("/api/session/{code}/reveal")
async def reveal_results(code: str, x_host_token: str = Header(alias="X-Host-Token")):
    """End the round and reveal all results (host only)"""
    if code not in sessions:
        raise HTTPException(status_code=404, detail="Session not found")
    
    session = sessions[code]
    
    if session.host_token != x_host_token:
        raise HTTPException(status_code=403, detail="Invalid host token")
    
    session.status = 'revealed'
    session.calculate_scores()
    
    # Broadcast reveal - personalization happens in broadcast_to_session
    results = session.get_reveal_results()
    await broadcast_to_session(code, {
        'type': 'revealed',
        'results': results.model_dump()
    })
    
    return {"ok": True}


@app.post("/api/session/{code}/answer")
async def submit_answer(code: str, request: AnswerRequest):
    """Submit an answer to the current question (player)"""
    if code not in sessions:
        raise HTTPException(status_code=404, detail="Session not found")
    
    session = sessions[code]
    
    if request.playerId not in session.players:
        raise HTTPException(status_code=404, detail="Player not found")
    
    if session.status != 'playing':
        raise HTTPException(status_code=400, detail="Round not in progress")
    
    if request.questionIndex != session.current_question_index:
        raise HTTPException(status_code=400, detail="Wrong question")
    
    player = session.players[request.playerId]
    
    # Only allow one answer per question
    if request.questionIndex in player.answers:
        raise HTTPException(status_code=400, detail="Already answered")
    
    player.answers[request.questionIndex] = request.choice
    
    # Notify host that someone answered (without revealing the answer)
    await broadcast_to_session(code, {
        'type': 'answer_received',
        'playerId': request.playerId,
        'questionIndex': request.questionIndex
    })
    
    return {"ok": True}


# --- WebSocket Endpoint ---

@app.websocket("/ws/session/{code}")
async def websocket_session(websocket: WebSocket, code: str):
    """WebSocket connection for real-time session updates"""
    if code not in sessions:
        await websocket.close(code=4004, reason="Session not found")
        return
    
    await websocket.accept()
    
    # Generate a connection ID
    conn_id = generate_player_id()
    role = None
    identifier = None
    
    try:
        # Wait for identification message
        data = await asyncio.wait_for(websocket.receive_json(), timeout=10.0)
        
        if data.get('type') == 'identify_host':
            host_token = data.get('hostToken')
            session = sessions[code]
            if session.host_token != host_token:
                await websocket.send_json({'type': 'error', 'message': 'Invalid host token'})
                await websocket.close()
                return
            role = 'host'
            identifier = 'host'
        
        elif data.get('type') == 'identify_player':
            player_id = data.get('playerId')
            session = sessions[code]
            if player_id not in session.players:
                await websocket.send_json({'type': 'error', 'message': 'Player not found'})
                await websocket.close()
                return
            role = 'player'
            identifier = player_id
        
        else:
            await websocket.send_json({'type': 'error', 'message': 'Invalid identification'})
            await websocket.close()
            return
        
        # Register connection
        ws_connections[code][conn_id] = (websocket, role, identifier)
        
        # Send current session state
        session = sessions[code]
        await websocket.send_json({
            'type': 'session_state',
            'state': session.to_state().model_dump()
        })
        
        # Keep connection alive and handle incoming messages
        while True:
            try:
                data = await websocket.receive_json()
                # Handle any additional messages if needed
                # Currently we don't expect any after identification
            except WebSocketDisconnect:
                break
    
    except asyncio.TimeoutError:
        await websocket.close(code=4008, reason="Identification timeout")
    except WebSocketDisconnect:
        pass
    except Exception as e:
        print(f"WebSocket error: {e}")
    finally:
        # Clean up connection
        if code in ws_connections and conn_id in ws_connections[code]:
            del ws_connections[code][conn_id]
            
            # Notify others if a player left
            if role == 'player' and identifier:
                await broadcast_to_session(code, {
                    'type': 'player_left',
                    'playerId': identifier
                })


@app.get("/health")
async def health():
    """Health check endpoint"""
    return {"status": "ok"}


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
