const express = require('express');
const router = express.Router();
const { chatWithNotes, generateQuiz, saveQuizResult, getQuizHistory, getStreak } = require('../controllers/chatController');
const auth = require('../middleware/authMiddleware');

router.post('/message', auth, chatWithNotes);
router.post('/quiz', auth, generateQuiz);
router.post('/quiz/save', auth, saveQuizResult);
router.get('/quiz/history', auth, getQuizHistory);
router.get('/streak', auth, getStreak);

module.exports = router;
