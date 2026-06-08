import os
import logging
import json
import webbrowser
from threading import Timer
import uvicorn
from fastapi import FastAPI, HTTPException
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse, StreamingResponse
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import Optional, List, Dict, Any

from services.llm_service import chat_with_guru_stream

# Set up logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Point to the 'frontend' folder one level up from the backend directory
BASE_DIR = os.path.dirname(os.path.abspath(__file__))
FRONTEND_DIR = os.path.abspath(os.path.join(BASE_DIR, "..", "frontend"))

app = FastAPI()

# FastAPI handles CORS natively through middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Pydantic model strictly enforces incoming JSON structure
class ChatRequest(BaseModel):
    message: str
    history: Optional[List[Dict[str, Any]]] = None

@app.post("/api/chat")
async def chat_endpoint(request: ChatRequest):
    """
    Note: We use 'def' instead of 'async def' here. 
    FastAPI is smart enough to run standard 'def' functions in a background thread pool,
    meaning the blocking OpenAI calls in chat_with_guru won't freeze the server!
    """
    user_message = request.message.strip()
    
    if not user_message:
        raise HTTPException(status_code=400, detail="Message field cannot be empty")

    async def event_stream():
        try:
            yield ": connected\n\n"

            async for event in chat_with_guru_stream(user_message, request.history):
                event_type = event.get("type")

                if event_type == "status":
                    payload = {"tool": event.get("tool")}
                    yield f"event: status\ndata: {json.dumps(payload)}\n\n"
                elif event_type == "final":
                    payload = {
                        "reply": event.get("reply"),
                        "history": event.get("history")
                    }
                    yield f"event: final\ndata: {json.dumps(payload)}\n\n"
                elif event_type == "error":
                    payload = {"message": event.get("message")}
                    yield f"event: error\ndata: {json.dumps(payload)}\n\n"
        except Exception as e:
            logger.error(f"API route encountered an error: {str(e)}")
            payload = {"message": "An internal server error occurred"}
            yield f"event: error\ndata: {json.dumps(payload)}\n\n"

    return StreamingResponse(
        event_stream(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache, no-transform",
            "X-Accel-Buffering": "no"
        }
    )


@app.get("/api/chat/stream")
async def chat_stream_get(message: str, history: Optional[str] = None):
    """SSE GET endpoint consumed by EventSource. `history` should be a JSON-encoded string when present."""
    try:
        parsed_history = None
        if history:
            try:
                parsed_history = json.loads(history)
            except Exception:
                parsed_history = None

        async def event_stream():
            try:
                yield ": connected\n\n"
                async for event in chat_with_guru_stream(message, parsed_history):
                    event_type = event.get("type")

                    if event_type == "status":
                        payload = {"tool": event.get("tool")}
                        yield f"event: status\ndata: {json.dumps(payload)}\n\n"
                    elif event_type == "final":
                        payload = {
                            "reply": event.get("reply"),
                            "history": event.get("history")
                        }
                        yield f"event: final\ndata: {json.dumps(payload)}\n\n"
                    elif event_type == "error":
                        payload = {"message": event.get("message")}
                        yield f"event: error\ndata: {json.dumps(payload)}\n\n"
            except Exception as e:
                logger.error(f"API stream route error: {str(e)}")
                payload = {"message": "An internal server error occurred"}
                yield f"event: error\ndata: {json.dumps(payload)}\n\n"

        return StreamingResponse(
            event_stream(),
            media_type="text/event-stream",
            headers={
                "Cache-Control": "no-cache, no-transform",
                "X-Accel-Buffering": "no"
            }
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

# Specific route for the root to serve index.html
@app.get("/")
def serve_index():
    return FileResponse(os.path.join(FRONTEND_DIR, "index.html"))

# Mount the static files directory for CSS, JS, Images (Must come AFTER the root route)
app.mount("/", StaticFiles(directory=FRONTEND_DIR), name="static")

def open_browser():
    """Opens the local server URL in the default web browser."""
    webbrowser.open("http://127.0.0.1:5000/")

if __name__ == "__main__":
    logger.info("Starting Kapruka Gift Guru Server with FastAPI...")
    
    # Start the single-use browser launch timer
    Timer(1.0, open_browser).start()
        
    # Launch using uvicorn (FastAPI's ASGI server)
    uvicorn.run(app, host="127.0.0.1", port=5000, log_level="info")