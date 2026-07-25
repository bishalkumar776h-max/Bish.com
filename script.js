// ===== DIRECT EXTERNAL AI API (multi-proxy parallel race, no backend needed) =====
const EXTERNAL_AI_API = "https://bishal-paswan-ai.vercel.app/ask";
const EXTERNAL_AI_KEY = "s";

// ===== NAVIGATION =====
function toggleMenu() {
    document.getElementById('navLinks').classList.toggle('active');
}

function scrollToSection(id) {
    document.getElementById(id).scrollIntoView({ behavior: 'smooth' });
    document.getElementById('navLinks').classList.remove('active');
}

// ===== RELIABLE CLICK HANDLING (event delegation) =====
// Attached immediately at script load (not waiting for DOMContentLoaded),
// so there's zero timing window where a tap could land before listeners exist.
// Works even for taps that land on the icon *inside* a button.
document.addEventListener('click', function(e) {
    const sendBtn = e.target.closest('.send-btn');
    if (sendBtn) {
        e.preventDefault();
        sendMessage();
        return;
    }

    const genBtn = e.target.closest('.gen-btn');
    if (genBtn) {
        e.preventDefault();
        generateImage();
        return;
    }

    const styleBtn = e.target.closest('.style-buttons button');
    if (styleBtn) {
        e.preventDefault();
        document.querySelectorAll('.style-buttons button').forEach(b => b.classList.remove('active'));
        styleBtn.classList.add('active');
        currentStyle = styleBtn.dataset.style;
        return;
    }
});

// ===== DEBOUNCE HELPER =====
function debounce(func, wait = 500) {
    let timeout;
    return function(...args) {
        clearTimeout(timeout);
        timeout = setTimeout(() => func.apply(this, args), wait);
    };
}

// ===== AI CHAT =====
let isProcessing = false;

async function sendMessage() {
    if (isProcessing) {
        showNotification('⏳ Please wait for the previous response...');
        return;
    }
    
    const input = document.getElementById('chatInput');
    const message = input.value.trim();
    if (!message) return;
    
    isProcessing = true;
    
    const messages = document.getElementById('chatMessages');
    
    // Add user message
    messages.innerHTML += `
        <div class="msg user">
            <div class="avatar"><i class="fas fa-user"></i></div>
            <div class="content">${escapeHtml(message)}</div>
        </div>
    `;
    
    input.value = '';
    messages.scrollTop = messages.scrollHeight;
    
    // Add typing indicator
    const typingId = Date.now();
    messages.innerHTML += `
        <div class="msg bot" id="typing-${typingId}">
            <div class="avatar"><i class="fas fa-robot"></i></div>
            <div class="content">
                <div class="typing-dots">
                    <span></span><span></span><span></span>
                </div>
            </div>
        </div>
    `;
    messages.scrollTop = messages.scrollHeight;
    
    try {
        const model = document.getElementById('modelSelect').value;
        const targetUrl = `${EXTERNAL_AI_API}?key=${EXTERNAL_AI_KEY}&model=${encodeURIComponent(model)}&message=${encodeURIComponent(message)}`;

        // Try the endpoint directly first (fastest, and works if it already
        // sends CORS headers), then fall back to public CORS proxies only if
        // the direct call fails.
        const candidateUrls = [
            targetUrl,
            `https://api.allorigins.win/raw?url=${encodeURIComponent(targetUrl)}`,
            `https://corsproxy.io/?url=${encodeURIComponent(targetUrl)}`,
            `https://api.codetabs.com/v1/proxy?quest=${encodeURIComponent(targetUrl)}`
        ];

        async function tryUrl(url) {
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), 10000);
            try {
                const response = await fetch(url, { signal: controller.signal });
                clearTimeout(timeoutId);
                if (!response.ok) throw new Error(`HTTP ${response.status}`);
                const json = await response.json();
                if (json && (json.reply || json.message)) return json;
                throw new Error('empty response');
            } catch (e) {
                clearTimeout(timeoutId);
                throw e;
            }
        }

        let data;
        try {
            // Direct call gets first shot; proxies are the fallback.
            data = await tryUrl(candidateUrls[0]);
        } catch (directError) {
            try {
                data = await Promise.any(candidateUrls.slice(1).map(tryUrl));
            } catch (e) {
                throw new Error('All endpoints failed: ' + directError.message);
            }
        }

        const typingEl = document.getElementById(`typing-${typingId}`);
        if (typingEl) typingEl.remove();

        let replyText = "I'm here to help! What would you like to know?";
        let modelDisplay = "AI";
        let isFallback = true;

        const reply = data && (data.reply || data.message);
        if (reply) {
            replyText = reply;
            modelDisplay = data.model || model;
            isFallback = false;
        }
        
        messages.innerHTML += `
            <div class="msg bot">
                <div class="avatar"><i class="fas fa-robot"></i></div>
                <div class="content">
                    ${escapeHtml(replyText)}
                    <div style="font-size:0.7rem;color:var(--text-faint);margin-top:6px;border-top:1px solid var(--border);padding-top:4px;display:flex;justify-content:space-between;align-items:center;">
                        <span>🤖 ${escapeHtml(modelDisplay)}</span>
                        ${isFallback ? '<span style="color:#f0c36d;">💡 Fallback Mode</span>' : ''}
                    </div>
                </div>
            </div>
        `;
        messages.scrollTop = messages.scrollHeight;
        
    } catch (error) {
        const typingEl = document.getElementById(`typing-${typingId}`);
        if (typingEl) typingEl.remove();
        
        const fallbackReplies = [
            "I'm here to help! What would you like to know?",
            "That's a great question! Let me think about that...",
            "Interesting! Tell me more about what you're looking for.",
            "I'm glad you asked! Here's what I think...",
            "Let me help you with that. Can you give me more details?"
        ];
        
        messages.innerHTML += `
            <div class="msg bot">
                <div class="avatar"><i class="fas fa-robot"></i></div>
                <div class="content">
                    ${escapeHtml(fallbackReplies[Math.floor(Math.random() * fallbackReplies.length)])}
                    <div style="font-size:0.7rem;color:var(--text-faint);margin-top:6px;border-top:1px solid var(--border);padding-top:4px;">
                        🤖 AI (💡 Fallback Mode)
                    </div>
                </div>
            </div>
        `;
        messages.scrollTop = messages.scrollHeight;
    }
    
    isProcessing = false;
}

