const API_URL = window.location.origin.includes('localhost') ? 'http://localhost:5000/api' : '/api';

// ── AUTH CHECK ────────────────────────────────────────────────
// Get token safely — works both on file:// and http://
const token = localStorage.getItem('token');
const user = JSON.parse(localStorage.getItem('user') || '{}');
const savedAvatar = localStorage.getItem('userAvatar') || '<i class="fas fa-user-graduate"></i>';

// If no token, show a warning but still allow browsing the dashboard UI
// (full redirect only needed for actual API calls)
if (!token) {
    console.warn('No token found. Some features require login.');
}

// Display welcome message
const welcomeEl = document.getElementById('welcome-msg');
if (welcomeEl) {
    welcomeEl.innerText = `Hi, ${user.name || 'Student'} 👋`;
}

// ── PROFILE DROPDOWN ──
const profileTrigger = document.getElementById('profile-trigger');
const profileMenu = document.getElementById('profile-menu');

if (profileTrigger) {
    profileTrigger.innerHTML = savedAvatar;
    profileTrigger.addEventListener('click', (e) => {
        e.stopPropagation();
        profileMenu.classList.toggle('show');
    });
}

document.addEventListener('click', () => {
    if (profileMenu) profileMenu.classList.remove('show');
});

// ── SECTION SWITCHING ─────────────────────────────────────────
function switchSection(sectionId) {
    // Hide all sections
    document.querySelectorAll('.dash-section').forEach(sec => {
        sec.style.display = 'none';
    });

    // Show the target section
    const target = document.getElementById(`${sectionId}-section`);
    if (target) {
        target.style.display = 'block';
    } else {
        console.warn(`Section not found: ${sectionId}-section`);
        return;
    }

    // Update sidebar active state
    document.querySelectorAll('#sidebar-nav a').forEach(link => {
        link.classList.remove('active');
        if (link.dataset.section === sectionId) {
            link.classList.add('active');
        }
    });

    // Fetch notes when switching to notes tab
    if (sectionId === 'notes') fetchNotes();
}

// ── SIDEBAR NAV EVENT LISTENERS ───────────────────────────────
document.querySelectorAll('#sidebar-nav a').forEach(link => {
    link.addEventListener('click', function (e) {
        e.preventDefault();
        const section = this.dataset.section;
        if (section) switchSection(section);
    });
});

// Show overview section by default on page load
switchSection('overview');

// ── FILE UPLOAD ───────────────────────────────────────────────
const dropZone = document.getElementById('drop-zone');
const fileInput = document.getElementById('file-upload');

if (dropZone) {
    dropZone.addEventListener('dragover', (e) => {
        e.preventDefault();
        dropZone.classList.add('dragover');
    });
    dropZone.addEventListener('dragleave', () => {
        dropZone.classList.remove('dragover');
    });
    dropZone.addEventListener('drop', (e) => {
        e.preventDefault();
        dropZone.classList.remove('dragover');
        handleFiles(e.dataTransfer.files);
    });
}

if (fileInput) {
    fileInput.addEventListener('change', (e) => {
        handleFiles(e.target.files);
    });
}

function handleFiles(files) {
    if (!token) {
        showToast('❌ Please login first!', 'error');
        return;
    }
    for (const file of files) {
        uploadFile(file);
    }
}

async function uploadFile(file) {
    const reader = new FileReader();
    reader.onload = async (e) => {
        const base64Data = e.target.result.split(',')[1];
        showUploadProgress(file.name);

        try {
            const response = await fetch(`${API_URL}/notes`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify({
                    fileName: file.name,
                    fileType: file.type,
                    base64Data
                })
            });

            const data = await response.json();
            if (response.ok) {
                showToast(`✅ "${file.name}" uploaded & summarized!`);
                addToActivity(file.name, 'Uploaded & Summarized');
            } else {
                showToast(`❌ Upload failed: ${data.msg || 'Unknown error'}`, 'error');
            }
        } catch (err) {
            console.error('Upload error:', err);
            showToast('❌ Cannot connect to server. Is the backend running?', 'error');
        }
    };
    reader.readAsDataURL(file);
}

