import os
import logging
import webbrowser
from threading import Timer
from flask import Flask, request, jsonify, send_from_directory
from services.llm_service import chat_with_guru

# Set up logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Point Flask to the 'frontend' folder one level up from the backend directory
BASE_DIR = os.path.dirname(os.path.abspath(__file__))
FRONTEND_DIR = os.path.abspath(os.path.join(BASE_DIR, "..", "frontend"))

app = Flask(__name__, static_folder=FRONTEND_DIR)

@app.route("/")
def serve_index():
    """Serves the main frontend page."""
    return send_from_directory(app.static_folder, "index.html")

@app.route("/<path:path>")
def serve_static_files(path):
    """Serves CSS, JS, images, etc. from the frontend directory."""
    return send_from_directory(app.static_folder, path)

@app.route("/api/chat", methods=["POST", "OPTIONS"])
def chat_endpoint():
    if request.method == "OPTIONS":
        return jsonify({"status": "ok"}), 200

    try:
        data = request.get_json() or {}
        user_message = data.get("message", "").strip()
        history = data.get("history", None)

        if not user_message:
            return jsonify({"error": "Message field cannot be empty"}), 400

        # logger.info(f"Received API request: {user_message}")
        reply, updated_history = chat_with_guru(user_message, history)

        return jsonify({
            "reply": reply,
            "history": updated_history
        }), 200

    except Exception as e:
        logger.error(f"API route encountered an error: {str(e)}")
        return jsonify({"error": "An internal server error occurred"}), 500

def open_browser():
    """Opens the local server URL in the default web browser."""
    webbrowser.open("http://127.0.0.1:5000/")

if __name__ == "__main__":
    logger.info("Starting Kapruka Gift Guru Server...")
    
    # Start the single-use browser launch timer
    Timer(1.0, open_browser).start()
        
    # We turn off use_reloader to guarantee it only starts exactly once locally
    app.run(host="127.0.0.1", port=5000, debug=False, use_reloader=False)