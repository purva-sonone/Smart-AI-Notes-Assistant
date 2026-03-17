const express = require('express');
const router = express.Router();
const { chatWithNotes, generateQuiz } = require('../controllers/chatController');
const auth = require('../middleware/authMiddleware');

router.post('/message', auth, chatWithNotes);
router.post('/quiz', auth, generateQuiz);

module.exports = router;