// ── NOTES ─────────────────────────────────────────────────────
async function fetchNotes() {
    const container = document.getElementById('notes-list');
    if (!container) return;

    if (!token) {
        container.innerHTML = '<p class="loading-text">Please login to see your notes.</p>';
        return;
    }

    container.innerHTML = '<p class="loading-text">Loading notes...</p>';

    try {
        const res = await fetch(`${API_URL}/notes`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        const notes = await res.json();

        if (!Array.isArray(notes) || notes.length === 0) {
            container.innerHTML = '<p class="loading-text">No notes yet. Upload files from the Overview tab!</p>';
            return;
        }

        container.innerHTML = notes.map(note => `
            <div class="note-card" id="note-${note._id}">
                <div class="note-icon"><i class="fas ${getFileIcon(note.file_type)}"></i></div>
                <div class="note-info">
                    <h4>${note.file_name}</h4>
                    <p class="note-date">${new Date(note.upload_date).toLocaleDateString()}</p>
                </div>
                <div class="note-actions">
                    <button class="btn btn-secondary btn-sm" onclick="viewSummary('${note._id}', this)">
                        <i class="fas fa-magic"></i> Summary
                    </button>
                    <button class="btn btn-outline btn-sm" onclick="chatWithNote('${note._id}')">
                        <i class="fas fa-robot"></i> Chat
                    </button>
                    <button class="btn btn-danger btn-sm" onclick="deleteNote('${note._id}')">
                        <i class="fas fa-trash"></i>
                    </button>
                </div>
            </div>
        `).join('');

        // Store note summaries in a map so we don't need backtick escaping
        window._noteSummaries = {};
        notes.forEach(n => { window._noteSummaries[n._id] = n.summary || 'No summary available.'; });

    } catch (err) {
        container.innerHTML = '<p class="loading-text">Failed to load notes. Is the backend running?</p>';
        console.error(err);
    }
}

async function deleteNote(id) {
    if (!confirm('Delete this note?')) return;
    try {
        await fetch(`${API_URL}/notes/${id}`, {
            method: 'DELETE',
            headers: { 'Authorization': `Bearer ${token}` }
        });
        document.getElementById(`note-${id}`)?.remove();
        showToast('🗑️ Note deleted.');
    } catch (err) {
        showToast('Failed to delete.', 'error');
    }
}

function viewSummary(id, btn) {
    const modal = document.getElementById('summaryModal');
    const content = document.getElementById('summaryContent');
    const summary = (window._noteSummaries && window._noteSummaries[id]) || 'No summary available.';
    content.innerText = summary;
    modal.style.display = 'flex';
}

function closeSummary() {
    document.getElementById('summaryModal').style.display = 'none';
}

function chatWithNote(id) {
    switchSection('chat');
    window._activeNoteId = id;
    showToast('💬 Now chatting in context of selected note.');
}

// ── CHAT ──────────────────────────────────────────────────────
let chatMode = 'normal';

const chatInputEl = document.getElementById('chat-input');
const sendBtnEl = document.getElementById('send-chat');
const chatMessagesEl = document.getElementById('chat-messages');

if (sendBtnEl) sendBtnEl.addEventListener('click', sendMessage);
if (chatInputEl) {
    chatInputEl.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') sendMessage();
    });
}

// Mode buttons
document.querySelectorAll('.mode-btn').forEach(btn => {
    btn.addEventListener('click', () => {
        document.querySelectorAll('.mode-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        chatMode = btn.dataset.mode;
        showToast(`Mode switched: ${btn.textContent.trim()}`);
    });
});

async function sendMessage() {
    const message = chatInputEl.value.trim();
    if (!message) return;

    if (!token) { showToast('Please login first!', 'error'); return; }

    appendMessage(message, 'user');
    chatInputEl.value = '';

    const typingEl = appendTyping();

    try {
        const body = { message, mode: chatMode };
        if (window._activeNoteId) body.noteIds = [window._activeNoteId];

        const res = await fetch(`${API_URL}/chat/message`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify(body)
        });

        const data = await res.json();
        typingEl.remove();
        appendMessage(data.reply || data.response || 'Sorry, could not get a response.', 'ai');
    } catch (err) {
        typingEl.remove();
        appendMessage('❌ Could not connect to server. Is the backend running?', 'ai');
    }
}

// ── VOICE ASSISTANT ──────────────────────────────────────────
const voiceBtn = document.getElementById('voice-chat-btn');
let recognition;
let isRecording = false;
let startingText = '';

if ('webkitSpeechRecognition' in window || 'SpeechRecognition' in window) {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    recognition = new SpeechRecognition();
    recognition.continuous = true; // Stay on even if you pause speaking
    recognition.interimResults = true; // Set to true to see words as you speak them
    recognition.lang = 'en-IN'; // Better for Indian context

    recognition.onstart = () => {
        isRecording = true;
        startingText = chatInputEl.value; // Save what's already in the box
        voiceBtn.classList.add('active');
        showToast('Mic On! Keep speaking... Tap Mic again to stop.', 'info');
    };

    recognition.onresult = (event) => {
        let newTranscript = '';
        // Build the transcript from the current listening session
        for (let i = 0; i < event.results.length; i++) {
            newTranscript += event.results[i][0].transcript;
        }
        // Combine with anything typed before pressing mic
        chatInputEl.value = (startingText + ' ' + newTranscript).trim();
    };

    recognition.onerror = (event) => {
        console.error('Speech recognition error', event.error);
        voiceBtn.classList.remove('active');
        isRecording = false;
        if (event.error !== 'no-speech') {
            showToast('Voice error: ' + event.error, 'error');
        }
    };

    recognition.onend = () => {
        voiceBtn.classList.remove('active');
        isRecording = false;
    };
}

