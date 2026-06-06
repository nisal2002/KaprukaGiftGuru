document.addEventListener('DOMContentLoaded', () => {
    const chatForm = document.getElementById('chat-form');
    const userInput = document.getElementById('user-input');
    const chatWindow = document.getElementById('chat-window');
    const modelEngineSelect = document.getElementById('model-engine');
    const sendButton = chatForm.querySelector('button[type="submit"]');

    // Fetch and apply availability configurations on system load
    loadEngineSettings();

    async function loadEngineSettings() {
        try {
            const res = await fetch('/api/config');
            const config = await res.json();

            const openAiOption = modelEngineSelect.querySelector('option[value="openai"]');
            const ollamaOption = modelEngineSelect.querySelector('option[value="ollama"]');

            // 1. Check & modify option selection states based on backend limits
            if (!config.openai_available) {
                openAiOption.disabled = true;
                openAiOption.text = "❌ Cloud (Disabled)";
            }
            if (!config.ollama_available) {
                ollamaOption.disabled = true;
                ollamaOption.text = "❌ Local (Disabled)";
            }

            // 2. Adjust selection fallback if the default engine is blocked
            if (!config.openai_available && config.ollama_available) {
                modelEngineSelect.value = "ollama";
            } else if (config.openai_available && !config.ollama_available) {
                modelEngineSelect.value = "openai";
            }

            // 3. COMPLETE SYSTEM FREEZE LAYER
            // If both models are unavailable, freeze layout elements and declare message
            if (!config.openai_available && !config.ollama_available) {
                userInput.disabled = true;
                modelEngineSelect.disabled = true;
                sendButton.disabled = true;
                
                userInput.placeholder = "System Notice: Both computing nodes (Cloud & Local) are currently restricted by backend administration.";
                userInput.className += " bg-red-50 text-red-400 placeholder-red-400 border border-red-100 cursor-not-allowed";
                sendButton.className = "bg-slate-300 text-slate-400 font-medium text-sm px-5 py-3 rounded-xl shadow-sm cursor-not-allowed shrink-0";
            }

        } catch (err) {
            console.error("Configuration system initialization handshake failed:", err);
        }
    }

    chatForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        
        const messageText = userInput.value.trim();
        if (!messageText || userInput.disabled) return;

        appendMessage(messageText, 'user');
        userInput.value = '';

        const selectedEngine = modelEngineSelect.value;
        const typingId = appendMessage('Guru is looking into Kapruka inventory...', 'system', true);

        try {
            const response = await fetch('/api/chat', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ 
                    message: messageText,
                    engine: selectedEngine 
                })
            });

            const data = await response.json();
            document.getElementById(typingId).remove();

            if (response.status === 200 && data.status === 'success') {
                appendMessage(data.reply, 'system');
                if (data.data && Array.isArray(data.data) && data.data.length > 0) {
                    renderProductGrid(data.data);
                }
            } else {
                appendMessage(`System Notice: ${data.message || 'Operation forbidden.'}`, 'system');
            }

        } catch (error) {
            console.error('Fatal Frontend Exception Logging:', error);
            document.getElementById(typingId).remove();
            appendMessage('Ayo! Unable to communicate with your local Flask system server runtime.', 'system');
        }
    });

    function appendMessage(text, sender, isTyping = false) {
        const messageId = 'msg-' + Date.now();
        const messageWrapper = document.createElement('div');
        messageWrapper.id = messageId;
        messageWrapper.className = `flex items-start space-x-3 max-w-[80%] ${sender === 'user' ? 'ml-auto justify-end' : ''}`;

        const avatar = sender === 'user' 
            ? `<div class="w-8 h-8 rounded-full bg-slate-700 flex items-center justify-center text-white font-bold text-xs order-2 ml-3">UI</div>`
            : `<div class="w-8 h-8 rounded-full bg-emerald-600 flex items-center justify-center text-white font-bold text-xs shrink-0">GG</div>`;

        const textBubble = `
            <div class="${sender === 'user' ? 'bg-emerald-600 text-white rounded-tr-none' : 'bg-white border border-slate-200 text-slate-800 rounded-tl-none'} p-4 rounded-2xl shadow-xs">
                <p class="text-sm leading-relaxed ${isTyping ? 'italic text-slate-400' : ''}">${text}</p>
            </div>
        `;

        messageWrapper.innerHTML = sender === 'user' ? textBubble + avatar : avatar + textBubble;
        chatWindow.appendChild(messageWrapper);
        chatWindow.scrollTop = chatWindow.scrollHeight;
        
        return messageId;
    }

    function renderProductGrid(products) {
        const gridContainer = document.createElement('div');
        gridContainer.className = "grid grid-cols-1 sm:grid-cols-2 gap-4 max-w-[85%] ml-11 my-2";

        products.slice(0, 4).forEach(product => {
            const card = document.createElement('div');
            card.className = "bg-white border border-slate-200 rounded-xl overflow-hidden shadow-xs hover:border-emerald-400 transition-all flex flex-col";
            
            const imgUrl = product.image || product.imageUrl || 'https://www.kapruka.com/static/image/logo.jpg';
            const title = product.name || product.title || 'Kapruka Gift Option';
            const price = product.price ? `LKR ${product.price.toLocaleString()}` : 'Price on Request';

            card.innerHTML = `
                <div class="h-36 bg-slate-100 w-full overflow-hidden relative flex items-center justify-center">
                    <img src="${imgUrl}" alt="${title}" class="object-cover h-full w-full object-center">
                </div>
                <div class="p-3 flex-1 flex flex-col justify-between">
                    <div>
                        <h4 class="text-xs font-bold text-slate-900 line-clamp-2 mb-1">${title}</h4>
                        <p class="text-sm font-extrabold text-emerald-600">${price}</p>
                    </div>
                    <button class="mt-2 w-full bg-slate-900 hover:bg-emerald-600 text-white font-semibold text-[11px] py-1.5 px-2 rounded-md transition-all uppercase tracking-wider cursor-pointer">
                        🛒 Add to Cart
                    </button>
                </div>
            `;
            gridContainer.appendChild(card);
        });

        chatWindow.appendChild(gridContainer);
        chatWindow.scrollTop = chatWindow.scrollHeight;
    }
});