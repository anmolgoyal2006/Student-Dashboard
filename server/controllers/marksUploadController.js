/**
 * marksUploadController.js
 * ─────────────────────────────────────────────────────────────────────────────
 * POST /marks/upload-pdf        — legacy single-PDF column-based flow
 * POST /marks/parse-pdfs        — parse one or more PDFs → per-file student scores
 * POST /marks/generate-leaderboard — merge sources with labels/weights → ranked list
 * ─────────────────────────────────────────────────────────────────────────────
 */

const { spawn } = require('child_process');
const fs   = require('fs');
const path = require('path');
const os   = require('os');

const { detectColumns }           = require('../services/columnDetector');
const { applyWeights }            = require('../services/weightCalculator');
const { processLeaderboard }      = require('../services/rankingService');
const {
  studentsFromRawRows,
  scoreStudentsForSource,
  computeSourceFileWeight,
} = require('../services/pdfScoreExtractor');
const { mergeSourcesAndScore }    = require('../services/multiPdfMergeService');
const { buildSgpaLeaderboard, DEFAULT_CREDITS } = require('../services/sgpaLeaderboardService');
const {
  parseScannedGradePdf,
  normalizeGrade,
  resolvePython,
  buildChildEnv,
  GRADE_POINTS,
} = require('../services/ocrGradePdfParser');
const { aiCorrectGrades }         = require('../services/aiOcrCorrectionService');
const { isScannedPdf }            = require('../utils/isScannedPdf');

const PARSER_SCRIPT = path.join(__dirname, '../scripts/parsePdf.py');

// ── Helpers ───────────────────────────────────────────────────────────────

function defaultLabelFromFilename(filename, index) {
  const base = String(filename || `PDF ${index + 1}`)
    .replace(/\.pdf$/i, '')
    .replace(/[_-]+/g, ' ')
    .trim();
  return base || `Source ${index + 1}`;
}

function writeTempPdf(buffer) {
  const tmpPath = path.join(
    os.tmpdir(),
    `marks_${Date.now()}_${Math.random().toString(36).slice(2)}.pdf`
  );
  fs.writeFileSync(tmpPath, buffer);
  return tmpPath;
}

function removeTempFile(filePath) {
  try { fs.unlinkSync(filePath); } catch (_) {}
}

// ── Python typed-PDF parser ───────────────────────────────────────────────

