const express     = require('express');
const router      = express.Router();
const multer      = require('multer');
const { protect } = require('../middleware/authMiddleware');
const {
  chat, uploadNotes, getNotes, deleteNote
} = require('../controllers/aiChatController');

const upload = multer({
  storage: multer.memoryStorage(),
  limits:  { fileSize: 10 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    const allowed = [
      'application/pdf',
      'text/plain',
      'text/markdown',
      'image/jpeg',
      'image/jpg',
      'image/png',
      'image/webp',
    ];
    if (
      allowed.includes(file.mimetype) ||
      file.originalname.match(/\.(txt|md|pdf|jpg|jpeg|png|webp)$/i)
    ) {
      cb(null, true);
    } else {
      cb(new Error('File type not allowed: ' + file.mimetype));
    }
  },
});

const handleUpload = (req, res, next) => {
  upload.single('file')(req, res, (err) => {
    if (err) {
      console.error('[Multer error]', err.message);
      return res.status(400).json({ message: err.message });
    }
    next();
  });
};

router.use(protect);

router.post('/chat',              chat);
router.post('/upload',            handleUpload, uploadNotes);
router.get ('/notes',             getNotes);
router.delete('/notes/:filename', deleteNote);

module.exports = router;