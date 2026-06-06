from flask import Flask, request, jsonify, send_from_directory
import os

app = Flask(__name__)

# Basic routing to serve our frontend files locally for testing
@app.route('/')
def index():
    return send_from_directory('../frontend', 'index.html')

@app.route('/<path:path>')
def serve_static(path):
    return send_from_directory('../frontend', path)

# The core API endpoint our frontend chat will talk to
@app.route('/api/chat', methods=['POST'])  # <-- Fixed parameter name here
def chat():
    data = request.json
    user_message = data.get('message', '')
    
    if not user_message:
        return jsonify({'status': 'error', 'message': 'Empty message received'}), 400
        
    # Placeholder response loop for Week 1 testing
    bot_reply = f"Architect Echo: I received your message: '{user_message}'. Connection is active!"
    
    return jsonify({
        'status': 'success',
        'reply': bot_reply,
        'data': None 
    })

if __name__ == '__main__':
    # Running on port 5000 locally
    app.run(debug=True, port=5000)