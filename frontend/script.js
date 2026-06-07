let conversationHistory = null;

const chatBox = document.getElementById('chat-box');
const userInput = document.getElementById('user-input');
const sendBtn = document.getElementById('send-btn');
const loadingIndicator = document.getElementById('loading-indicator');

// Custom Markdown-to-HTML parser to correctly present images, links, bold headers, and lists
function parseMarkdown(text) {
    let html = text;
    
    // 1. Image transformations: ![alt text](url)
    // We add some inline CSS to make the image fit nicely inside the chat bubble
    html = html.replace(/!\[(.*?)\]\((.*?)\)/g, '<img src="$2" alt="$1" style="max-width: 100%; border-radius: 8px; margin: 10px 0; box-shadow: 0 2px 5px rgba(0,0,0,0.1); display: block;" />');
    
    // 2. Bold transformations
    html = html.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');
    
    // 3. Code block transformations
    html = html.replace(/`(.*?)`/g, '<code>$1</code>');
    
    // 4. Hyperlink transformations: [text](url)
    html = html.replace(/\[(.*?)\]\((.*?)\)/g, '<a href="$2" target="_blank">$1</a>');
    
    return html;
}

function appendMessage(text, sender) {
    const messageDiv = document.createElement('div');
    messageDiv.classList.add('message', sender);
    
    if (sender === 'assistant') {
        messageDiv.innerHTML = parseMarkdown(text);
    } else {
        messageDiv.textContent = text;
    }
    
    chatBox.appendChild(messageDiv);
    chatBox.scrollTop = chatBox.scrollHeight;
}

async function sendMessage() {
    const message = userInput.value.trim();
    if (!message) return;

    appendMessage(message, 'user');
    userInput.value = '';
    
    // Show spinner loader state
    loadingIndicator.classList.remove('hidden');

    try {
        const response = await fetch('/api/chat', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                message: message,
                history: conversationHistory
            })
        });

        const data = await response.json();
        
        if (response.ok) {
            appendMessage(data.reply, 'assistant');
            conversationHistory = data.history; // Save running state tracking array
        } else {
            appendMessage(`Error: ${data.error || 'Something went wrong.'}`, 'assistant');
        }
    } catch (error) {
        appendMessage('Unable to reach the Gift Guru server. Please check your backend connection.', 'assistant');
    } finally {
        // Clear spinner loader state
        loadingIndicator.classList.add('hidden');
    }
}

sendBtn.addEventListener('click', sendMessage);
userInput.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') sendMessage();
});