function parsePdfWithPython(buffer) {
  return new Promise((resolve, reject) => {
    const tmpPath = writeTempPdf(buffer);
    let stdout = '';
    let stderr = '';

    const proc = spawn(resolvePython(), [PARSER_SCRIPT, tmpPath], {
      env: buildChildEnv(),
    });

    const timeout = setTimeout(() => {
      proc.kill();
      removeTempFile(tmpPath);
      reject(new Error('PDF parsing timed out after 600s. The PDF may be too large or corrupted.'));
    }, 600_000);

    proc.stdout.on('data', chunk => { stdout += chunk.toString(); });
    proc.stderr.on('data', chunk => {
      stderr += chunk.toString();
      console.error('[parsePdf.py]', chunk.toString().trim());
    });

    proc.on('close', code => {
      clearTimeout(timeout);
      removeTempFile(tmpPath);

      if (code !== 0) {
        return reject(new Error(
          `PDF parser failed (exit ${code}). ` +
          (stderr || 'Is pdfplumber installed? Run: pip install pdfplumber')
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
      clearTimeout(timeout);
      removeTempFile(tmpPath);
      reject(new Error(`Could not start Python: ${err.message}. Is Python 3 in PATH?`));
    });
  });
}

// ── OCR branch: scanned/handwritten PDF ──────────────────────────────────

/**
 * Parse a scanned PDF.
 * Returns rows shaped like: { name, roll, grade, gradePoints, marks, source }
 */
async function parseScannedPdf(buffer) {
  // parseScannedGradePdf handles everything: Python subprocess, cell cropping,
  // Tesseract OCR, grade normalization, deduplication, gradePoints.
  const rows = await parseScannedGradePdf(buffer);
  console.log(`[OCR] Parsed ${rows.length} students from scanned PDF`);
  return rows;
}

// ── Legacy: single PDF + column weights ──────────────────────────────────

async function uploadPdfHandler(req, res) {
  try {
    if (!req.file) {
      return res.status(400).json({ message: 'No PDF file uploaded.' });
    }

    let selectedColumns = [];
    let weights = {};

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

    // Write buffer to temp file for scanned check
    const tmpPath = writeTempPdf(req.file.buffer);
    let rawRows = [];

    try {
      const scanned = await isScannedPdf(tmpPath);
      console.log(`[OCR] isScanned: ${scanned}`);

      if (scanned) {
        console.log('[OCR] Scanned PDF detected, using OCR parser...');
        rawRows = await parseScannedPdf(req.file.buffer);
      } else {
        rawRows = await parsePdfWithPython(req.file.buffer);
      }
    } catch (err) {
      return res.status(422).json({
        message: 'Failed to extract data from PDF.',
        detail: err.message,
      });
    } finally {
      removeTempFile(tmpPath);
    }

    if (rawRows.length === 0) {
      return res.status(422).json({
        message: 'PDF parsed but no student rows found.',
        hint: 'Ensure the file is a tabular marks sheet with a header row.',
      });
    }

    const { columns, studentRows } = detectColumns(rawRows);
    console.log(`[OCR] final students: ${studentRows.length}`);

    if (columns.length === 0) {
      return res.status(422).json({
        message: 'No mark columns detected.',
        hint: 'Headers like TQ1(10), MT(30) are auto-detected. Check your PDF.',
        rawSample: rawRows.slice(0, 3),
      });
    }

    // Determine active columns
    let active;
    if (selectedColumns.length > 0) {
      active = selectedColumns;
    } else {
      const pretotalCol = columns.find(c => {
        const n = (c.name || '').toLowerCase();
        const h = (c.originalHeader || '').toLowerCase();
        return n.includes('pretotal') || h.includes('pretotal');
      });
      active = pretotalCol
        ? [pretotalCol.name]
        : columns.filter(c => !c.isAggregate).map(c => c.name);
      if (!active.length) active = columns.map(c => c.name);
    }

    const weightedRows = applyWeights(studentRows, columns, active, weights);
    const result       = processLeaderboard(weightedRows, columns);

    if (req.query.exportExcel === 'true') {
      const XLSX     = require('xlsx');
      const students = result.leaderboard?.[0]?.students || [];
      const rows     = students.map(s => ({
        Rank : s.rank,
        Name : s.name,
        Roll : s.roll,
        Total: s.totalScore,
      }));
      const ws = XLSX.utils.json_to_sheet(rows);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, 'Leaderboard');
      const buf = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });
      res.setHeader('Content-Disposition', 'attachment; filename=leaderboard.xlsx');
      res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
      return res.send(buf);
    }

    return res.json({
      columns,
      studentRows,
      selectedColumns: active,
      weights,
      method: 'columns',
      ...result,
    });
  } catch (err) {
    console.error('[upload-pdf]', err);
    return res.status(500).json({ message: err.message || 'Unexpected server error.' });
  }
}

// ── New: parse multiple PDFs ──────────────────────────────────────────────

