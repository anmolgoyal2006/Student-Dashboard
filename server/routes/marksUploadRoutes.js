const express  = require('express');
const router   = express.Router();
const multer   = require('multer');
const { protect } = require('../middleware/authMiddleware');
const { uploadPdf, rankMarks } = require('../controllers/marksUploadController');

// PDF-specific multer (memoryStorage, PDF only)
const pdfUpload = multer({
  storage: multer.memoryStorage(),
  fileFilter: (_req, file, cb) => {
    if (file.mimetype === 'application/pdf' ||
        file.originalname.toLowerCase().endsWith('.pdf')) {
      cb(null, true);
    } else {
      cb(new Error('Only PDF files are allowed'), false);
    }
  },
  limits: { fileSize: 10 * 1024 * 1024 }, // 10 MB
});

router.use(protect);
router.post('/upload-pdf', pdfUpload.single('file'), uploadPdf);
router.post('/rank',       rankMarks);

module.exports = router;