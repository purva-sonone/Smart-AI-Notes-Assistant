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

        const model = genAI.getGenerativeModel({ 
            model: 'gemini-flash-latest',
            generationConfig: { maxOutputTokens: 1000 }
        });
        
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

        const model = genAI.getGenerativeModel({ 
            model: 'gemini-flash-latest',
            generationConfig: { maxOutputTokens: 2000 }
        });
        const prompt = `Based on the following study notes, generate an interactive practice quiz.
        
        CRITICAL RULES:
        1. Return ONLY a valid JSON array of objects. No markdown, no extra text.
        2. Generate exactly 10 high-quality multiple choice questions.
        3. Each object MUST have:
           - "question": The question text.
           - "options": An array of 4 distinct possible answers.
           - "correctIndex": The index (0-3) of the correct answer in the options array.
           - "explanation": A brief 1-sentence explanation of why the answer is correct.

        Notes Content:
        ${context}`;
        
        const result = await model.generateContent(prompt);
        let quizText = result.response.text();
        
        // Use a more robust regex to find the JSON array in case AI adds extra text
        const jsonMatch = quizText.match(/\[\s*{[\s\S]*}\s*\]/);
        if (jsonMatch) {
            quizText = jsonMatch[0];
        }

        try {
            const quiz = JSON.parse(quizText);
            res.json({ quiz });
        } catch (parseErr) {
            console.error('Quiz JSON Parse Error. Raw text:', quizText);
            res.status(500).json({ msg: 'AI generated invalid quiz format', error: parseErr.message });
        }
    } catch (err) {
        console.error('GENERATE QUIZ ERROR:', err);
        res.status(500).json({ msg: 'Server error', error: err.message });
    }
};
