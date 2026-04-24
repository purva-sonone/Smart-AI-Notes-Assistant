const mongoose = require('mongoose');

const SyllabusSchema = new mongoose.Schema({
    user_id: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    content: {
        type: String,
        required: true
    },
    topics: [{
        type: String
    }],
    upload_date: {
        type: Date,
        default: Date.now
    }
});

module.exports = mongoose.models.Syllabus || mongoose.model('Syllabus', SyllabusSchema);
