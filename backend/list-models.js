const { GoogleGenerativeAI } = require('@google/generative-ai');
const genAI = new GoogleGenerativeAI('AIzaSyD1H_Su7AUsOW55ORCKYx7mlY1bHhLUZSI');

const list = async () => {
    try {
        // The SDK might not have a direct listModels method in this version easily accessible
        // but we can try to fetch the list via REST
        const axios = require('axios');
        const url = `https://generativelanguage.googleapis.com/v1beta/models?key=AIzaSyAFFmP2Jm4pTZQUHB_tO9SxsrqfIqc9GfI`;
        const res = await axios.get(url);
        const data = res.data;
        console.log(JSON.stringify(data, null, 2));
    } catch (err) {
        console.error('Error:', err.message);
    }
};

list();