async function parsePdfsHandler(req, res) {
  try {
    const files = req.files?.length ? req.files : (req.file ? [req.file] : []);
    if (!files.length) {
      return res.status(400).json({ message: 'No PDF files uploaded.' });
    }

    const sources = [];

    for (let i = 0; i < files.length; i++) {
      if (res.headersSent) return;

      const file    = files[i];
      const tmpPath = writeTempPdf(file.buffer);
      let rawRows;

      try {
        const scanned = await isScannedPdf(tmpPath);

        if (scanned) {
          console.log(`[OCR] Scanned PDF detected for "${file.originalname}", using OCR parser...`);
          rawRows = await parseScannedPdf(file.buffer);
        } else {
          rawRows = await parsePdfWithPython(file.buffer);

          // Fallback: if typed parser returns nothing, try OCR anyway
          if (!rawRows.length) {
            console.log(`[OCR] Typed parser returned 0 rows for "${file.originalname}", trying OCR fallback...`);
            rawRows = await parseScannedPdf(file.buffer);
          }
        }
      } catch (err) {
        console.error(`[parse-pdfs] Failed to parse "${file.originalname}":`, err.message);
        if (!res.headersSent) {
          return res.status(422).json({
            message: `Failed to parse "${file.originalname}".`,
            detail: err.message,
          });
        }
        return;
      } finally {
        removeTempFile(tmpPath);
      }

      const parsed = studentsFromRawRows(rawRows);

      if (!parsed.studentRows.length) {
        if (!res.headersSent) {
          return res.status(422).json({
            message: `No students found in "${file.originalname}".`,
            hint: 'Ensure the PDF is a tabular marks sheet with a header row.',
          });
        }
        return;
      }

      // AI OCR grade correction (only for OCR-sourced rows)
      let { studentRows } = parsed;
      const hasOcr = studentRows.some(r => r.source === 'ocr' || r.ocrGradeRaw);

      if (hasOcr) {
        try {
          const corrections = await aiCorrectGrades(
            studentRows.map(r => ({
              name          : r.name,
              roll          : r.roll,
              ocrGradeRaw   : r.ocrGradeRaw   || '',
              grade         : r.grade          || '',
              ocrConfidence : r.ocrConfidence  || 0,
              gradeCellPath : r.gradeCellPath  || '',
            }))
          );
          const corrMap = new Map(corrections.map(c => [c.index, c.correctedGrade]));
          studentRows = studentRows.map((r, idx) => {
            const corrected = corrMap.get(idx);
            return corrected
              ? { ...r, grade: corrected, marks: { ...r.marks, Grade: corrected } }
              : r;
          });
        } catch (err) {
          console.error('[parsePdfs] AI grade correction failed (non-fatal):', err.message);
        }
      }

      sources.push({
        id             : `pdf_${Date.now()}_${i}_${Math.random().toString(36).slice(2, 8)}`,
        fileName       : file.originalname,
        label          : defaultLabelFromFilename(file.originalname, i),
        credits        : DEFAULT_CREDITS,
        columns        : parsed.columns.map(c => ({ name: c.name, max: c.max })),
        studentRows,
        columnWeights  : parsed.columnWeights,
        selectedColumns: parsed.selectedColumns,
        studentCount   : studentRows.length,
      });
    }

    if (!res.headersSent) return res.json({ method: 'multi-pdf', sources });
  } catch (err) {
    console.error('[parse-pdfs]', err);
    if (!res.headersSent) {
      return res.status(500).json({ message: err.message || 'Unexpected server error.' });
    }
  }
}

// ── Generate leaderboard from parsed sources ──────────────────────────────

