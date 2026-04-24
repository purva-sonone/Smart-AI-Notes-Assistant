const mongoose = require('mongoose');

const UserSchema = new mongoose.Schema({
    name: {
        type: String,
        required: true
    },
    email: {
        type: String,
        required: true,
        unique: true
    },
    password: {
        type: String,
        required: true
    },
    created_at: {
        type: Date,
        default: Date.now
    },
    streak: {
        type: Number,
        default: 0
    },
    last_study_date: {
        type: Date
    }
});

module.exports = mongoose.models.User || mongoose.model('User', UserSchema);
