const NoteChunk = require('../models/NoteChunk');
const { storeNoteEmbeddings, chatWithRAG } = require('../services/ragService');

// ── Helper: extract text from PDF buffer ──────────────────────────────────
async function extractPDFText(buffer) {
  return new Promise((resolve, reject) => {
    const { PdfReader } = require('pdfreader');
    const reader        = new PdfReader();
    const lines         = {};
    let   text          = '';

    reader.parseBuffer(buffer, (err, item) => {
      if (err) {
        reject(err);
      } else if (!item) {
        // End of file — join all collected text
        text = Object.keys(lines)
          .sort((a, b) => a - b)
          .map(y => lines[y].join(' '))
          .join('\n');
        resolve(text.trim());
      } else if (item.text) {
        // Group text by y-position (line)
        const y = item.y;
        if (!lines[y]) lines[y] = [];
        lines[y].push(item.text);
      }
    });
  });
}

// ── POST /api/ai/upload ───────────────────────────────────────────────────
exports.uploadNotes = async (req, res) => {
  try {
    console.log('[Upload] file:', req.file?.originalname, req.file?.mimetype);

    if (!req.file)
      return res.status(400).json({ message: 'No file uploaded.' });

    let text       = '';
    const filename = req.file.originalname;

    if (req.file.mimetype === 'application/pdf') {
      try {
        text = await extractPDFText(req.file.buffer);
        console.log('[Upload] PDF text length:', text.length);

        if (!text.trim()) {
          return res.status(400).json({
            message: 'PDF appears to be scanned/image-based. Please upload a text-based PDF or .txt file.',
          });
        }
      } catch (pdfErr) {
        console.error('[Upload] PDF error:', pdfErr.message);
        return res.status(400).json({
          message: 'Could not read PDF. Please try a .txt file instead.',
        });
      }
    } else {
      text = req.file.buffer.toString('utf-8');
      console.log('[Upload] Text length:', text.length);
    }

    if (!text.trim())
      return res.status(400).json({ message: 'File appears to be empty.' });

    const chunkCount = await storeNoteEmbeddings(req.user.id, filename, text);

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
    const notes = await NoteChunk.aggregate([
      { $match:  { user: req.user._id } },
      { $group:  { _id: '$filename', chunks: { $sum: 1 }, updatedAt: { $max: '$updatedAt' } } },
      { $sort:   { updatedAt: -1 } },
    ]);
    res.json({ notes });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// ── DELETE /api/ai/notes/:filename ────────────────────────────────────────
exports.deleteNote = async (req, res) => {
  try {
    const filename = decodeURIComponent(req.params.filename);
    await NoteChunk.deleteMany({ user: req.user.id, filename });
    res.json({ message: `"${filename}" deleted.` });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};