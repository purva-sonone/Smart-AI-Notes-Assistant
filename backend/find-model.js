require('dotenv').config();
const { GoogleGenerativeAI } = require('@google/generative-ai');
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

const test = async () => {
    try {
        const models = ['gemini-flash-latest', 'gemini-2.0-flash', 'gemini-1.5-flash', 'gemini-pro'];
        for (const m of models) {
            try {
                console.log(`Testing ${m}...`);
                const model = genAI.getGenerativeModel({ model: m });
                const result = await model.generateContent('Say ok');
                console.log(`SUCCESS with ${m}:`, result.response.text());
                process.exit(0);
            } catch (e) {
                console.log(`FAILED with ${m}:`, e.message);
            }
        }
    } catch (err) {
        console.error('GLOBAL FAILURE:', err.message);
        process.exit(1);
    }
};

test();
