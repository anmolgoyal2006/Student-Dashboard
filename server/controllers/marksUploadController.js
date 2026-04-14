/**
 * marksUploadController.js  (FIXED)
 * ─────────────────────────────────────────────────────────────────────────────
 * POST /marks/upload-pdf
 *
 * ROOT CAUSE OF OLD BUG:
 *   pdf-parse extracts text line-by-line and loses column alignment on page 2+
 *   when the PDF has no visible grid lines. Names and marks merged into one
 *   token: "PULKIT SACHDEVA7735 16" → impossible to split correctly.
 *
 * FIX:
 *   Use Python pdfplumber via child_process.spawn. pdfplumber uses
 *   x-coordinate bounding boxes to cluster characters into correct columns
 *   regardless of page. Works for ANY tabular PDF.
 *
 * Pipeline:
 *   1. Save uploaded buffer to tmp file
 *   2. Spawn: python3 parsePdf.py <tmpFile>  → JSON array of raw rows
 *   3. detectColumns()   → { columns, studentRows }
 *   4. applyWeights()    → weightedRows
 *   5. rankStudents()    → rankedRows + summary
 *   6. Cleanup tmp file  → return JSON
 *
 * One-time server setup:
 *   pip install pdfplumber
 * ─────────────────────────────────────────────────────────────────────────────
 */

const { spawn }                         = require('child_process');
const fs                                = require('fs');
const path                              = require('path');
const os                                = require('os');
const { detectColumns } = require('../services/columnDetector');
const { applyWeights } = require('../services/weightCalculator');
const { processLeaderboard } = require('../services/rankingService');
// Path to the Python parser script
const PARSER_SCRIPT = path.join(__dirname, '../scripts/parsePdf.py');

/* ─────────────────────────────────────────────────────────────────────────────
   parsePdfWithPython
   Saves buffer → tmp file → runs parsePdf.py → returns parsed rows array
   ───────────────────────────────────────────────────────────────────────────── */
function parsePdfWithPython(buffer) {
  return new Promise((resolve, reject) => {
    const tmpPath = path.join(
      os.tmpdir(),
      `marks_${Date.now()}_${Math.random().toString(36).slice(2)}.pdf`
    );
    fs.writeFileSync(tmpPath, buffer);

    let stdout = '';
    let stderr = '';

 const PYTHON_BIN = process.platform === 'win32' ? 'python' : 'python3';
const proc = spawn(PYTHON_BIN, [PARSER_SCRIPT, tmpPath]);

    proc.stdout.on('data', chunk => { stdout += chunk.toString(); });
   proc.stderr.on('data', chunk => { 
  stderr += chunk.toString(); 
  console.error("PYTHON ERROR:", chunk.toString());
});

    proc.on('close', code => {
      try { fs.unlinkSync(tmpPath); } catch (_) {}

      if (code !== 0) {
        return reject(new Error(
          `PDF parser failed (exit ${code}). ` +
          (stderr ? stderr : 'Is pdfplumber installed? Run: pip install pdfplumber')
        ));
      }

      try {
        const parsed = JSON.parse(stdout.trim());
        if (parsed && parsed.error) return reject(new Error(`PDF parse error: ${parsed.error}`));
        if (!Array.isArray(parsed)) return reject(new Error('Parser returned unexpected format.'));
        resolve(parsed);
      } catch (e) {
        reject(new Error(`Could not parse PDF output as JSON: ${e.message}`));
      }
    });

    proc.on('error', err => {
      try { fs.unlinkSync(tmpPath); } catch (_) {}
      reject(new Error(`Could not start Python: ${err.message}. Is Python 3 in PATH?`));
    });
  });
}

/* ─────────────────────────────────────────────────────────────────────────────
   Route handler
   ───────────────────────────────────────────────────────────────────────────── */
async function uploadPdfHandler(req, res) {
  try {
    // ── 0. Validate ───────────────────────────────────────────────────────────
    if (!req.file) {
      return res.status(400).json({ message: 'No PDF file uploaded.' });
    }

    // ── 1. Parse request body params ──────────────────────────────────────────
    let selectedColumns = [];
    let weights         = {};

    try {
      if (req.body.selectedColumns) selectedColumns = JSON.parse(req.body.selectedColumns);
    } catch {
      return res.status(400).json({ message: 'selectedColumns must be a JSON array string.' });
    }

    try {
      if (req.body.weights) weights = JSON.parse(req.body.weights);
    } catch {
      return res.status(400).json({ message: 'weights must be a JSON object string.' });
    }

    // ── 2. Parse PDF → rawRows via Python/pdfplumber ──────────────────────────
    let rawRows;
    try {
      rawRows = await parsePdfWithPython(req.file.buffer);
    } catch (err) {
      return res.status(422).json({ message: 'Failed to extract data from PDF.', detail: err.message });
    }

    if (rawRows.length === 0) {
      return res.status(422).json({
        message: 'PDF parsed but no student rows found.',
        hint: 'Ensure the file is a tabular marks sheet with a header row.',
      });
    }

    // ── 3. Detect columns ─────────────────────────────────────────────────────
    const { columns, studentRows } = detectColumns(rawRows);

    if (columns.length === 0) {
      return res.status(422).json({
        message: 'No mark columns detected.',
        hint: 'Headers like TQ1(10), MT(30) are auto-detected. Check your PDF.',
        rawSample: rawRows.slice(0, 3),
      });
    }

    // ── 4. Validate weights ───────────────────────────────────────────────────
    const active = selectedColumns.length > 0 ? selectedColumns : columns.map(c => c.name);
    

    // ── 5. Apply weights → normalized scores ──────────────────────────────────
    const weightedRows = applyWeights(studentRows, columns, selectedColumns, weights);

    // ── 6. Rank ───────────────────────────────────────────────────────────────
    // ── 6. Rank + Build Leaderboard ───────────────────────────────────────────
const result = processLeaderboard(weightedRows, columns);

// 👉 EXCEL MODE
if (req.query.exportExcel === 'true') {
  const XLSX = require('xlsx');

  const students = result.leaderboard?.[0]?.students || [];

  const rows = students.map(s => ({
    Rank: s.rank,
    Name: s.name,
    Roll: s.roll,
    Total: s.totalScore
  }));

  const ws = XLSX.utils.json_to_sheet(rows);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Leaderboard');

  const buffer = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });

  res.setHeader(
    'Content-Disposition',
    'attachment; filename=leaderboard.xlsx'
  );
  res.setHeader(
    'Content-Type',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
  );

  return res.send(buffer);
}

// 👉 NORMAL JSON RESPONSE
return res.json({
  columns,
  selectedColumns: active,
  weights,
  ...result
});

  } catch (err) {
    console.error('[upload-pdf]', err);
    return res.status(500).json({ message: err.message || 'Unexpected server error.' });
  }
}

module.exports = { uploadPdfHandler };

/*
────────────────────────────────────────────────────────────────────
ROUTER REGISTRATION (add to your marks router — unchanged):
────────────────────────────────────────────────────────────────────

const multer               = require('multer');
const { uploadPdfHandler } = require('./controllers/marksUploadController');
const upload               = multer({ storage: multer.memoryStorage() });

router.post('/upload-pdf', authMiddleware, upload.single('file'), uploadPdfHandler);

────────────────────────────────────────────────────────────────────
*/