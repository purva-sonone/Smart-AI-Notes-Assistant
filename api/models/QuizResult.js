const mongoose = require('mongoose');

const QuizResultSchema = new mongoose.Schema({
    user_id: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    score: {
        type: Number,
        required: true
    },
    total_questions: {
        type: Number,
        required: true
    },
    topic: {
        type: String,
        default: 'General Study'
    },
    completed_at: {
        type: Date,
        default: Date.now
    }
});

module.exports = mongoose.models.QuizResult || mongoose.model('QuizResult', QuizResultSchema);
