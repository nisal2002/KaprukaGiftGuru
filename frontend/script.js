// State Tracker holding operational conversational arrays
let conversationHistory = null;
let typingIndicatorRow = null;

// DOM Target Selectors
const chatWindow = document.getElementById("chat-window");
const chatForm = document.getElementById("chat-form");
const userInput = document.getElementById("user-input");
const welcomeCard = document.getElementById("welcome-card");
const newChatBtn = document.getElementById("new-chat-btn");

// Custom Robust Markdown-to-HTML Parser with inline graphics adapter
function parseMarkdown(text) {
    let html = text;
    
    // 1. Image Conversion Pattern: ![alt](url)
    html = html.replace(/!\[(.*?)\]\((.*?)\)/g, '<img src="$2" alt="$1" style="max-width: 100%; border-radius: 12px; margin: 12px 0; box-shadow: 0 4px 12px rgba(0,0,0,0.08); display: block;" />');
    
    // 2. Strong Headers Conversion Pattern
    html = html.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');
    
    // 3. Inline Code Fragments
    html = html.replace(/`(.*?)`/g, '<code>$1</code>');
    
    // 4. Anchor Hyperlinks Conversion Pattern: [text](url)
    html = html.replace(/\[(.*?)\]\((.*?)\)/g, '<a href="$2" target="_blank">$1 <i class="fa-solid fa-arrow-up-right-from-square" style="font-size:0.75rem;"></i></a>');
    
    // 5. Convert Double Linebreaks to Segment Paragraphs safely
    html = html.replace(/\n\n/g, '<br/><br/>');

    return html;
}

// Append rendering function into scroll container
function appendMessage(sender, content, isRawHtml = false) {
    // Drop the instruction card out on first input
    if (welcomeCard) {
        welcomeCard.style.display = "none";
    }

    const row = document.createElement("div");
    row.classList.add("message-row", sender);

    const bubble = document.createElement("div");
    bubble.classList.add("bubble");
    
    if (isRawHtml) {
        bubble.innerHTML = content;
    } else {
        bubble.innerHTML = parseMarkdown(content);
    }

    row.appendChild(bubble);
    chatWindow.appendChild(row);
    
    // Smooth lock scroll tracking
    chatWindow.scrollTop = chatWindow.scrollHeight;
    return row;
}

// Render dynamic animated typing dots block
function appendTypingIndicator(statusText = "Analyzing Query") {
    const row = document.createElement("div");
    row.classList.add("message-row", "guru");
    row.id = "typing-indicator-row";

    const bubble = document.createElement("div");
    bubble.classList.add("bubble");

    const indicator = document.createElement("div");
    indicator.classList.add("typing-indicator");
    indicator.innerHTML = `
        <span class="typing-status">${statusText}</span>
        <div class="typing-dots" aria-hidden="true">
            <div class="typing-dot"></div>
            <div class="typing-dot"></div>
            <div class="typing-dot"></div>
        </div>
    `;

    bubble.appendChild(indicator);
    row.appendChild(bubble);
    chatWindow.appendChild(row);
    chatWindow.scrollTop = chatWindow.scrollHeight;
    typingIndicatorRow = row;
}

function updateTypingIndicator(statusText) {
    const statusNode = typingIndicatorRow ? typingIndicatorRow.querySelector(".typing-status") : null;
    if (statusNode && statusText) {
        statusNode.textContent = statusText;
    }
}

function parseSseEventBlock(block) {
    const lines = block.split(/\r?\n/);
    let eventType = "message";
    const dataLines = [];

    lines.forEach((line) => {
        if (line.startsWith("event:")) {
            eventType = line.slice(6).trim();
        } else if (line.startsWith("data:")) {
            dataLines.push(line.slice(5).trim());
        }
    });

    if (!dataLines.length) {
        return null;
    }

    try {
        return {
            eventType,
            data: JSON.parse(dataLines.join("\n"))
        };
    } catch (error) {
        console.error("Failed to parse streamed event:", error);
        return null;
    }
}

// Remove animated indicator once stream payloads hit
function removeTypingIndicator() {
    const indicator = document.getElementById("typing-indicator-row");
    if (indicator) {
        indicator.remove();
    }
    typingIndicatorRow = null;
}

// Synchronous Network Gateway connecting to FastAPI endpoints
async function sendMessageToAgent(messageText) {
    appendMessage("user", messageText);
    appendTypingIndicator();

    // Build EventSource GET URL (encode history as JSON string when present)
    const params = new URLSearchParams();
    params.append("message", messageText);
    if (conversationHistory) {
        try {
            params.append("history", JSON.stringify(conversationHistory));
        } catch (e) {
            // ignore history if it can't be serialized
        }
    }

    const es = new EventSource(`/api/chat/stream?${params.toString()}`);

    es.addEventListener("status", (e) => {
        try {
            const payload = JSON.parse(e.data);
            updateTypingIndicator(payload.tool || "Analyzing Query...");
        } catch (err) {
            console.error("Malformed status event:", err);
        }
    });

    es.addEventListener("final", (e) => {
        try {
            const payload = JSON.parse(e.data);
            if (payload.history) conversationHistory = payload.history;
            appendMessage("guru", payload.reply);
        } catch (err) {
            console.error("Malformed final event:", err);
            appendMessage("guru", "I received an invalid reply from the server.");
        }
        removeTypingIndicator();
        es.close();
    });

    es.addEventListener("error", (e) => {
        console.error("SSE error event:", e);
        removeTypingIndicator();
        appendMessage("guru", "I encountered a minor hitch linking up with the Kapruka server. Let's try that query one more time.");
        es.close();
    });
}

// Event Listeners Handlers
chatForm.addEventListener("submit", (e) => {
    e.preventDefault();

    // Safely get the input value
    const query = userInput.value.strip ? userInput.value.strip() : userInput.value.trim();
    if (!query) return;
    
    userInput.value = "";
    sendMessageToAgent(query);
});

// Setup click action on prompt suggestion chips
document.querySelectorAll(".prompt-chip").forEach(chip => {
    chip.addEventListener("click", () => {
        // Strip out the emoji and grab the text
        const text = chip.innerText.substring(2).trim();
        sendMessageToAgent(text);
    });
});

// Refresh / Reset Session Setup
newChatBtn.addEventListener("click", () => {
    conversationHistory = null;
    chatWindow.innerHTML = "";
    if (welcomeCard) {
        chatWindow.appendChild(welcomeCard);
        welcomeCard.style.display = "block";
    }
});