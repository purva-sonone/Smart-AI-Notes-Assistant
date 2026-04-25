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
    const userName = user.name || 'Krish';
    welcomeEl.innerText = `Hi, ${userName} 👋`;
}

// ── SIDEBAR PROFILE ──
const sidebarAvatar = document.getElementById('sidebar-avatar');
const sidebarName = document.getElementById('sidebar-name');

if (sidebarAvatar) {
    sidebarAvatar.innerHTML = savedAvatar;
}
if (sidebarName) {
    sidebarName.innerText = user.name || 'Purva';
}

// ── SECTION SWITCHING ─────────────────────────────────────────
function switchSection(sectionId) {
    // Hide all sections
    document.querySelectorAll('.dash-section').forEach(sec => {
        sec.classList.remove('active-section');
        sec.style.display = 'none';
    });

    // Show the target section
    const target = document.getElementById(`${sectionId}-section`);
    if (target) {
        target.classList.add('active-section');
        target.style.display = 'block';
        if (sectionId === 'syllabus') fetchSyllabus();
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
    
    // Populate profile if switching to profile
    if (sectionId === 'profile') populateProfile();
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
                updateDashboardStats(); // Refresh stats after upload
                if (document.getElementById('notes-section').style.display !== 'none') {
                    fetchNotes(); // Also refresh notes list if currently viewing it
                }
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
        updateDashboardStats(); // Refresh stats after delete
        if (document.getElementById('notes-section').style.display !== 'none') {
            fetchNotes(); // Also refresh notes list if currently viewing it
        }
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

// Attachment handling
const chatFileInput = document.getElementById('chat-file-upload');
if (chatFileInput) {
    chatFileInput.addEventListener('change', (e) => {
        const file = e.target.files[0];
        if (file) {
            showToast(`📎 File attached: ${file.name}`);
            // Add a visual indicator or message to the input
            chatInputEl.placeholder = `Add text about ${file.name}...`;
        }
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
let currentQuestionIndex = 0;
let quizStreak = 0;

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
            currentQuestionIndex = 0;
            quizStreak = 0;
            renderQuiz();
        } else {
            container.innerHTML = '<p class="loading-text">Could not generate a valid quiz. Try again!</p>';
        }
    } catch (err) {
        container.innerHTML = `<p class="loading-text">❌ Quiz Error: ${err.message}</p>`;
        console.error('Quiz generation error:', err);
    }
}

function renderQuiz() {
    const container = document.getElementById('quiz-container');
    const q = currentQuizData[currentQuestionIndex];
    const progress = ((currentQuestionIndex + 1) / currentQuizData.length) * 100;

    container.innerHTML = `
        <div class="quiz-header-meta">
            <div class="quiz-progress-wrapper">
                <div class="quiz-progress-bar" style="width: ${progress}%"></div>
            </div>
            <div class="quiz-stats-row">
                <span>Question ${currentQuestionIndex + 1} of ${currentQuizData.length}</span>
                <span id="quiz-timer"><i class="fas fa-clock"></i> 30s</span>
            </div>
        </div>
        <div class="quiz-card animated-in" id="q-${currentQuestionIndex}">
            <p class="quiz-question">${q.question}</p>
            <div class="quiz-options">
                ${q.options.map((opt, optIdx) => `
                    <button class="option-btn" onclick="handleQuizAnswer(${currentQuestionIndex}, ${optIdx}, this)">
                        ${opt}
                    </button>
                `).join('')}
            </div>
            <p class="quiz-explanation" id="exp-${currentQuestionIndex}" style="display:none; margin-top: 1rem; color: var(--text-muted); font-size: 0.85rem;">
                <strong>Explanation:</strong> ${q.explanation}
            </p>
            <div id="next-btn-container" style="display:none; margin-top: 1.5rem; text-align: right;">
                <button class="btn btn-primary" onclick="nextQuestion()">Next Question <i class="fas fa-arrow-right"></i></button>
            </div>
        </div>
    `;
    startQuizTimer();
}

let quizTimerInterval;
function startQuizTimer() {
    let timeLeft = 30;
    const timerEl = document.getElementById('quiz-timer');
    clearInterval(quizTimerInterval);
    
    quizTimerInterval = setInterval(() => {
        timeLeft--;
        if (timerEl) timerEl.innerHTML = `<i class="fas fa-clock"></i> ${timeLeft}s`;
        
        if (timeLeft <= 0) {
            clearInterval(quizTimerInterval);
            autoSubmitQuestion();
        }
    }, 1000);
}

function autoSubmitQuestion() {
    const options = document.querySelectorAll('.option-btn');
    if (options.length > 0 && !options[0].disabled) {
        handleQuizAnswer(currentQuestionIndex, -1, null);
    }
}

function handleQuizAnswer(qIdx, optIdx, btn) {
    clearInterval(quizTimerInterval);
    const question = currentQuizData[qIdx];
    const card = document.getElementById(`q-${qIdx}`);
    const options = card.querySelectorAll('.option-btn');
    const explanation = document.getElementById(`exp-${qIdx}`);
    const nextBtnContainer = document.getElementById('next-btn-container');

    options.forEach(b => b.disabled = true);

    if (optIdx === question.correctIndex) {
        if (btn) btn.classList.add('correct');
        quizStreak++;
        let bonus = quizStreak > 2 ? 5 : 0;
        userScore += (10 + bonus);
        showToast(`✨ Correct! ${quizStreak > 2 ? '🔥 Streak Bonus!' : ''}`);
    } else {
        if (btn) btn.classList.add('wrong');
        options[question.correctIndex].classList.add('correct');
        quizStreak = 0;
        showToast('❌ Wrong answer', 'error');
    }

    explanation.style.display = 'block';
    nextBtnContainer.style.display = 'block';
}

function nextQuestion() {
    currentQuestionIndex++;
    if (currentQuestionIndex < currentQuizData.length) {
        renderQuiz();
    } else {
        showFinalScore();
    }
}

function showFinalScore() {
    const scoreOverlay = document.getElementById('quiz-score-container');
    const finalScoreEl = document.getElementById('final-score');
    const scoreMsg = document.querySelector('.score-card p');
    
    finalScoreEl.innerText = userScore;
    
    let message = "Great job! Keep learning to boost your score.";
    if (userScore > 80) message = "🏆 Legendary performance! You've mastered this topic!";
    else if (userScore > 50) message = "🔥 Awesome! You have a solid grasp of these notes.";
    
    if (scoreMsg) scoreMsg.innerText = message;
    scoreOverlay.style.display = 'flex';
    
    // Save to history (already handled by backend usually, but we could sync here)
    saveQuizResult(userScore, currentQuizData.length);
}

async function saveQuizResult(score, total) {
    if (!token) return;
    try {
        await fetch(`${API_URL}/chat/quiz/save`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify({ score, total_questions: total, topic: 'AI Generated Quiz' })
        });
    } catch (e) {
        console.error('Failed to save quiz result:', e);
    }
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
            showToast(data.error || data.msg || 'Upload failed.', 'error');
        }
    } catch (err) {
        showToast(`❌ Connection Error: ${err.message}`, 'error');
        console.error('Syllabus upload error:', err);
    }
}