// Enter key to send
document.addEventListener('DOMContentLoaded', () => {
    const input = document.getElementById('chatInput');
    if (input) {
        input.addEventListener('keypress', (e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                sendMessage();
            }
        });
    }
});

// ===== IMAGE GENERATION =====
let currentStyle = 'realistic';

let isGenerating = false;

async function generateImage() {
    if (isGenerating) {
        showNotification('⏳ Please wait, already generating...');
        return;
    }

    const prompt = document.getElementById('imagePrompt').value.trim();
    if (!prompt) {
        showNotification('Please describe your image!');
        return;
    }

    isGenerating = true;
    const result = document.getElementById('imageResult');
    result.innerHTML = `
        <div class="loading">
            <div class="spinner"></div>
            <p>Generating your image...</p>
        </div>
    `;
    
    try {
        const styleMap = {
            'realistic': 'realistic photo high detail 4k',
            'anime': 'anime style vibrant colors masterpiece',
            'digital art': 'digital art painting detailed',
            'hd': 'ultra hd 8k quality sharp',
            'cyberpunk': 'cyberpunk futuristic neon city',
            'portrait': 'professional portrait detailed face',
            'landscape': 'beautiful landscape scenic nature',
            'fantasy': 'fantasy magical epic detailed'
        };

        const stylePrompt = styleMap[currentStyle] || currentStyle;
        const finalPrompt = `${stylePrompt}, ${prompt}, high quality, masterpiece, no watermark, 4k`;
        const imageUrl = `https://image.pollinations.ai/prompt/${encodeURIComponent(finalPrompt)}?width=1024&height=1024`;

        result.innerHTML = `
            <div class="result-image">
                <img src="${imageUrl}" alt="Generated image" loading="lazy">
                <div class="result-actions">
                    <button onclick="window.open('${imageUrl}', '_blank')" class="download-btn">
                        <i class="fas fa-external-link-alt"></i> Open
                    </button>
                    <button onclick="downloadImage('${imageUrl}')" class="download-btn">
                        <i class="fas fa-download"></i> Download
                    </button>
                </div>
            </div>
        `;
    } catch (error) {
        result.innerHTML = `
            <div class="placeholder">
                <i class="fas fa-exclamation-triangle"></i>
                <p>Error: ${escapeHtml(error.message)}</p>
            </div>
        `;
    }

    isGenerating = false;
}

function downloadImage(url) {
    window.open(url, '_blank');
}

// ===== IMAGE RESIZE =====
let originalImage = null;
let originalWidth = 0, originalHeight = 0;

document.addEventListener('DOMContentLoaded', () => {
    const uploadArea = document.getElementById('uploadArea');
    const fileInput = document.getElementById('imageUpload');
    
    if (uploadArea && fileInput) {
        uploadArea.addEventListener('click', () => fileInput.click());
        
        uploadArea.addEventListener('dragover', (e) => {
            e.preventDefault();
            uploadArea.style.borderColor = '#7c3aed';
        });
        
        uploadArea.addEventListener('dragleave', () => {
            uploadArea.style.borderColor = '#333';
        });
        
        uploadArea.addEventListener('drop', (e) => {
            e.preventDefault();
            uploadArea.style.borderColor = '#333';
            const file = e.dataTransfer.files[0];
            if (file) handleImageUpload(file);
        });
        
        fileInput.addEventListener('change', (e) => {
            if (e.target.files[0]) handleImageUpload(e.target.files[0]);
        });
    }
});