if (voiceBtn) {
    voiceBtn.addEventListener('click', () => {
        if (!recognition) {
            showToast('Voice recognition not supported in this browser.', 'error');
            return;
        }
        if (isRecording) {
            recognition.stop();
            showToast('Mic Off! You can now send the message.', 'success');
        } else {
            recognition.start();
        }
    });
}

function appendMessage(text, sender) {
    const div = document.createElement('div');
    div.className = `message ${sender}`;
    // Use innerHTML to support AI highlights like <mark>
    div.innerHTML = text.replace(/\n/g, '<br>');
    chatMessagesEl.appendChild(div);
    chatMessagesEl.scrollTop = chatMessagesEl.scrollHeight;
    return div;
}

function appendTyping() {
    const div = document.createElement('div');
    div.className = 'message ai typing';
    div.innerHTML = '<span></span><span></span><span></span>';
    chatMessagesEl.appendChild(div);
    chatMessagesEl.scrollTop = chatMessagesEl.scrollHeight;
    return div;
}

// ── GAMIFIED QUIZ ─────────────────────────────────────────────
let currentQuizData = [];
let userScore = 0;

async function generateQuiz() {
    const container = document.getElementById('quiz-container');
    const scoreOverlay = document.getElementById('quiz-score-container');
    if (!token) { showToast('Please login first!', 'error'); return; }

    scoreOverlay.style.display = 'none';
    container.innerHTML = '<p class="loading-text">Fetching your notes...</p>';

    let notes;
    try {
        const r = await fetch(`${API_URL}/notes`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        notes = await r.json();
    } catch (e) {
        container.innerHTML = '<p class="loading-text">Failed to connect to server.</p>';
        return;
    }

    if (!Array.isArray(notes) || notes.length === 0) {
        container.innerHTML = '<p class="loading-text">Upload some notes first, then come back to generate a quiz!</p>';
        return;
    }

    container.innerHTML = '<div class="loading-text"><i class="fas fa-spinner fa-spin"></i> 🧠 Generating interactive quiz, please wait...</div>';
    const noteIds = notes.map(n => n._id);

    try {
        const res = await fetch(`${API_URL}/chat/quiz`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify({ noteIds })
        });
        const data = await res.json();
        
        if (data.quiz && Array.isArray(data.quiz)) {
            currentQuizData = data.quiz;
            userScore = 0;
            renderQuiz();
        } else {
            container.innerHTML = '<p class="loading-text">Could not generate a valid quiz. Try again!</p>';
        }
    } catch (err) {
        container.innerHTML = '<p class="loading-text">Failed to generate quiz.</p>';
        console.error(err);
    }
}

function renderQuiz() {
    const container = document.getElementById('quiz-container');
    container.innerHTML = currentQuizData.map((q, idx) => `
        <div class="quiz-card" id="q-${idx}">
            <p class="quiz-question">${idx + 1}. ${q.question}</p>
            <div class="quiz-options">
                ${q.options.map((opt, optIdx) => `
                    <button class="option-btn" onclick="handleQuizAnswer(${idx}, ${optIdx}, this)">
                        ${opt}
                    </button>
                `).join('')}
            </div>
            <p class="quiz-explanation" id="exp-${idx}" style="display:none; margin-top: 1rem; color: var(--text-muted); font-size: 0.85rem;">
                <strong>Explanation:</strong> ${q.explanation}
            </p>
        </div>
    `).join('');
}

function handleQuizAnswer(qIdx, optIdx, btn) {
    const question = currentQuizData[qIdx];
    const card = document.getElementById(`q-${qIdx}`);
    const options = card.querySelectorAll('.option-btn');
    const explanation = document.getElementById(`exp-${qIdx}`);

    // Disable all options in this card
    options.forEach(b => b.disabled = true);

    if (optIdx === question.correctIndex) {
        btn.classList.add('correct');
        userScore += 10;
        showToast('✨ Correct! +10 pts');
    } else {
        btn.classList.add('wrong');
        options[question.correctIndex].classList.add('correct');
        showToast('❌ Wrong answer', 'error');
    }

    explanation.style.display = 'block';

    // Check if all answered
    const totalAnswered = document.querySelectorAll('.option-btn:disabled').length / 4;
    if (totalAnswered === currentQuizData.length) {
        setTimeout(showFinalScore, 1000);
    }
}

function showFinalScore() {
    const scoreOverlay = document.getElementById('quiz-score-container');
    const finalScoreEl = document.getElementById('final-score');
    finalScoreEl.innerText = userScore;
    scoreOverlay.style.display = 'flex';
}

