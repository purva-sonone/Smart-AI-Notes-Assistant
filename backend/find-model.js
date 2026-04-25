const { GoogleGenerativeAI } = require('@google/generative-ai');
const genAI = new GoogleGenerativeAI('AIzaSyD1H_Su7AUsOW55ORCKYx7mlY1bHhLUZSI');

const test = async () => {
    try {
        // Try without explicit version or with different model names
        const models = ['gemini-1.5-flash', 'gemini-1.5-flash-latest', 'gemini-pro', 'gemini-1.0-pro'];
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
