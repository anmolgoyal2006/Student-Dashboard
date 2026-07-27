const express = require('express');
const router  = express.Router();
const multer  = require('multer');
const { body, param } = require('express-validator');
const {
  getSubjects, addSubject, updateSubject, deleteSubject,
  importSubjectsFromPDF, confirmImportedSubjects,
} = require('../controllers/timetableController');
const { protect } = require('../middleware/authMiddleware');
const { validate } = require('../middleware/validate');

// Buffered in RAM, so the cap has to be enforced here — a controller-side check
// runs only once the whole file is already resident.
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024, files: 1 },
  fileFilter: (_req, file, cb) => {
    const ok =
      file.mimetype === 'application/pdf' ||
      /\.pdf$/i.test(file.originalname);
    cb(ok ? null : new Error('Only PDF files are allowed.'), ok);
  },
});

router.use(protect);

const subjectFields = [
  body('code').optional().isString(),
  body('instructor').optional().isString(),
  body('credits').optional().isFloat({ min: 1, max: 6 }).withMessage('Credits must be between 1 and 6.'),
  body('schedule').optional().isArray(),
  body('schedule.*.day').optional().isIn(['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']),
  body('schedule.*.startTime').optional().isString(),
  body('schedule.*.endTime').optional().isString(),
  body('schedule.*.room').optional().isString(),
];

router.get('/', getSubjects);

router.post('/', validate([
  body('name').trim().notEmpty().withMessage('Subject name is required.'),
  ...subjectFields,
]), addSubject);

router.put('/:id', validate([
  param('id').isMongoId(),
  body('name').optional().trim().notEmpty(),
  ...subjectFields,
]), updateSubject);

router.delete('/:id', validate([param('id').isMongoId()]), deleteSubject);

router.post('/import-pdf', upload.single('file'), importSubjectsFromPDF);

router.post('/import-pdf/confirm', validate([
  body('subjects').isArray({ min: 1 }).withMessage('No subjects to import.'),
  body('subjects.*.name').trim().notEmpty().withMessage('Subject name is required.'),
  body('subjects.*.code').optional().isString(),
  body('subjects.*.instructor').optional().isString(),
  body('subjects.*.credits').optional({ nullable: true }).isFloat({ min: 1, max: 6 })
    .withMessage('Credits must be between 1 and 6.'),
  body('subjects.*.resolveAction').optional().isIn(['create', 'replace', 'merge', 'skip']),
  body('subjects.*.schedule').optional().isArray(),
  body('subjects.*.schedule.*.day').isIn(['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']),
  body('subjects.*.schedule.*.startTime').optional().isString(),
  body('subjects.*.schedule.*.endTime').optional().isString(),
  body('subjects.*.schedule.*.room').optional().isString(),
]), confirmImportedSubjects);

module.exports = router;