function restartQuiz() {
    generateQuiz();
}

function formatQuizText(text) {
    // Keep this for backward compatibility or if AI returns raw text
    return text;
}

// ── SYLLABUS ──────────────────────────────────────────────────
async function uploadSyllabus() {
    const syllabusInput = document.getElementById('syllabus-input');
    const content = syllabusInput.value.trim();
    if (!content) { showToast('Paste your syllabus first!', 'error'); return; }
    if (!token) { showToast('Please login first!', 'error'); return; }

    showToast('Uploading syllabus...');
    try {
        const res = await fetch(`${API_URL}/syllabus`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify({ content })
        });
        const data = await res.json();
        if (res.ok) {
            showToast('✅ Syllabus uploaded! Topics extracted by AI.');
            displayTopics(data.topics || []);
        } else {
            showToast(data.msg || 'Upload failed.', 'error');
        }
    } catch (err) {
        showToast('❌ Failed to connect to server.', 'error');
    }
}

function displayTopics(topics) {
    const container = document.getElementById('topics-list');
    if (!topics.length) {
        container.innerHTML = '<p class="loading-text">No topics extracted.</p>';
        return;
    }
    container.innerHTML = topics.map(t => `<span class="topic-tag">${t}</span>`).join('');
}

// ── HELPERS ───────────────────────────────────────────────────
function getFileIcon(type) {
    if (!type) return 'fa-file';
    if (type.includes('pdf')) return 'fa-file-pdf';
    if (type.includes('word') || type.includes('document')) return 'fa-file-word';
    if (type.includes('image')) return 'fa-file-image';
    return 'fa-file-alt';
}

function showToast(msg, type = 'success') {
    const toast = document.getElementById('toast');
    if (!toast) return;
    toast.innerText = msg;
    toast.className = `toast ${type} show`;
    setTimeout(() => toast.classList.remove('show'), 3500);
}

function showUploadProgress(fileName) {
    addToActivity(fileName, 'Uploading...');
}

function addToActivity(name, action) {
    const list = document.querySelector('.activity-list');
    if (!list) return;
    const item = document.createElement('div');
    item.className = 'activity-item';
    item.innerHTML = `
        <i class="fas fa-file-alt"></i>
        <span><strong>${name}</strong> — ${action}</span>
        <span class="activity-time">just now</span>
    `;
    list.prepend(item);
}

function logout() {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    window.location.href = 'index.html';
}

// ── EMOJI PICKER ──────────────────────────────────────────────
const EMOJIS = ['👨‍🎓', '👩‍🎓', '🚀', '🧠', '🦉', '📚', '🎒', '🤓', '👽', '👾', '👻', '🤖', '🦊', '🐱', '🐼', '🐯', '🦁', '🐻', '🐵', '🦄'];

function openEmojiPicker(e) {
    if (e) e.preventDefault();
    const modal = document.getElementById('emojiModal');
    const grid = document.getElementById('emoji-grid');
    
    grid.innerHTML = EMOJIS.map(emoji => `
        <div class="emoji-item" onclick="selectEmoji('${emoji}')">${emoji}</div>
    `).join('');
    
    modal.style.display = 'flex';
    const profileMenu = document.getElementById('profile-menu');
    if(profileMenu) profileMenu.classList.remove('show');
}

function closeEmojiPicker() {
    document.getElementById('emojiModal').style.display = 'none';
}

function selectEmoji(emoji) {
    const profileTrigger = document.getElementById('profile-trigger');
    if (profileTrigger) {
        profileTrigger.innerHTML = emoji;
    }
    localStorage.setItem('userAvatar', emoji);
    closeEmojiPicker();
    showToast('Profile picture updated!', 'success');
}

// ── SHARE WEBSITE ─────────────────────────────────────────────
function shareWebsite(e) {
    if (e) e.preventDefault();
    
    // Close the menu if open
    const profileMenu = document.getElementById('profile-menu');
    if(profileMenu) profileMenu.classList.remove('show');

    const shareData = {
        title: 'Smart AI Notes Assistant',
        text: 'Check out this awesome AI-powered study app! It summarizes notes, generates quizzes, and acts as a personal tutor.',
        url: window.location.origin
    };

    // Use Web Share API if available (works great on mobile and modern desktop browsers)
    if (navigator.share) {
        navigator.share(shareData)
            .then(() => showToast('Thanks for sharing!', 'success'))
            .catch((err) => console.log('Share cancelled or failed: ', err));
    } else {
        // Fallback for browsers that don't support Web Share (like some older desktop ones)
        const dummy = document.createElement('input');
        document.body.appendChild(dummy);
        dummy.value = shareData.text + " " + shareData.url;
        dummy.select();
        document.execCommand('copy');
        document.body.removeChild(dummy);
        
        showToast('Link copied to clipboard! You can now paste it anywhere.', 'success');
    }
}
