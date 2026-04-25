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
        let summary = '';
        const buffer = Buffer.from(base64Data, 'base64');

        if (fileType.startsWith('image/')) {
            // For images, use Gemini Vision to do OCR and Summary in one go - MUCH faster than Tesseract
            try {
                const model = genAI.getGenerativeModel({ model: 'gemini-flash-latest' });
                const prompt = "Act as a student's study assistant. First, extract all text from this image exactly as it appears. Then, provide a clear, structured summary of the content with key concepts and bullet points. Format your response exactly like this: \nTEXT_START\n[Extracted text here]\nTEXT_END\nSUMMARY_START\n[Summary here]\nSUMMARY_END";
                
                const result = await model.generateContent([
                    prompt,
                    {
                        inlineData: {
                            data: base64Data,
                            mimeType: fileType
                        }
                    }
                ]);
                
                const responseText = result.response.text();
                
                // Parse the response
                const textMatch = responseText.match(/TEXT_START([\s\S]*?)TEXT_END/);
                const summaryMatch = responseText.match(/SUMMARY_START([\s\S]*?)SUMMARY_END/);
                
                extractedText = textMatch ? textMatch[1].trim() : responseText;
                summary = summaryMatch ? summaryMatch[1].trim() : 'Summary generated from image content.';
                
            } catch (imageErr) {
                console.error('Gemini Vision failed:', imageErr);
                summary = 'Processing failed — please try again.';
            }
        } else {
            // Handle other file types
            if (fileType === 'application/pdf') {
                const data = await pdf(buffer);
                extractedText = data.text;
            } else if (
                fileType === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' ||
                fileType === 'application/msword'
            ) {
                const data = await mammoth.extractRawText({ buffer });
                extractedText = data.value;
            } else if (fileType === 'text/plain') {
                extractedText = buffer.toString('utf8');
            } else {
                return res.status(400).json({ msg: `Unsupported file type: ${fileType}` });
            }

            if (!extractedText || !extractedText.trim()) {
                return res.status(400).json({ msg: 'Could not extract any text from file' });
            }

            // Generate AI summary for non-image files
            try {
                const model = genAI.getGenerativeModel({ 
                    model: 'gemini-flash-latest',
                    generationConfig: { maxOutputTokens: 1000 }
                });
                const prompt = `Summarize these student notes into a structured format with key concepts and bullet points. Be concise but thorough.\n\nNotes:\n${extractedText.substring(0, 20000)}`;
                const result = await model.generateContent(prompt);
                summary = result.response.text();
            } catch (aiErr) {
                console.warn('Gemini summary failed:', aiErr.message);
                summary = 'Summary unavailable — check your GEMINI_API_KEY.';
            }
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
