// State Tracker holding operational conversational arrays
let conversationHistory = null;
let typingIndicatorRow = null;

// DOM Target Selectors
const chatWindow = document.getElementById("chat-window");
const chatForm = document.getElementById("chat-form");
const userInput = document.getElementById("user-input");
const welcomeCard = document.getElementById("welcome-card");
const newChatBtn = document.getElementById("new-chat-btn");

function escapeHtml(value) {
    return String(value)
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/\"/g, "&quot;")
        .replace(/'/g, "&#39;");
}

function buildProductCard(product) {
    let stockClass = 'stock-low';
    const stockCheck = (product.stock || '').toLowerCase();
    if (stockCheck.includes('high')) stockClass = 'stock-high';
    else if (stockCheck.includes('medium')) stockClass = 'stock-medium';

    return `
    <div class="product-card">
        <div>
            <div class="product-name">${escapeHtml(product.name || '')}</div>
            <div class="product-summary">${escapeHtml(product.summary || '')}</div>
            <div class="product-shipping">
                🌏 Ships Internationally: <strong>${escapeHtml(product.ships || '')}</strong>
            </div>
            <div class="product-meta">
                <span class="product-price">${escapeHtml(product.price || '')}</span>
                <span class="product-stock ${stockClass}">${escapeHtml(product.stock || '')}</span>
            </div>
        </div>
        <a href="${escapeHtml(product.url || '#')}" target="_blank" class="product-action-btn" rel="noopener noreferrer">
            ${escapeHtml(product.linkText || 'View Product')} <i class="fa-solid fa-arrow-up-right-from-square" style="font-size:0.8rem; margin-left:4px;"></i>
        </a>
    </div>`;
}

function buildTrackItemLine(line) {
    return `
        <div class="track-item-line">
            <i class="fa-solid fa-cube" style="color: var(--primary-purple); opacity:0.7;"></i>
            <span>${escapeHtml(line)}</span>
        </div>`;
}

function buildTrackCard(track) {
    let statusClass = 'status-pending';
    const statusCheck = (track.status || '').toLowerCase();
    if (statusCheck.includes('deliver') || statusCheck.includes('complet')) statusClass = 'status-delivered';
    else if (statusCheck.includes('transit') || statusCheck.includes('dispatch') || statusCheck.includes('ship')) statusClass = 'status-transit';
    else if (statusCheck.includes('cancel')) statusClass = 'status-cancelled';

    const itemsHtml = (track.items || [])
        .map((item) => buildTrackItemLine(item))
        .join('');

    return `
    <div class="track-card">
        <div class="track-header">
            <div class="track-title"><i class="fa-solid fa-box-open"></i> Order #${escapeHtml(track.orderNumber || '')}</div>
            <div class="track-status ${statusClass}">${escapeHtml(track.status || '')}</div>
        </div>
        <div class="track-body">
            <div class="track-info-col">
                <div class="track-label">Delivery Date</div>
                <div class="track-value">${escapeHtml(track.deliveryDate || '')}</div>
                <div class="track-label mt-2">Payment Details</div>
                <div class="track-value">${escapeHtml(track.amount || '')}</div>
                <div class="track-sub-value">${escapeHtml(track.paymentMethod || '')}</div>
            </div>
            <div class="track-info-col">
                <div class="track-label">Recipient</div>
                <div class="track-value">${escapeHtml(track.recipientName || '')}</div>
                <div class="track-sub-value"><i class="fa-solid fa-phone"></i> ${escapeHtml(track.recipientPhone || '')}</div>
                <div class="track-sub-value"><i class="fa-solid fa-location-dot"></i> ${escapeHtml(track.recipientAddress || '')}</div>
            </div>
        </div>
        <div class="track-items-container">
            <div class="track-label">Items in Order</div>
            ${itemsHtml}
        </div>
    </div>`;
}

function parseTrackBlock(block) {
    const fieldPatterns = {
        orderNumber: /(?:^|\n)\s*(?:-\s*|\d+\.\s*)?\*\*Order Number\*\*:\s*(.+?)(?=\n\s*(?:-\s*|\d+\.\s*)?\*\*|$)/is,
        status: /(?:^|\n)\s*(?:-\s*|\d+\.\s*)?\*\*Status\*\*:\s*(.+?)(?=\n\s*(?:-\s*|\d+\.\s*)?\*\*|$)/is,
        deliveryDate: /(?:^|\n)\s*(?:-\s*|\d+\.\s*)?\*\*Delivery Date\*\*:\s*(.+?)(?=\n\s*(?:-\s*|\d+\.\s*)?\*\*|$)/is,
        paymentMethod: /(?:^|\n)\s*(?:-\s*|\d+\.\s*)?\*\*Payment Method\*\*:\s*(.+?)(?=\n\s*(?:-\s*|\d+\.\s*)?\*\*|$)/is,
        amount: /(?:^|\n)\s*(?:-\s*|\d+\.\s*)?\*\*Amount\*\*:\s*(.+?)(?=\n\s*(?:-\s*|\d+\.\s*)?\*\*|$)/is,
        recipientDetails: /(?:^|\n)\s*(?:-\s*|\d+\.\s*)?\*\*Recipient Details\*\*:\s*(.+?)(?=\n\s*(?:-\s*|\d+\.\s*)?\*\*|$)/is,
        itemsDetails: /(?:^|\n)\s*(?:-\s*|\d+\.\s*)?\*\*Items Details\*\*:\s*([\s\S]*?)(?=\n\s*(?:-\s*|\d+\.\s*)?\*\*|$)/is
    };

    const matches = {};
    for (const [key, pattern] of Object.entries(fieldPatterns)) {
        const found = block.match(pattern);
        if (!found) {
            return null;
        }
        matches[key] = found[1].trim();
    }

    const recipientName = matches.recipientDetails.match(/Name:\s*(.+?)(?=\n|\r|$)/i)?.[1]?.trim() || '';
    const recipientPhone = matches.recipientDetails.match(/Phone:\s*(.+?)(?=\n|\r|$)/i)?.[1]?.trim() || '';
    const recipientAddress = matches.recipientDetails.match(/Address:\s*(.+?)(?=\n|\r|$)/is)?.[1]?.trim() || '';

    const items = matches.itemsDetails
        .split(/\r?\n/)
        .map((line) => line.replace(/^\s*[-*]\s*/, '').trim())
        .filter(Boolean)
        .map((line) => line.replace(/`/g, ''));

    return {
        orderNumber: matches.orderNumber,
        status: matches.status,
        deliveryDate: matches.deliveryDate,
        paymentMethod: matches.paymentMethod,
        amount: matches.amount,
        recipientName,
        recipientPhone,
        recipientAddress,
        items
    };
}

function parseProductBlock(block) {
    const fieldPatterns = {
        name: /(?:^|\n)\s*(?:-\s*|\d+\.\s*)?\*\*Name\*\*:\s*(.+?)(?=\n\s*(?:-\s*|\d+\.\s*)?\*\*|$)/is,
        summary: /(?:^|\n)\s*(?:-\s*|\d+\.\s*)?\*\*Summary\*\*:\s*(.+?)(?=\n\s*(?:-\s*|\d+\.\s*)?\*\*|$)/is,
        price: /(?:^|\n)\s*(?:-\s*|\d+\.\s*)?\*\*Price\*\*:\s*(.+?)(?=\n\s*(?:-\s*|\d+\.\s*)?\*\*|$)/is,
        stock: /(?:^|\n)\s*(?:-\s*|\d+\.\s*)?\*\*Stock Level\*\*:\s*(.+?)(?=\n\s*(?:-\s*|\d+\.\s*)?\*\*|$)/is,
        ships: /(?:^|\n)\s*(?:-\s*|\d+\.\s*)?\*\*Ships Internationally\*\*:\s*(.+?)(?=\n\s*(?:-\s*|\d+\.\s*)?\*\*|$)/is,
        url: /(?:^|\n)\s*(?:-\s*|\d+\.\s*)?\*\*URL\*\*:\s*\[(.*?)\]\((.*?)\)/is
    };

    const matches = {};
    for (const [key, pattern] of Object.entries(fieldPatterns)) {
        const found = block.match(pattern);
        if (!found) {
            return null;
        }
        matches[key] = found;
    }

    return {
        name: matches.name[1].trim(),
        summary: matches.summary[1].trim(),
        price: matches.price[1].trim(),
        stock: matches.stock[1].trim(),
        ships: matches.ships[1].trim(),
        linkText: matches.url[1].trim(),
        url: matches.url[2].trim()
    };
}

// Custom Robust Markdown-to-HTML Parser with inline graphics adapter
function parseMarkdown(text) {
    const sections = String(text).split(/\n{2,}/);
    const renderedSections = [];
    let productCardBuffer = [];
    let trackCardBuffer = [];

    function flushProductCards() {
        if (!productCardBuffer.length) {
            return;
        }

        renderedSections.push(`<div class="products-grid">${productCardBuffer.join('')}</div>`);
        productCardBuffer = [];
    }

    function flushTrackCards() {
        if (!trackCardBuffer.length) {
            return;
        }

        renderedSections.push(`<div class="track-grid">${trackCardBuffer.join('')}</div>`);
        trackCardBuffer = [];
    }

    sections.forEach((section) => {
        const product = parseProductBlock(section);
        if (product) {
            flushTrackCards();
            productCardBuffer.push(buildProductCard(product));
            return;
        }

        const track = parseTrackBlock(section);
        if (track) {
            flushProductCards();
            trackCardBuffer.push(buildTrackCard(track));
            return;
        }

        flushProductCards();
        flushTrackCards();

        let htmlSection = section;

        htmlSection = htmlSection.replace(/!\[(.*?)\]\((.*?)\)/g, '<img src="$2" alt="$1" style="max-width: 100%; border-radius: 12px; margin: 12px 0; box-shadow: 0 4px 12px rgba(0,0,0,0.08); display: block;" />');
        htmlSection = htmlSection.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');
        htmlSection = htmlSection.replace(/`(.*?)`/g, '<code>$1</code>');
        htmlSection = htmlSection.replace(/(?<!href=")(?<!">)\[(.*?)\]\((.*?)\)/g, '<a href="$2" target="_blank" rel="noopener noreferrer">$1 <i class="fa-solid fa-arrow-up-right-from-square" style="font-size:0.75rem;"></i></a>');

        renderedSections.push(htmlSection);
    });

    flushProductCards();
    flushTrackCards();

    let html = renderedSections.join('<br/><br/>');

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
function appendTypingIndicator(statusText = "Guru Analyzing Query") {
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
            updateTypingIndicator(payload.tool || "Guru Analyzing Query");
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