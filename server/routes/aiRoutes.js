const express    = require('express');
const router     = express.Router();
const multer     = require('multer');
const { protect } = require('../middleware/authMiddleware');
const {
  chat, uploadNotes, getNotes, deleteNote
} = require('../controllers/aiChatController');

// Store file in memory (no disk needed)
const upload = multer({
  storage: multer.memoryStorage(),
  limits:  { fileSize: 10 * 1024 * 1024 }, // 10MB
  fileFilter: (_req, file, cb) => {
    const allowed = ['application/pdf', 'text/plain', 'text/markdown'];
    allowed.includes(file.mimetype) ? cb(null, true) : cb(new Error('Only PDF and text files allowed'));
  },
});

router.use(protect);

router.post('/chat',                    chat);
router.post('/upload',  upload.single('file'), uploadNotes);
router.get ('/notes',                   getNotes);
router.delete('/notes/:filename',       deleteNote);

module.exports = router;