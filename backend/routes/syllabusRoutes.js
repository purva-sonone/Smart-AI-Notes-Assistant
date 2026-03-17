const express = require('express');
const router = express.Router();
const { uploadSyllabus, getSyllabus, deleteSyllabus } = require('../controllers/syllabusController');
const auth = require('../middleware/authMiddleware');

router.post('/', auth, uploadSyllabus);
router.get('/', auth, getSyllabus);
router.delete('/:id', auth, deleteSyllabus);

module.exports = router;
