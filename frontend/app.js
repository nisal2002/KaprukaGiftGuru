document.addEventListener('DOMContentLoaded', () => {
    const chatForm = document.getElementById('chat-form');
    const userInput = document.getElementById('user-input');
    const chatWindow = document.getElementById('chat-window');

    // Handle form submission
    chatForm.addEventListener('submit', async (e) => {
        e.preventDefault(); // Stop page from refreshing
        
        const messageText = userInput.value.trim();
        if (!messageText) return;

        // 1. Render User Message on Screen
        appendMessage(messageText, 'user');
        userInput.value = ''; // Clear input field

        // 2. Show a temporary "typing..." placeholder
        const typingId = appendMessage('Guru is typing...', 'system', true);

        try {
            // 3. Post data to our Python Flask backend
            const response = await fetch('/api/chat', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ message: messageText })
            });

            const data = await response.json();
            
            // Remove the typing indicator
            document.getElementById(typingId).remove();

            if (data.status === 'success') {
                // 4. Render the backend's reply
                appendMessage(data.reply, 'system');
            } else {
                appendMessage('Sorry mchn, something went wrong on my end.', 'system');
            }

        } catch (error) {
            console.error('Error fetching chat:', error);
            document.getElementById(typingId).remove();
            appendMessage('Connection lost. Is the Flask server running?', 'system');
        }
    });

    // Helper function to dynamically inject chat bubbles
    function appendMessage(text, sender, isTyping = false) {
        const messageId = 'msg-' + Date.now();
        const messageWrapper = document.createElement('div');
        messageWrapper.id = messageId;
        messageWrapper.className = `flex items-start space-x-3 max-w-[80%] ${sender === 'user' ? 'ml-auto justify-end' : ''}`;

        // Distinct avatar styles for user vs guru
        const avatar = sender === 'user' 
            ? `<div class="w-8 h-8 rounded-full bg-slate-700 flex items-center justify-center text-white font-bold text-sm order-2 ml-3">UI</div>`
            : `<div class="w-8 h-8 rounded-full bg-emerald-600 flex items-center justify-center text-white font-bold text-sm shrink-0">GG</div>`;

        const textBubble = `
            <div class="${sender === 'user' ? 'bg-emerald-600 text-white rounded-tr-none' : 'bg-white border border-slate-100 text-slate-800 rounded-tl-none'} p-4 rounded-2xl shadow-xs">
                <p class="text-sm leading-relaxed ${isTyping ? 'italic text-slate-400' : ''}">${text}</p>
            </div>
        `;

        messageWrapper.innerHTML = sender === 'user' ? textBubble + avatar : avatar + textBubble;
        chatWindow.appendChild(messageWrapper);
        
        // Automatically scroll to the bottom of the window
        chatWindow.scrollTop = chatWindow.scrollHeight;
        
        return messageId;
    }
});