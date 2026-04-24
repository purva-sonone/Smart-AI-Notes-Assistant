const express = require('express');
const router = express.Router();
const { uploadNote, getNotes, getNoteById, deleteNote } = require('../controllers/noteController');
const auth = require('../middleware/authMiddleware');

router.post('/', auth, uploadNote);
router.get('/', auth, getNotes);
router.get('/:id', auth, getNoteById);
router.delete('/:id', auth, deleteNote);

module.exports = router;
