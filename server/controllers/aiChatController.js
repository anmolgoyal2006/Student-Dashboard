const mongoose  = require('mongoose');
const NoteChunk = require('../models/NoteChunk');
const { storeNoteEmbeddings, chatWithRAG } = require('../services/ragService');



async function extractImageText(buffer, mimetype) {
  const Tesseract = require('tesseract.js');
  const { data: { text } } = await Tesseract.recognize(buffer, 'eng');
  return text.trim();
}

// ── Helper: extract text from PDF ─────────────────────────────────────────
async function extractPDFText(buffer) {
  try {
    // Method 1 — direct call
    const pdfParse = require('pdf-parse');
    const data     = await pdfParse(buffer);
    if (data?.text?.trim()) return data.text.trim();
    throw new Error('Empty text');
  } catch (e1) {
    try {
      // Method 2 — via .default
      const mod  = require('pdf-parse');
      const fn   = mod.default || mod.PDF || mod.parse;
      const data = await fn(buffer);
      if (data?.text?.trim()) return data.text.trim();
      throw new Error('Empty text');
    } catch (e2) {
      try {
        // Method 3 — pdfreader fallback
        const { PdfReader } = require('pdfreader');
        return await new Promise((resolve, reject) => {
          const reader = new PdfReader();
          const lines  = {};
          reader.parseBuffer(buffer, (err, item) => {
            if (err) return reject(err);
            if (!item) {
              const text = Object.keys(lines)
                .sort((a, b) => a - b)
                .map(y => lines[y].join(' '))
                .join('\n');
              return resolve(text.trim());
            }
            if (item.text) {
              if (!lines[item.y]) lines[item.y] = [];
              lines[item.y].push(item.text);
            }
          });
        });
      } catch (e3) {
        throw new Error('All PDF methods failed: ' + e3.message);
      }
    }
  }
}

// ── POST /api/ai/upload ───────────────────────────────────────────────────
exports.uploadNotes = async (req, res) => {
  try {
    if (!req.file)
      return res.status(400).json({ message: 'No file uploaded.' });

    let text           = '';
    const filename     = req.file.originalname;
    const mimetype     = req.file.mimetype;

    if (mimetype === 'application/pdf') {
      // ── PDF ──────────────────────────────────────────────
      try {
        text = await extractPDFText(req.file.buffer);
      } catch (pdfErr) {
        console.error('[Upload] PDF error:', pdfErr.message);
        return res.status(400).json({ message: 'Could not read PDF. Try a .txt file.' });
      }

    } else if (mimetype.startsWith('image/')) {
      // ── IMAGE (OCR) ───────────────────────────────────────
      try {
        const Tesseract = require('tesseract.js');
        console.log('[Upload] Running OCR on image...');
        const { data } = await Tesseract.recognize(req.file.buffer, 'eng', {
          logger: m => {
            if (m.status === 'recognizing text')
              console.log('[OCR]', Math.round(m.progress * 100) + '%');
          },
        });
        text = data.text.trim();
        console.log('[Upload] OCR text length:', text.length);

        if (!text) {
          return res.status(400).json({
            message: 'No text found in image. Make sure the image contains readable text.',
          });
        }
      } catch (ocrErr) {
        console.error('[Upload] OCR error:', ocrErr.message);
        return res.status(400).json({
          message: 'Could not read text from image. Try a clearer image or .txt file.',
        });
      }

    } else {
      // ── TEXT / MARKDOWN ───────────────────────────────────
      text = req.file.buffer.toString('utf-8');
      console.log('[Upload] Text length:', text.length);
    }

    if (!text.trim())
      return res.status(400).json({ message: 'File appears to be empty.' });

    const chunkCount = await storeNoteEmbeddings(req.user.id, filename, text);
    console.log('[Upload] saved chunks:', chunkCount, 'for user:', req.user.id);

    res.json({
      message:  `Uploaded! Created ${chunkCount} chunks for "${filename}".`,
      filename,
      chunks:   chunkCount,
    });

  } catch (err) {
    console.error('[Upload ERROR]', err.message);
    res.status(500).json({ message: err.message || 'Upload failed.' });
  }
};
// ── POST /api/ai/chat ─────────────────────────────────────────────────────
exports.chat = async (req, res) => {
  try {
    const { message, mode } = req.body;
    if (!message?.trim())
      return res.status(400).json({ message: 'Message is required.' });

    const result = await chatWithRAG(req.user.id, message.trim(), mode || 'chat');
    res.json(result);

  } catch (err) {
    console.error('[AI Chat]', err.message);
    res.status(500).json({ message: err.message || 'AI service error.' });
  }
};

// ── GET /api/ai/notes ─────────────────────────────────────────────────────
exports.getNotes = async (req, res) => {
  try {
    const userId = new mongoose.Types.ObjectId(req.user.id);
    console.log('[getNotes] searching for userId:', userId.toString());

    // First check raw count
    const totalChunks = await NoteChunk.countDocuments({ user: userId });
    console.log('[getNotes] total chunks for user:', totalChunks);

    const notes = await NoteChunk.aggregate([
      { $match: { user: userId } },
      { $group: {
          _id:       '$filename',
          chunks:    { $sum: 1 },
          updatedAt: { $max: '$updatedAt' },
      }},
      { $sort: { updatedAt: -1 } },
    ]);

    console.log('[getNotes] aggregated notes:', JSON.stringify(notes));

    // Prevent browser caching
    res.set('Cache-Control', 'no-store');
    res.json({ notes });

  } catch (err) {
    console.error('[getNotes ERROR]', err.message);
    res.status(500).json({ message: err.message });
  }
};
// ── DELETE /api/ai/notes/:filename ────────────────────────────────────────
exports.deleteNote = async (req, res) => {
  try {
    const filename = decodeURIComponent(req.params.filename);
    const result   = await NoteChunk.deleteMany({ user: req.user.id, filename });
    console.log('[deleteNote] deleted:', result.deletedCount, 'chunks for:', filename);
    res.json({ message: `"${filename}" deleted.` });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};