function handleImageUpload(file) {
    const reader = new FileReader();
    reader.onload = (e) => {
        const img = new Image();
        img.onload = () => {
            originalImage = img;
            originalWidth = img.width;
            originalHeight = img.height;
            
            document.getElementById('widthInput').value = originalWidth;
            document.getElementById('heightInput').value = originalHeight;
            document.getElementById('resizeControls').style.display = 'block';
            document.getElementById('resizeResult').style.display = 'none';
            
            showNotification('Image uploaded! ✅');
        };
        img.src = e.target.result;
    };
    reader.readAsDataURL(file);
}

function applyResize() {
    if (!originalImage) {
        showNotification('Please upload an image first!');
        return;
    }
    
    const width = parseInt(document.getElementById('widthInput').value);
    const height = parseInt(document.getElementById('heightInput').value);
    
    if (!width || !height || width <= 0 || height <= 0) {
        showNotification('Enter valid dimensions!');
        return;
    }
    
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d');
    ctx.drawImage(originalImage, 0, 0, width, height);
    
    const result = document.getElementById('resizeResult');
    const img = document.getElementById('resizedImage');
    img.src = canvas.toDataURL('image/jpeg', 0.9);
    result.style.display = 'block';
    
    window.resizedData = img.src;
    showNotification('Image resized! ✨');
}

function downloadResized() {
    if (window.resizedData) {
        const link = document.createElement('a');
        link.href = window.resizedData;
        link.download = `resized-${Date.now()}.jpg`;
        link.click();
        showNotification('Downloading... 📥');
    }
}

// ===== UTILITY FUNCTIONS =====
function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

function showNotification(msg) {
    document.querySelectorAll('.notification').forEach(el => el.remove());
    const div = document.createElement('div');
    div.className = 'notification';
    div.textContent = msg;
    document.body.appendChild(div);
    setTimeout(() => div.remove(), 4000);
}

// ===== THEME SWITCHER =====
function setTheme(name) {
    if (name === 'champagne') {
        document.documentElement.removeAttribute('data-theme');
    } else {
        document.documentElement.setAttribute('data-theme', name);
    }
    try { localStorage.setItem('bishal-theme', name); } catch (e) {}
    document.querySelectorAll('.theme-swatch').forEach(s => {
        s.classList.toggle('active', s.dataset.swatch === name);
    });
}

function setBg(hex) {
    document.documentElement.style.setProperty('--bg', hex);

    const r = parseInt(hex.substr(1, 2), 16), g = parseInt(hex.substr(3, 2), 16), b = parseInt(hex.substr(5, 2), 16);
    const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
    if (luminance > 0.6) {
        document.documentElement.style.setProperty('--text', '#14100a');
        document.documentElement.style.setProperty('--text-muted', '#4a4640');
        document.documentElement.style.setProperty('--text-faint', '#7a766e');
        document.documentElement.style.setProperty('--surface', 'rgba(0,0,0,0.045)');
        document.documentElement.style.setProperty('--border', 'rgba(0,0,0,0.12)');
        document.documentElement.style.setProperty('--border-strong', 'rgba(0,0,0,0.22)');
    } else {
        document.documentElement.style.removeProperty('--text');
        document.documentElement.style.removeProperty('--text-muted');
        document.documentElement.style.removeProperty('--text-faint');
        document.documentElement.style.removeProperty('--surface');
        document.documentElement.style.removeProperty('--border');
        document.documentElement.style.removeProperty('--border-strong');
    }

    try { localStorage.setItem('bishal-bg', hex); } catch (e) {}
    document.querySelectorAll('.bg-swatch[data-bg]').forEach(s => {
        s.classList.toggle('active', s.dataset.bg.toLowerCase() === hex.toLowerCase());
    });
    const picker = document.getElementById('bgColorPicker');
    if (picker) picker.value = hex;
}

function toggleThemePanel() {
    document.getElementById('themeOptions').classList.toggle('open');
}

function setUIStyle(name) {
    if (name === 'glass') {
        document.documentElement.removeAttribute('data-ui');
    } else {
        document.documentElement.setAttribute('data-ui', name);
    }
    try { localStorage.setItem('bishal-ui', name); } catch (e) {}
    document.querySelectorAll('.ui-pill[data-ui]').forEach(p => {
        p.classList.toggle('active', p.dataset.ui === name);
    });
}

