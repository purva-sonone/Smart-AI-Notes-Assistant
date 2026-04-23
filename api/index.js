const express = require('express');
const cors = require('cors');
const dotenv = require('dotenv');
const mongoose = require('mongoose');
const path = require('path');

// Load env vars
dotenv.config();

const app = express();

// Middleware
app.use(cors());
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ limit: '50mb', extended: true }));

// Database Connection inside the handler (Best for Vercel)
const connectDB = async () => {
    if (mongoose.connection.readyState >= 1) return;
    try {
        await mongoose.connect(process.env.MONGO_URI);
        console.log('MongoDB Connected');
    } catch (err) {
        console.error('MongoDB Connection Error:', err.message);
    }
};

// Routes
// We need to use absolute-like paths or fix relative paths
const authRoutes = require('../backend/routes/authRoutes');
const noteRoutes = require('../backend/routes/noteRoutes');
const chatRoutes = require('../backend/routes/chatRoutes');
const syllabusRoutes = require('../backend/routes/syllabusRoutes');

app.use(async (req, res, next) => {
    await connectDB();
    next();
});

app.use('/api/auth', authRoutes);
app.use('/api/notes', noteRoutes);
app.use('/api/chat', chatRoutes);
app.use('/api/syllabus', syllabusRoutes);

// Health check
app.get('/api/health', (req, res) => res.json({ status: 'OK' }));
app.get('/api/test', (req, res) => res.json({ message: 'Vercel Backend is Working!' }));

// Export the app
module.exports = app;
