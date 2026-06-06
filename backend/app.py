from flask import Flask, request, jsonify, send_from_directory
import os
import json
import requests
from dotenv import load_dotenv
from openai import OpenAI

# Load environment variables from .env
load_dotenv()

app = Flask(__name__)

# --- CENTRALIZED BACKEND ENGINE TOGGLES ---
# Set these to True or False to control availability from the backend
ENGINE_CONFIG = {
    "openai_available": True,   # <-- Turn False to disable Cloud OpenAI
    "ollama_available": False    # <-- Turn False to disable Local Ollama
}

# --- SECURE CREDENTIAL MANAGERS ---
OPENAI_CLIENT = OpenAI(api_key=os.environ.get("OPENAI_API_KEY"))
OPENAI_MODEL_NAME = os.environ.get("OPENAI_CHAT_MODEL")

OLLAMA_API_URL = os.environ.get("OLLAMA_API_URL")
OLLAMA_MODEL_NAME = os.environ.get("OLLAMA_MODEL")

KAPRUKA_MCP_URL = os.environ.get("KAPRUKA_MCP_URL")

KAPRUKA_TOOLS_SCHEMA = [
    {
        "type": "function",
        "function": {
            "name": "kapruka_search_products",
            "description": "Search the live Kapruka Sri Lanka catalog by keyword. Returns product names, prices, image links, and IDs.",
            "parameters": {
                "type": "object",
                "properties": {
                    "q": {"type": "string", "description": "The search keyword (e.g., 'chocolate cake', 'teddy bear', 'flowers')"},
                    "min_price": {"type": "number", "description": "Minimum price in LKR"},
                    "max_price": {"type": "number", "description": "Maximum price in LKR"}
                },
                "required": ["q"]
            }
        }
    }
]

def call_kapruka_mcp(tool_name, arguments):
    try:
        payload = {
            "jsonrpc": "2.0",
            "method": "tools/call",
            "params": {
                "name": tool_name,
                "arguments": arguments
            },
            "id": 1
        }
        headers = {"Content-Type": "application/json"}
        response = requests.post(KAPRUKA_MCP_URL, json=payload, headers=headers, timeout=15)
        if response.status_code == 200:
            result_data = response.json()
            content_list = result_data.get("result", {}).get("content", [])
            if content_list:
                return content_list[0].get("text", "[]")
        return "[]"
    except Exception as e:
        print(f"MCP Infrastructure Crash: {str(e)}")
        return "[]"

# --- ROUTING STATIC FILES ---
@app.route('/')
def index():
    return send_from_directory('../frontend', 'index.html')

@app.route('/<path:path>')
def serve_static(path):
    return send_from_directory('../frontend', path)

# --- NEW: CONFIGURATION HANDSHAKE ENDPOINT ---
@app.route('/api/config', methods=['GET'])
def get_config():
    """Exposes backend operational rules to the frontend UI layer on initialization."""
    return jsonify(ENGINE_CONFIG)

# --- MAIN CHAT PIPELINE ---
@app.route('/api/chat', methods=['POST'])
def chat():
    payload_data = request.json
    user_message = payload_data.get('message', '')
    engine = payload_data.get('engine', 'openai')
    
    if not user_message:
        return jsonify({'status': 'error', 'message': 'Empty payload'}), 400

    # Guard rail block checking configuration availability before hitting models
    if engine == 'openai' and not ENGINE_CONFIG["openai_available"]:
        return jsonify({'status': 'error', 'message': 'OpenAI execution engine is blocked from backend'}), 403
    if engine == 'ollama' and not ENGINE_CONFIG["ollama_available"]:
        return jsonify({'status': 'error', 'message': 'Ollama execution engine is blocked from backend'}), 403
    
    system_prompt = (
        "You are Kapruka Gift Guru, a warm, witty, and exceptionally helpful Sri Lankan personal shopping assistant. "
        "You understand English, Sinhala, and perfectly converse in native Tanglish. "
        "IMPORTANT: When a user looks for an item, you MUST call 'kapruka_search_products' tool to query real inventory. "
        "Do not invent products. Always greet beautifully like a local friend."
    )

    try:
        structured_products = None
        bot_reply = ""

        if engine == 'openai':
            messages = [
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": user_message}
            ]
            response = OPENAI_CLIENT.chat.completions.create(
                model=OPENAI_MODEL_NAME,
                messages=messages,
                tools=KAPRUKA_TOOLS_SCHEMA,
                tool_choice="auto"
            )
            response_message = response.choices[0].message
            
            if response_message.tool_calls:
                tool_call = response_message.tool_calls[0]
                args = json.loads(tool_call.function.arguments)
                mcp_raw_output = call_kapruka_mcp(tool_call.function.name, args)
                try:
                    structured_products = json.loads(mcp_raw_output)
                except:
                    structured_products = mcp_raw_output
                
                messages.append(response_message)
                messages.append({
                    "role": "tool",
                    "tool_call_id": tool_call.id,
                    "name": tool_call.function.name,
                    "content": mcp_raw_output
                })
                second_response = OPENAI_CLIENT.chat.completions.create(
                    model=OPENAI_MODEL_NAME,
                    messages=messages
                )
                bot_reply = second_response.choices[0].message.content
            else:
                bot_reply = response_message.content

        elif engine == 'ollama':
            is_search_intent = any(keyword in user_message.lower() for keyword in ['cake', 'gift', 'hampers', 'buy', 'search', 'hoyanna', 'mila', 'under'])
            
            if is_search_intent:
                search_args = {"q": user_message}
                mcp_raw_output = call_kapruka_mcp("kapruka_search_products", search_args)
                try:
                    structured_products = json.loads(mcp_raw_output)
                except:
                    structured_products = mcp_raw_output
                
                prompt_with_data = f"{system_prompt}\n\nThe live inventory search results for '{user_message}' are: {mcp_raw_output}\nFormulate a warm response in natural text/Tanglish acknowledging these results."
                ollama_payload = {
                    "model": OLLAMA_MODEL_NAME,
                    "messages": [{"role": "user", "content": prompt_with_data}],
                    "stream": False
                }
                ollama_res = requests.post(OLLAMA_API_URL, json=ollama_payload, timeout=30)
                bot_reply = ollama_res.json()['message']['content']
            else:
                ollama_payload = {
                    "model": OLLAMA_MODEL_NAME,
                    "messages": [
                        {"role": "system", "content": system_prompt},
                        {"role": "user", "content": user_message}
                    ],
                    "stream": False
                }
                ollama_res = requests.post(OLLAMA_API_URL, json=ollama_payload, timeout=30)
                bot_reply = ollama_res.json()['message']['content']

        return jsonify({
            'status': 'success',
            'reply': bot_reply,
            'data': structured_products
        })

    except Exception as e:
        return jsonify({
            'status': 'success',
            'reply': f"Guru Engine Notice: Active route failed via {engine.upper()}. Log: {str(e)}",
            'data': None
        })

if __name__ == '__main__':
    app.run(debug=True, port=5000)