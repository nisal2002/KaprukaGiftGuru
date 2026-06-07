import os
import logging
import webbrowser
from threading import Timer
import uvicorn
from fastapi import FastAPI, HTTPException
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import Optional, List, Dict, Any

from services.llm_service import chat_with_guru

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
def chat_endpoint(request: ChatRequest):
    """
    Note: We use 'def' instead of 'async def' here. 
    FastAPI is smart enough to run standard 'def' functions in a background thread pool,
    meaning the blocking OpenAI calls in chat_with_guru won't freeze the server!
    """
    user_message = request.message.strip()
    
    if not user_message:
        raise HTTPException(status_code=400, detail="Message field cannot be empty")

    try:
        reply, updated_history = chat_with_guru(user_message, request.history)

        return {
            "reply": reply,
            "history": updated_history
        }

    except Exception as e:
        logger.error(f"API route encountered an error: {str(e)}")
        raise HTTPException(status_code=500, detail="An internal server error occurred")

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