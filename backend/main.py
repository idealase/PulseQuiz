from fastapi import FastAPI, WebSocket, WebSocketDisconnect, HTTPException, Header
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse
from pydantic import BaseModel
from typing import Optional
from pathlib import Path
import json
import asyncio
import time

from models import (
    Session, Question, Player,
    generate_session_code, generate_token, generate_player_id
)

app = FastAPI(title="PulseQuiz API")

# CORS - allow all origins for simplicity (adjust for production)
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=False,  # Must be False when using allow_origins=["*"]
    allow_methods=["*"],
    allow_headers=["*"],
    expose_headers=["*"],
)

# In-memory session storage
sessions: dict[str, Session] = {}

# WebSocket connections per session
# session_code -> { connection_id -> (websocket, role, id) }
ws_connections: dict[str, dict[str, tuple[WebSocket, str, str]]] = {}

# Event storage for polling fallback (Zscaler/corporate networks)
session_events: dict[str, list[dict]] = {}
MAX_EVENTS_PER_SESSION = 100


def add_session_event(code: str, event: dict):
    """Add an event to the session's event queue for polling clients"""
    if code not in session_events:
        session_events[code] = []
    session_events[code].append({
        **event,
        '_eventId': len(session_events[code]),
        '_timestamp': time.time()
    })
    # Keep only last N events
    if len(session_events[code]) > MAX_EVENTS_PER_SESSION:
        session_events[code] = session_events[code][-MAX_EVENTS_PER_SESSION:]


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

async def broadcast_to_session(code: str, message: dict, exclude_id: Optional[str] = None, host_only: bool = False):
    """Broadcast a message to all connections in a session"""
    # Store event for polling fallback
    if code not in session_events:
        session_events[code] = []
    event_copy = {**message, '_hostOnly': host_only}
    add_session_event(code, event_copy)
    
    if code not in ws_connections:
        return
    
    dead_connections = []
    for conn_id, (ws, role, identifier) in ws_connections[code].items():
        if conn_id == exclude_id:
            continue
        
        # Skip players if host_only is True
        if host_only and role != 'host':
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
    session.question_start_times[0] = time.time()  # Record start time
    
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
    session.question_start_times[session.current_question_index] = time.time()  # Record start time
    
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
    
    # Record answer time
    start_time = session.question_start_times.get(request.questionIndex, time.time())
    player.answer_times[request.questionIndex] = time.time() - start_time
    
    # Notify host only that someone answered (without revealing the answer)
    await broadcast_to_session(code, {
        'type': 'answer_received',
        'playerId': request.playerId,
        'questionIndex': request.questionIndex
    }, host_only=True)
    
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


# --- Polling Fallback Endpoints (for Zscaler/corporate networks where WebSockets are blocked) ---

@app.get("/api/session/{code}/state")
async def get_session_state(
    code: str,
    player_id: Optional[str] = None,
    x_host_token: Optional[str] = Header(default=None, alias="X-Host-Token")
):
    """Get current session state (polling fallback for WebSocket)"""
    if code not in sessions:
        raise HTTPException(status_code=404, detail="Session not found")
    
    session = sessions[code]
    
    # Verify caller is authorized (either host or valid player)
    if x_host_token:
        if session.host_token != x_host_token:
            raise HTTPException(status_code=403, detail="Invalid host token")
    elif player_id:
        if player_id not in session.players:
            raise HTTPException(status_code=404, detail="Player not found")
    else:
        raise HTTPException(status_code=400, detail="Must provide player_id or X-Host-Token")
    
    state = session.to_state().model_dump()
    
    # If revealed and this is a player, personalize the results
    if session.status == 'revealed' and player_id:
        results = session.get_reveal_results(player_id)
        state['revealResults'] = results.model_dump()
    elif session.status == 'revealed' and x_host_token:
        results = session.get_reveal_results()
        state['revealResults'] = results.model_dump()
    
    return state


@app.get("/api/session/{code}/events")
async def get_session_events(
    code: str,
    since_id: int = 0,
    player_id: Optional[str] = None,
    x_host_token: Optional[str] = Header(default=None, alias="X-Host-Token")
):
    """Get events since a given event ID (long-polling fallback for WebSocket)"""
    if code not in sessions:
        raise HTTPException(status_code=404, detail="Session not found")
    
    session = sessions[code]
    
    # Verify caller is authorized
    if x_host_token:
        if session.host_token != x_host_token:
            raise HTTPException(status_code=403, detail="Invalid host token")
        role = 'host'
    elif player_id:
        if player_id not in session.players:
            raise HTTPException(status_code=404, detail="Player not found")
        role = 'player'
    else:
        raise HTTPException(status_code=400, detail="Must provide player_id or X-Host-Token")
    
    events = session_events.get(code, [])
    new_events = [e for e in events if e.get('_eventId', 0) > since_id]
    
    # Filter and personalize events for players
    if role == 'player':
        filtered = []
        for event in new_events:
            # Skip host-only events
            if event.get('_hostOnly'):
                continue
            # Personalize reveal results
            if event.get('type') == 'revealed' and player_id:
                personalized = session.get_reveal_results(player_id)
                filtered.append({
                    **event,
                    'results': personalized.model_dump()
                })
            else:
                filtered.append(event)
        new_events = filtered
    
    return {
        'events': new_events,
        'lastEventId': events[-1]['_eventId'] if events else 0
    }


# --- Static File Serving (for self-hosted deployment) ---

# Path to frontend build (../dist from backend folder)
FRONTEND_DIR = Path(__file__).parent.parent / "dist"

# Serve static assets if frontend is built
if FRONTEND_DIR.exists():
    # Mount static assets (js, css, etc)
    app.mount("/assets", StaticFiles(directory=FRONTEND_DIR / "assets"), name="assets")
    
    # Serve index.html for all non-API routes (SPA support)
    @app.get("/{full_path:path}")
    async def serve_spa(full_path: str):
        # Don't intercept API or WebSocket routes
        if full_path.startswith("api/") or full_path.startswith("ws/"):
            raise HTTPException(status_code=404)
        
        # Try to serve the exact file first
        file_path = FRONTEND_DIR / full_path
        if file_path.is_file():
            return FileResponse(file_path)
        
        # Otherwise serve index.html (SPA routing)
        return FileResponse(FRONTEND_DIR / "index.html")


if __name__ == "__main__":
    import uvicorn
    print(f"\n🎮 PulseQuiz Server")
    print(f"   Frontend: {'✅ Built' if FRONTEND_DIR.exists() else '❌ Not built (run: npm run build)'}")
    print(f"   URL: http://localhost:8000\n")
    uvicorn.run(app, host="0.0.0.0", port=8000)
