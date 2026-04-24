const Note = require('../models/Note');
const { GoogleGenerativeAI } = require('@google/generative-ai');
const pdf = require('pdf-parse');
const mammoth = require('mammoth');
const Tesseract = require('tesseract.js');

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

exports.uploadNote = async (req, res) => {
    try {
        const { fileName, fileType, base64Data } = req.body;

        if (!fileName || !fileType || !base64Data) {
            return res.status(400).json({ msg: 'fileName, fileType and base64Data are required' });
        }

        let extractedText = '';
        const buffer = Buffer.from(base64Data, 'base64');

        if (fileType === 'application/pdf') {
            const data = await pdf(buffer);
            extractedText = data.text;
        } else if (
            fileType === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' ||
            fileType === 'application/msword'
        ) {
            const data = await mammoth.extractRawText({ buffer });
            extractedText = data.value;
        } else if (fileType.startsWith('image/')) {
            const result = await Tesseract.recognize(buffer, 'eng');
            extractedText = result.data.text;
        } else if (fileType === 'text/plain') {
            extractedText = buffer.toString('utf8');
        } else {
            return res.status(400).json({ msg: `Unsupported file type: ${fileType}` });
        }

        if (!extractedText || !extractedText.trim()) {
            return res.status(400).json({ msg: 'Could not extract any text from file' });
        }

        // Generate AI summary
        let summary = '';
        try {
            const model = genAI.getGenerativeModel({ model: 'gemini-pro' });
            const prompt = `You are a study assistant. Summarize the following student notes in a clear, structured way with key concepts and bullet points:\n\n${extractedText.substring(0, 10000)}`;
            const result = await model.generateContent(prompt);
            summary = result.response.text();
        } catch (aiErr) {
            console.warn('Gemini summary failed:', aiErr.message);
            summary = `AI Error: ${aiErr.message}`;
        }

        const newNote = new Note({
            user_id: req.user.id,
            file_name: fileName,
            file_type: fileType,
            content: extractedText,
            summary
        });

        const note = await newNote.save();
        res.json(note);
    } catch (err) {
        console.error('uploadNote error:', err.message);
        res.status(500).json({ msg: 'Server error', error: err.message });
    }
};

exports.getNotes = async (req, res) => {
    try {
        const notes = await Note.find({ user_id: req.user.id }).sort({ upload_date: -1 });
        res.json(notes);
    } catch (err) {
        console.error(err.message);
        res.status(500).json({ msg: 'Server error' });
    }
};

exports.getNoteById = async (req, res) => {
    try {
        const note = await Note.findById(req.params.id);
        if (!note || note.user_id.toString() !== req.user.id) {
            return res.status(404).json({ msg: 'Note not found' });
        }
        res.json(note);
    } catch (err) {
        console.error(err.message);
        res.status(500).json({ msg: 'Server error' });
    }
};

exports.deleteNote = async (req, res) => {
    try {
        const note = await Note.findById(req.params.id);
        if (!note || note.user_id.toString() !== req.user.id) {
            return res.status(404).json({ msg: 'Note not found' });
        }
        await note.deleteOne();
        res.json({ msg: 'Note removed' });
    } catch (err) {
        console.error(err.message);
        res.status(500).json({ msg: 'Server error' });
    }
};
