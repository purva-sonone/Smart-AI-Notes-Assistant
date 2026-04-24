const mongoose = require('mongoose');

const NoteSchema = new mongoose.Schema({
    user_id: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    file_name: {
        type: String,
        required: true
    },
    file_type: {
        type: String,
        required: true
    },
    content: {
        type: String,
        required: true
    },
    summary: {
        type: String
    },
    upload_date: {
        type: Date,
        default: Date.now
    }
});

module.exports = mongoose.models.Note || mongoose.model('Note', NoteSchema);