async function generateLeaderboardHandler(req, res) {
  try {
    let sources = req.body?.sources;
    if (typeof sources === 'string') {
      try { sources = JSON.parse(sources); } catch {
        return res.status(400).json({ message: 'sources must be valid JSON.' });
      }
    }
    if (!Array.isArray(sources) || sources.length === 0) {
      return res.status(400).json({ message: 'sources array is required.' });
    }

    const normalized = sources.map((s, i) => {
      const label          = String(s.label || `Source ${i + 1}`).trim() || `Source ${i + 1}`;
      const columns        = Array.isArray(s.columns) ? s.columns : [];
      const studentRows    = Array.isArray(s.studentRows) ? s.studentRows : [];
      const selectedColumns = Array.isArray(s.selectedColumns) && s.selectedColumns.length
        ? s.selectedColumns
        : columns.map(c => c.name);
      const columnWeights  = s.columnWeights && typeof s.columnWeights === 'object'
        ? s.columnWeights : {};

      const studentLimit = s.studentLimit !== undefined && s.studentLimit !== ''
        ? parseInt(s.studentLimit) : null;
      const rowsToProcess = studentLimit > 0
        ? studentRows.slice(0, studentLimit) : studentRows;

      const students = rowsToProcess.length
        ? scoreStudentsForSource({ studentRows: rowsToProcess, columns, selectedColumns, columnWeights })
        : (Array.isArray(s.students) ? s.students.slice(0, studentLimit || s.students.length) : []);

      const weight = computeSourceFileWeight(columns, selectedColumns, columnWeights);

      return { id: s.id || `source_${i}`, label, weight, students, columns, selectedColumns, columnWeights };
    });

    if (normalized.some(s => !s.label)) {
      return res.status(400).json({ message: 'Each source must have a label.' });
    }
    if (normalized.some(s => Number.isNaN(s.weight))) {
      return res.status(400).json({ message: 'Each source must have a numeric weight.' });
    }

    const bestOfConfigs = Array.isArray(req.body?.bestOfConfigs) ? req.body.bestOfConfigs : [];
    let result = mergeSourcesAndScore(normalized, bestOfConfigs);

    // Relative grading
    const relativeGradingEnabled =
      req.body?.relativeGradingEnabled === true ||
      req.body?.relativeGradingEnabled === 'true';

    if (relativeGradingEnabled) {
      const { assignRelativeGrades } = require('../services/relativeGradingService');
      const gradeCounts = req.body?.gradeCounts || {};
      result.rankedStudents = assignRelativeGrades(result.rankedStudents, gradeCounts);
      const gradeMap = new Map(result.rankedStudents.map(st => [st.roll || st.name, st.grade]));
      if (result.leaderboard?.[0]?.students) {
        result.leaderboard[0].students = result.leaderboard[0].students.map(st => ({
          ...st,
          grade: gradeMap.get(st.roll || st.name) || 'F',
        }));
      }
    }

    if (req.query.exportExcel === 'true') {
      const XLSX     = require('xlsx');
      const students = result.leaderboard?.[0]?.students || [];
      const labels   = result.sources.map(s => s.label);
      const bestOfGroupsMeta  = result.bestOfGroups || [];
      const bestOfColLabels   = bestOfGroupsMeta.map(g => `Best ${g.bestOf}/${g.itemCount}: ${g.label}`);

      const rows = students.map(s => {
        const row = { Rank: s.rank, Name: s.name, Roll: s.roll || '' };
        labels.forEach(label => { row[label] = s.breakdown?.[label]?.raw ?? 0; });
        bestOfGroupsMeta.forEach((bg, i) => {
          const key = `🎯 ${bg.label}`;
          const bd  = s.breakdown?.[key];
          row[bestOfColLabels[i]] = bd?.score ?? 0;
          if (bd?.bestOf?.selected?.length) row[`Best ${i + 1} selected`] = bd.bestOf.selected.join(', ');
        });
        row['Final Score'] = s.totalScore;
        if (s.grade) row['Grade'] = s.grade;
        return row;
      });

      const ws = XLSX.utils.json_to_sheet(rows);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, 'Leaderboard');
      const buf = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });
      res.setHeader('Content-Disposition', 'attachment; filename=leaderboard.xlsx');
      res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
      return res.send(buf);
    }

    return res.json({ method: 'multi-pdf', ...result });
  } catch (err) {
    console.error('[generate-leaderboard]', err);
    return res.status(500).json({ message: err.message || 'Unexpected server error.' });
  }
}

// ── SGPA leaderboard ──────────────────────────────────────────────────────