function displayTopics(topics) {
    const container = document.getElementById('topics-list');
    const syllabusCard = document.querySelector('.syllabus-card');
    
    if (!topics || !topics.length) {
        container.innerHTML = '<p class="loading-text">No topics extracted yet.</p>';
        if (syllabusCard) syllabusCard.style.display = 'block';
        return;
    }

    // If topics exist, hide the upload card and show progress
    if (syllabusCard) syllabusCard.style.display = 'none';

    container.innerHTML = `
        <div class="progress-header">
            <h3><i class="fas fa-tasks"></i> Course Progress</h3>
            <button class="btn btn-secondary btn-sm" onclick="showSyllabusUpload()"><i class="fas fa-edit"></i> Update Syllabus</button>
        </div>
        <div class="topics-grid">
            ${topics.map((t, i) => `
                <div class="topic-progress-card glass">
                    <div class="topic-info">
                        <span>${t}</span>
                        <span class="topic-percent">${Math.floor(Math.random() * 40) + 10}%</span>
                    </div>
                    <div class="topic-progress-bar">
                        <div class="topic-fill" style="width: ${Math.floor(Math.random() * 40) + 10}%"></div>
                    </div>
                </div>
            `).join('')}
        </div>
    `;
}

async function fetchSyllabus() {
    if (!token) return;
    try {
        const res = await fetch(`${API_URL}/syllabus`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        const data = await res.json();
        if (data && data.topics) {
            displayTopics(data.topics);
        } else {
            showSyllabusUpload();
        }
    } catch (err) {
        console.error('Error fetching syllabus:', err);
        showToast(`❌ Syllabus Sync Error: ${err.message}`, 'error');
    }
}

function showSyllabusUpload() {
    const syllabusCard = document.querySelector('.syllabus-card');
    const container = document.getElementById('topics-list');
    if (syllabusCard) syllabusCard.style.display = 'block';
    if (container) container.innerHTML = '';
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
    const list = document.getElementById('activity-list');
    if (!list) return;
    const item = document.createElement('div');
    item.className = 'activity-item-simple';
    item.innerHTML = `
        <div class="activity-icon"><i class="fas fa-file-alt"></i></div>
        <div class="activity-meta">
            <h4>${name}</h4>
            <span>${action} • just now</span>
        </div>
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
    const sidebarAvatar = document.getElementById('sidebar-avatar');
    const profileAvatar = document.getElementById('profile-avatar-display');
    
    if (sidebarAvatar) sidebarAvatar.innerHTML = emoji;
    if (profileAvatar) profileAvatar.innerHTML = emoji;
    
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
// ── DASHBOARD STATS ──────────────────────────────────────────
async function updateDashboardStats() {
    if (!token) return;
    try {
        const res = await fetch(`${API_URL}/notes`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        const notes = await res.json();
        
        // Update Stats Card
        const statNotesEl = document.getElementById('stat-notes');
        const statAiCountEl = document.getElementById('stat-ai-count');
        const statSubjectsEl = document.getElementById('stat-subjects');
        const statStreakEl = document.getElementById('stat-streak');
        
        if (Array.isArray(notes)) {
            if (statNotesEl) statNotesEl.innerText = notes.length;
            
            // Heuristic for AI Usage: 3 actions per note (extract, summarize, index)
            if (statAiCountEl) statAiCountEl.innerText = notes.length * 3 + 4; // +4 for initial setup
            
            // Heuristic for Subjects: Unique first words of file names
            const subjects = new Set(notes.map(n => n.file_name.split(/[\s_.-]/)[0].toLowerCase()));
            if (statSubjectsEl) statSubjectsEl.innerText = Math.max(subjects.size, notes.length > 0 ? 1 : 0);
        }

        // Update Streak from user object
        if (statStreakEl && user.streak !== undefined) {
            statStreakEl.innerText = user.streak || 0;
            const streakBar = document.querySelector('.progress-fill');
            if (streakBar) {
                const progress = Math.min((user.streak / 7) * 100, 100); // 7 day goal
                streakBar.style.width = `${progress}%`;
            }
        }

        // Update Recent Activity List
        const activityList = document.getElementById('activity-list');
        if (activityList && Array.isArray(notes)) {
            if (notes.length === 0) {
                activityList.innerHTML = `
                    <div class="activity-item-simple">
                        <div class="activity-icon"><i class="fas fa-info-circle"></i></div>
                        <div class="activity-meta">
                            <h4>No Activity</h4>
                            <span>Upload a note to get started!</span>
                        </div>
                    </div>
                `;
            } else {
                // Show top 5 most recent notes
                activityList.innerHTML = notes.slice(0, 5).map(note => `
                    <div class="activity-item-simple">
                        <div class="activity-icon"><i class="fas ${getFileIcon(note.file_type)}"></i></div>
                        <div class="activity-meta">
                            <h4>${note.file_name}</h4>
                            <span>Uploaded on ${new Date(note.upload_date).toLocaleDateString()}</span>
                        </div>
                    </div>
                `).join('');
            }
        }
    } catch (err) {
        console.error('Error fetching stats:', err);
        showToast(`❌ Stats Sync Error: ${err.message}`, 'error');
    }
}

// Initial stats load
updateDashboardStats();
// ── PROFILE PAGE LOGIC ──────────────────────────────────────
function populateProfile() {
    if (!user) return;
    
    const profileName = document.getElementById('profile-name-display');
    const profileEmail = document.getElementById('profile-email-display');
    const editName = document.getElementById('edit-name');
    const editEmail = document.getElementById('edit-email');
    const profileAvatar = document.getElementById('profile-avatar-display');
    const profileStatNotes = document.getElementById('profile-stat-notes');
    
    if (profileName) profileName.innerText = user.name || 'Purva Sonone';
    if (profileEmail) profileEmail.innerText = user.email || 'purva@example.com';
    if (editName) editName.value = user.name || '';
    if (editEmail) editEmail.value = user.email || '';
    if (profileAvatar) profileAvatar.innerHTML = localStorage.getItem('userAvatar') || '👨‍🎓';
    
    // Update note count in profile
    const statNotes = document.getElementById('stat-notes');
    if (profileStatNotes && statNotes) profileStatNotes.innerText = statNotes.innerText;
}

function saveProfileChanges() {
    const newName = document.getElementById('edit-name').value.trim();
    if (!newName) {
        showToast('Name cannot be empty!', 'error');
        return;
    }
    
    // Update local user object
    user.name = newName;
    localStorage.setItem('user', JSON.stringify(user));
    
    // Update UI elements
    const sidebarName = document.getElementById('sidebar-name');
    const welcomeEl = document.getElementById('welcome-msg');
    const profileName = document.getElementById('profile-name-display');
    
    if (sidebarName) sidebarName.innerText = newName;
    if (welcomeEl) welcomeEl.innerText = `Hi, ${newName} 👋`;
    if (profileName) profileName.innerText = newName;
    
    showToast('Profile updated successfully! ✨');
}

// ── SEARCH NOTES ─────────────────────────────────────────────
const searchInput = document.getElementById('search-input');
if (searchInput) {
    searchInput.addEventListener('input', (e) => {
        const query = e.target.value.toLowerCase().trim();
        const noteCards = document.querySelectorAll('.note-card');
        
        noteCards.forEach(card => {
            const fileName = card.querySelector('h4')?.innerText.toLowerCase() || '';
            if (fileName.includes(query)) {
                card.style.display = 'flex';
            } else {
                card.style.display = 'none';
            }
        });
    });
}