function setPageStyle(name) {
    if (name === 'classic') {
        document.documentElement.removeAttribute('data-page');
    } else {
        document.documentElement.setAttribute('data-page', name);
    }
    try { localStorage.setItem('bishal-page', name); } catch (e) {}
    document.querySelectorAll('.ui-pill[data-page]').forEach(p => {
        p.classList.toggle('active', p.dataset.page === name);
    });
}

function setAnimSpeed(name) {
    if (name === 'default') {
        document.documentElement.style.removeProperty('--aurora-dur');
        document.documentElement.removeAttribute('data-anim');
    } else if (name === 'off') {
        document.documentElement.setAttribute('data-anim', 'off');
        document.documentElement.style.removeProperty('--aurora-dur');
    } else {
        document.documentElement.removeAttribute('data-anim');
        document.documentElement.style.setProperty('--aurora-dur', name + 's');
    }
    try { localStorage.setItem('bishal-anim', name); } catch (e) {}
    document.querySelectorAll('.ui-pill[data-anim]').forEach(p => {
        p.classList.toggle('active', p.dataset.anim === name);
    });
}

document.addEventListener('DOMContentLoaded', () => {
    let saved = 'champagne';
    try { saved = localStorage.getItem('bishal-theme') || 'champagne'; } catch (e) {}
    setTheme(saved);

    let savedBg = null;
    try { savedBg = localStorage.getItem('bishal-bg'); } catch (e) {}
    if (savedBg) setBg(savedBg);

    let savedUI = 'glass';
    try { savedUI = localStorage.getItem('bishal-ui') || 'glass'; } catch (e) {}
    setUIStyle(savedUI);

    let savedPage = 'classic';
    try { savedPage = localStorage.getItem('bishal-page') || 'classic'; } catch (e) {}
    setPageStyle(savedPage);

    let savedAnim = 'default';
    try { savedAnim = localStorage.getItem('bishal-anim') || 'default'; } catch (e) {}
    setAnimSpeed(savedAnim);

    document.addEventListener('click', (e) => {
        const switcher = document.querySelector('.theme-switcher');
        if (switcher && !switcher.contains(e.target)) {
            document.getElementById('themeOptions').classList.remove('open');
        }
    });
});

// ===== GOOGLE LOGIN =====
function openLoginModal() {
    document.getElementById('loginModal').classList.add('open');
    renderGoogleButton();
}

function closeLoginModal() {
    document.getElementById('loginModal').classList.remove('open');
}

function renderGoogleButton() {
    if (typeof google === 'undefined' || !google.accounts) return;
    const clientId = document.querySelector('meta[name="google-signin-client_id"]').content;
    if (!clientId) {
        document.getElementById('googleSignInBtn').innerHTML =
            '<p style="color:#e08a8a;font-size:0.85rem;">Google Client ID not configured yet.</p>';
        return;
    }
    google.accounts.id.initialize({
        client_id: clientId,
        callback: handleGoogleCredential
    });
    google.accounts.id.renderButton(
        document.getElementById('googleSignInBtn'),
        { theme: 'filled_black', size: 'large', shape: 'pill', width: 280 }
    );
}

async function handleGoogleCredential(response) {
    // Google login needs a backend to verify the token — not available in
    // this static (no-backend) build. Disabled to avoid a broken fetch.
    showNotification('Login is not available in this version.');
}

function showLoggedInUser(user) {
    document.getElementById('loginBtn').style.display = 'none';
    const chip = document.getElementById('userChip');
    chip.style.display = 'flex';
    document.getElementById('userAvatar').src = user.picture || '';
    document.getElementById('userName').textContent = user.name || user.email || 'Account';
}

async function logout() {
    document.getElementById('userChip').style.display = 'none';
    document.getElementById('loginBtn').style.display = 'flex';
    showNotification('Logged out 👋');
}

// Login check disabled — no backend in this static build.

// ===== SCROLL REVEAL =====
document.addEventListener('DOMContentLoaded', () => {
    const revealEls = document.querySelectorAll('.reveal');
    if (!revealEls.length) return;

    const observer = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                entry.target.classList.add('in');
                observer.unobserve(entry.target);
            }
        });
    }, { threshold: 0.15, rootMargin: '0px 0px -60px 0px' });

    revealEls.forEach(el => observer.observe(el));
});

// ===== NAVBAR SCROLL SHADOW =====
document.addEventListener('DOMContentLoaded', () => {
    const nav = document.querySelector('.navbar');
    if (!nav) return;
    const onScroll = () => nav.classList.toggle('scrolled', window.scrollY > 12);
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
});

// Health check removed — no backend in this static build. The AI chat and
// image generation call external APIs directly (see EXTERNAL_AI_API above).

console.log('🚀 BISHAL AI Loaded Successfully!');
console.log('✅ NO RATE LIMITS - Unlimited requests!');
console.log('💡 Fallback Mode: ON');