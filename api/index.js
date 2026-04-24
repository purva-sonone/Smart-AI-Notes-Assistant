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

// Database Connection
const connectDB = async () => {
    if (mongoose.connection.readyState >= 1) return;
    try {
        if (!process.env.MONGO_URI) {
            throw new Error('MONGO_URI is not defined in environment variables');
        }
        await mongoose.connect(process.env.MONGO_URI, {
            serverSelectionTimeoutMS: 5000 // Timeout after 5 seconds instead of 30
        });
        console.log('MongoDB Connected Successfully');
    } catch (err) {
        console.error('MongoDB Connection Error:', err.message);
        // On Vercel, we don't want to crash the whole app, but we want to know it failed
    }
};

// Import Routes
const authRoutes = require('./routes/authRoutes');
const noteRoutes = require('./routes/noteRoutes');
const chatRoutes = require('./routes/chatRoutes');
const syllabusRoutes = require('./routes/syllabusRoutes');

// Middleware to ensure DB connection without blocking
app.use((req, res, next) => {
    connectDB(); // Start/check connection in background
    next();
});

app.use('/api/auth', authRoutes);
app.use('/api/notes', noteRoutes);
app.use('/api/chat', chatRoutes);
app.use('/api/syllabus', syllabusRoutes);

// Health check
app.get('/api/health', (req, res) => res.json({ status: 'OK' }));
app.get('/api/test', (req, res) => {
    res.json({ 
        message: 'Vercel Backend is Working!',
        database: mongoose.connection.readyState === 1 ? 'Connected' : 'Connecting/Disconnected',
        readyState: mongoose.connection.readyState,
        hasUri: !!process.env.MONGO_URI
    });
});

// Global Error Handler
app.use((err, req, res, next) => {
    console.error('SERVER ERROR:', err);
    res.status(500).json({ 
        error: 'Internal Server Error', 
        message: err.message
    });
});

// Export the app
module.exports = app;