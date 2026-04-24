const Note = require('../models/Note');
const User = require('../models/User');
const QuizResult = require('../models/QuizResult');
const { GoogleGenerativeAI } = require('@google/generative-ai');
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

exports.saveQuizResult = async (req, res) => {
    try {
        const { score, total_questions, topic } = req.body;
        const quizResult = new QuizResult({
            user_id: req.user.id,
            score,
            total_questions,
            topic
        });
        await quizResult.save();

        // Update Streak
        const user = await User.findById(req.user.id);
        const today = new Date().setHours(0,0,0,0);
        const lastStudy = user.last_study_date ? new Date(user.last_study_date).setHours(0,0,0,0) : null;

        if (!lastStudy || today > lastStudy) {
            if (lastStudy && today === lastStudy + 86400000) {
                user.streak += 1;
            } else if (!lastStudy || today > lastStudy + 86400000) {
                user.streak = 1;
            }
            user.last_study_date = new Date();
            await user.save();
        }

        res.json({ quizResult, streak: user.streak });
    } catch (err) {
        console.error(err.message);
        res.status(500).send('Server error');
    }
};

exports.getQuizHistory = async (req, res) => {
    try {
        const history = await QuizResult.find({ user_id: req.user.id }).sort({ completed_at: -1 }).limit(10);
        res.json(history);
    } catch (err) {
        console.error(err.message);
        res.status(500).send('Server error');
    }
};

exports.getStreak = async (req, res) => {
    try {
        const user = await User.findById(req.user.id).select('streak last_study_date');
        res.json(user);
    } catch (err) {
        console.error(err.message);
        res.status(500).send('Server error');
    }
};

exports.chatWithNotes = async (req, res) => {
    try {
        const { message, noteIds, mode } = req.body; // mode can be 'normal', 'eli10', 'exam', 'smart'
        
        let context = '';
        if (noteIds && noteIds.length > 0) {
            const notes = await Note.find({ _id: { $in: noteIds }, user_id: req.user.id });
            context = notes.map(n => n.content).join('\n\n');
        }

        const model = genAI.getGenerativeModel({ model: 'gemini-1.5-flash' });
        
        let systemPrompt = "You are an AI Study Assistant. Help the student understand their notes. CRITICAL: Wrap key formulas, important terms, and crucial concepts in <mark> tags (e.g., <mark>Internet of Things</mark>).";
        if (mode === 'eli10') {
            systemPrompt += " Explain everything like the student is 10 years old, using very simple language and analogies.";
        } else if (mode === 'exam') {
            systemPrompt += " Focus on the most important topics for exams, highlighting potential questions and key terms in <mark> tags.";
        } else if (mode === 'smart') {
            systemPrompt += " Convert the notes into quick revision material, summaries, and mnemonic devices. Use <mark> for key takeaways.";
        }

        const fullPrompt = `${systemPrompt}\n\nContext (Student Notes):\n${context}\n\nUser Question: ${message}`;
        
        const result = await model.generateContent(fullPrompt);
        const reply = result.response.text();

        res.json({ reply });
    } catch (err) {
        console.error("CHAT ERROR:", err);
        res.status(500).json({ error: err.message, stack: err.stack, details: "Server error" });
    }
};

exports.generateQuiz = async (req, res) => {
    try {
        const { noteIds } = req.body;
        const notes = await Note.find({ _id: { $in: noteIds }, user_id: req.user.id });
        const context = notes.map(n => n.content).join('\n\n');

        const model = genAI.getGenerativeModel({ model: 'gemini-1.5-flash' });
        const prompt = `Based on these notes, generate a practice quiz. 
        IMPORTANT: Return the response ONLY as a JSON array of objects.
        Each object should have: 
        "question" (string), 
        "options" (array of 4 strings), 
        "correctIndex" (number 0-3), 
        "explanation" (string).
        
        Generate 5 high-quality MCQs.
        
        Notes:
        ${context}`;
        
        const result = await model.generateContent(prompt);
        let quizText = result.response.text();
        
        // Clean the text in case AI added markdown code blocks
        quizText = quizText.replace(/```json|```/g, '').trim();

        res.json({ quiz: JSON.parse(quizText) });
    } catch (err) {
        console.error(err.message);
        res.status(500).send('Server error');
    }
};
