require('dotenv').config();
const { GoogleGenerativeAI } = require('@google/generative-ai');
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

const list = async () => {
    try {
        const axios = require('axios');
        const url = `https://generativelanguage.googleapis.com/v1beta/models?key=${process.env.GEMINI_API_KEY}`;
        const res = await axios.get(url);
        const data = res.data;
        console.log(JSON.stringify(data, null, 2));
    } catch (err) {
        console.error('Error:', err.message);
    }
};

list();