async function generateSgpaLeaderboardHandler(req, res) {
  try {
    let sources = req.body?.sources;
    if (typeof sources === 'string') {
      try { sources = JSON.parse(sources); } catch {
        return res.status(400).json({ message: 'sources must be valid JSON.' });
      }
    }
    if (!Array.isArray(sources) || sources.length === 0) {
      return res.status(400).json({ message: 'sources array is required.' });
    }

    const normalized = sources.map((s, i) => ({
      id         : s.id || `source_${i}`,
      fileName   : s.fileName || `PDF ${i + 1}`,
      label      : String(s.label || s.fileName || `Subject ${i + 1}`).trim() || `Subject ${i + 1}`,
      credits    : s.credits === '' || s.credits === undefined ? DEFAULT_CREDITS : Number(s.credits),
      studentRows: Array.isArray(s.studentRows) ? s.studentRows : [],
    }));

    const result = buildSgpaLeaderboard(normalized);

    if (req.query.exportExcel === 'true') {
      const XLSX = require('xlsx');
      const rows = result.rankedStudents.map(s => ({
        Rank           : s.rank,
        SID            : s.sid  || '',
        'Roll Number'  : s.roll || '',
        'Student Name' : s.name,
        SGPA           : s.sgpa,
        'Total Credits': s.totalCredits,
        'Subjects Count': s.subjectsCount,
      }));
      const ws = XLSX.utils.json_to_sheet(rows);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, 'SGPA Leaderboard');
      const buf = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });
      res.setHeader('Content-Disposition', 'attachment; filename=sgpa-leaderboard.xlsx');
      res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
      return res.send(buf);
    }

    return res.json({ method: 'sgpa-multi-pdf', ...result });
  } catch (err) {
    console.error('[generate-sgpa-leaderboard]', err);
    const message = err.message || 'Unexpected server error.';
    return res.status(message.includes('Credits') ? 400 : 500).json({ message });
  }
}

// ── AI OCR correction endpoint ────────────────────────────────────────────

async function ocrAiCorrectHandler(req, res) {
  try {
    const { students } = req.body;
    if (!Array.isArray(students) || !students.length) {
      return res.status(400).json({ message: 'students array is required.' });
    }
    const corrections = await aiCorrectGrades(students);
    return res.json({ corrections });
  } catch (err) {
    console.error('[ocr-ai-correct]', err);
    return res.status(500).json({ message: err.message || 'Unexpected server error.' });
  }
}

// ── OCR review + SGPA generation ──────────────────────────────────────────

async function ocrReviewGenerateHandler(req, res) {
  try {
    const { sources, correctedGrades } = req.body;
    if (!Array.isArray(sources) || !sources.length) {
      return res.status(400).json({ message: 'sources array is required.' });
    }

    // Build correction lookup: roll → corrected grade
    const correctedMap = new Map();
    if (Array.isArray(correctedGrades)) {
      for (const cg of correctedGrades) {
        if (cg.roll && cg.grade) {
          const grade = normalizeGrade(cg.grade) || cg.grade;
          correctedMap.set(cg.roll, grade);
        }
      }
    }

    const normalized = sources.map((s, i) => {
      const label   = String(s.label || s.fileName || `Subject ${i + 1}`).trim() || `Subject ${i + 1}`;
      const credits = Number(s.credits ?? DEFAULT_CREDITS);

      let studentRows = Array.isArray(s.studentRows) ? s.studentRows : [];
      if (correctedMap.size > 0) {
        studentRows = studentRows.map(row => {
          const corrected = correctedMap.get(row.roll);
          return corrected
            ? { ...row, grade: corrected, marks: { ...row.marks, Grade: corrected } }
            : row;
        });
      }

      return {
        id        : s.id || `source_${i}`,
        fileName  : s.fileName || `PDF ${i + 1}`,
        label,
        credits,
        studentRows,
      };
    });

    const result = buildSgpaLeaderboard(normalized);
    return res.json({ method: 'sgpa-ocr-reviewed', ...result });
  } catch (err) {
    console.error('[ocr-review-generate]', err);
    const message = err.message || 'Unexpected server error.';
    return res.status(message.includes('Credits') ? 400 : 500).json({ message });
  }
}

// ── Exports ───────────────────────────────────────────────────────────────

module.exports = {
  uploadPdfHandler,
  parsePdfsHandler,
  generateLeaderboardHandler,
  generateSgpaLeaderboardHandler,
  ocrAiCorrectHandler,
  ocrReviewGenerateHandler,
  parsePdfWithPython,
};