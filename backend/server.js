const express = require('express');
const cors = require('cors');
const dotenv = require('dotenv');
const connectDB = require('./config/db');

// Load env vars
dotenv.config();

// Connect to database
connectDB();

const app = express();

// Middleware
app.use((req, res, next) => {
    console.log(`${req.method} ${req.url}`);
    next();
});
app.use(cors());
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ limit: '50mb', extended: true }));

const path = require('path');

// Routes
app.use('/api/auth', require('./routes/authRoutes'));
app.use('/api/notes', require('./routes/noteRoutes'));
app.use('/api/chat', require('./routes/chatRoutes'));
app.use('/api/syllabus', require('./routes/syllabusRoutes'));

// Serve Static Files
app.use(express.static(path.join(__dirname, '../frontend')));

// Serve index.html for any unknown routes (SPA support)
// Health check
app.get('/api/health', (req, res) => res.json({ status: 'OK' }));

// Database-free test route
app.get('/api/test', (req, res) => res.json({ 
    message: 'Backend is ALIVE!',
    env: process.env.NODE_ENV,
    mongoSet: !!process.env.MONGO_URI 
}));

// Export for Vercel
module.exports = app;

if (process.env.NODE_ENV !== 'production') {
    const PORT = process.env.PORT || 5000;
    app.listen(PORT, () => {
        console.log(`Server running on port ${PORT}`);
    });
}
