const Syllabus = require('../models/Syllabus');
const { GoogleGenerativeAI } = require('@google/generative-ai');
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

exports.uploadSyllabus = async (req, res) => {
    try {
        const { content } = req.body;
        
        // AI parse topics
        const model = genAI.getGenerativeModel({ model: 'gemini-pro' });
        const prompt = `Extract a list of main topics and subtopics from the following syllabus content. Return only a comma-separated list of topics.\n\nSyllabus:\n${content}`;
        
        const result = await model.generateContent(prompt);
        const topicsText = result.response.text();
        const topics = topicsText.split(',').map(t => t.trim());

        const newSyllabus = new Syllabus({
            user_id: req.user.id,
            content,
            topics
        });

        await newSyllabus.save();
        res.json(newSyllabus);
    } catch (err) {
        console.error(err.message);
        res.status(500).send('Server error');
    }
};

exports.getSyllabus = async (req, res) => {
    try {
        const syllabus = await Syllabus.findOne({ user_id: req.user.id }).sort({ upload_date: -1 });
        res.json(syllabus);
    } catch (err) {
        console.error(err.message);
        res.status(500).send('Server error');
    }
};

exports.deleteSyllabus = async (req, res) => {
    try {
        await Syllabus.findOneAndDelete({ user_id: req.user.id, _id: req.params.id });
        res.json({ msg: 'Syllabus removed' });
    } catch (err) {
        console.error(err.message);
        res.status(500).send('Server error');
    }
};
