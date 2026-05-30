/**
 * marksUploadController.js
 * ─────────────────────────────────────────────────────────────────────────────
 * POST /marks/upload-pdf        — legacy single-PDF column-based flow
 * POST /marks/parse-pdfs        — parse one or more PDFs → per-file student scores
 * POST /marks/generate-leaderboard — merge sources with labels/weights → ranked list
 * ─────────────────────────────────────────────────────────────────────────────
 */

const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');
const os = require('os');
const { detectColumns } = require('../services/columnDetector');
const { applyWeights } = require('../services/weightCalculator');
const { processLeaderboard } = require('../services/rankingService');
const {
  studentsFromRawRows,
  scoreStudentsForSource,
  computeSourceFileWeight,
} = require('../services/pdfScoreExtractor');
const { mergeSourcesAndScore } = require('../services/multiPdfMergeService');
const { buildSgpaLeaderboard, DEFAULT_CREDITS } = require('../services/sgpaLeaderboardService');
const { parseScannedGradePdf, normalizeGrade, fuzzyMatchGrade } = require('../services/ocrGradePdfParser');
const { aiCorrectGrades } = require('../services/aiOcrCorrectionService');

const PARSER_SCRIPT = path.join(__dirname, '../scripts/parsePdf.py');

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

    const timeout = setTimeout(() => {
      proc.kill();
      try { fs.unlinkSync(tmpPath); } catch (_) {}
      reject(new Error('PDF parsing timed out after 120s. The PDF may be too large or corrupted.'));
    }, 120000);

    proc.stdout.on('data', (chunk) => { stdout += chunk.toString(); });
    proc.stderr.on('data', (chunk) => {
      stderr += chunk.toString();
      console.error('PYTHON ERROR:', chunk.toString());
    });

    proc.on('close', (code) => {
      clearTimeout(timeout);
      try { fs.unlinkSync(tmpPath); } catch (_) {}

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

    proc.on('error', (err) => {
      clearTimeout(timeout);
      try { fs.unlinkSync(tmpPath); } catch (_) {}
      reject(new Error(`Could not start Python: ${err.message}. Is Python 3 in PATH?`));
    });
  });
}

function defaultLabelFromFilename(filename, index) {
  const base = String(filename || `PDF ${index + 1}`)
    .replace(/\.pdf$/i, '')
    .replace(/[_-]+/g, ' ')
    .trim();
  return base || `Source ${index + 1}`;
}

/* ── Legacy: single PDF + column weights ─────────────────────────────────── */
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

    const { columns, studentRows } = detectColumns(rawRows);

    if (columns.length === 0) {
      return res.status(422).json({
        message: 'No mark columns detected.',
        hint: 'Headers like TQ1(10), MT(30) are auto-detected. Check your PDF.',
        rawSample: rawRows.slice(0, 3),
      });
    }

    let active;
    if (selectedColumns.length > 0) {
      active = selectedColumns;
    } else {
      const pretotalCol = columns.find((c) => {
        const nameLower = (c.name || '').toLowerCase();
        const headerLower = (c.originalHeader || '').toLowerCase();
        return nameLower.includes('pretotal') || headerLower.includes('pretotal');
      });
      if (pretotalCol) {
        active = [pretotalCol.name];
      } else {
        active = columns.filter((c) => !c.isAggregate).map((c) => c.name);
        if (!active.length) active = columns.map((c) => c.name);
      }
    }
    const weightedRows = applyWeights(studentRows, columns, active, weights);
    const result = processLeaderboard(weightedRows, columns);

    if (req.query.exportExcel === 'true') {
      const XLSX = require('xlsx');
      const students = result.leaderboard?.[0]?.students || [];
      const rows = students.map((s) => ({
        Rank : s.rank,
        Name : s.name,
        Roll : s.roll,
        Total: s.totalScore,
      }));
      const ws = XLSX.utils.json_to_sheet(rows);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, 'Leaderboard');
      const buffer = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });
      res.setHeader('Content-Disposition', 'attachment; filename=leaderboard.xlsx');
      res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
      return res.send(buffer);
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

/* ── New: parse multiple PDFs ───────────────────────────────────────────── */
async function parsePdfsHandler(req, res) {
  try {
    const files = req.files?.length ? req.files : (req.file ? [req.file] : []);
    if (!files.length) {
      if (!res.headersSent) return res.status(400).json({ message: 'No PDF files uploaded.' });
      return;
    }

    const sources = [];

    for (let i = 0; i < files.length; i++) {
      if (res.headersSent) return;
      const file = files[i];
      let rawRows;
      try {
        rawRows = await parsePdfWithPython(file.buffer);
        if (!rawRows.length) {
          rawRows = await parseScannedGradePdf(file.buffer);
        }
      } catch (err) {
        if (!res.headersSent) return res.status(422).json({
          message: `Failed to parse "${file.originalname}".`,
          detail: err.message,
        });
        return;
      }

      const parsed = studentsFromRawRows(rawRows);
      if (!parsed.studentRows.length) {
        if (!res.headersSent) return res.status(422).json({
          message: `No students found in "${file.originalname}".`,
          hint: 'Ensure the PDF is a tabular marks sheet with a header row.',
        });
        return;
      }

      sources.push({
        id              : `pdf_${Date.now()}_${i}_${Math.random().toString(36).slice(2, 8)}`,
        fileName        : file.originalname,
        label           : defaultLabelFromFilename(file.originalname, i),
        credits         : DEFAULT_CREDITS,
        columns         : parsed.columns.map((c) => ({ name: c.name, max: c.max })),
        studentRows     : parsed.studentRows,
        columnWeights   : parsed.columnWeights,
        selectedColumns : parsed.selectedColumns,
        studentCount    : parsed.studentRows.length,
      });
    }

    if (!res.headersSent) return res.json({ method: 'multi-pdf', sources });
  } catch (err) {
    console.error('[parse-pdfs]', err);
    if (!res.headersSent) return res.status(500).json({ message: err.message || 'Unexpected server error.' });
  }
}

/* ── New: generate leaderboard from parsed sources ──────────────────────── */
async function generateLeaderboardHandler(req, res) {
  try {
    let sources = req.body?.sources;
    if (typeof sources === 'string') {
      try {
        sources = JSON.parse(sources);
      } catch {
        return res.status(400).json({ message: 'sources must be valid JSON.' });
      }
    }

    if (!Array.isArray(sources) || sources.length === 0) {
      return res.status(400).json({ message: 'sources array is required.' });
    }

    const normalized = sources.map((s, i) => {
      const label = String(s.label || `Source ${i + 1}`).trim() || `Source ${i + 1}`;
      const columns = Array.isArray(s.columns) ? s.columns : [];
      const studentRows = Array.isArray(s.studentRows) ? s.studentRows : [];
      const selectedColumns = Array.isArray(s.selectedColumns) && s.selectedColumns.length
        ? s.selectedColumns
        : columns.map((c) => c.name);
      const columnWeights = s.columnWeights && typeof s.columnWeights === 'object'
        ? s.columnWeights
        : {};

      // Backend MUST ALWAYS enforce student limits even if frontend already slices rows
      const studentLimit = s.studentLimit !== undefined && s.studentLimit !== '' ? parseInt(s.studentLimit) : null;
      let rowsToProcess = studentRows;
      if (studentLimit !== null && !isNaN(studentLimit) && studentLimit > 0) {
        rowsToProcess = studentRows.slice(0, studentLimit);
      }

      // Per-column weights → one score per student, then PDF-level weight merge
      const students = rowsToProcess.length
        ? scoreStudentsForSource({
          studentRows: rowsToProcess,
          columns,
          selectedColumns,
          columnWeights,
        })
        : (Array.isArray(s.students) ? s.students.slice(0, studentLimit || s.students.length) : []);

      const weight = computeSourceFileWeight(columns, selectedColumns, columnWeights);

      return {
        id       : s.id || `source_${i}`,
        label,
        weight,
        students,
        columns,
        selectedColumns,
        columnWeights,
      };
    });

    if (normalized.some((s) => !s.label)) {
      return res.status(400).json({ message: 'Each source must have a label.' });
    }
    if (normalized.some((s) => Number.isNaN(s.weight))) {
      return res.status(400).json({ message: 'Each source must have a numeric weight.' });
    }

    const bestOfConfigs = Array.isArray(req.body?.bestOfConfigs) ? req.body.bestOfConfigs : [];
    let result = mergeSourcesAndScore(normalized, bestOfConfigs);

    // Apply Relative Grading if enabled
    const relativeGradingEnabled = req.body?.relativeGradingEnabled === true || req.body?.relativeGradingEnabled === 'true';
    if (relativeGradingEnabled) {
      const { assignRelativeGrades } = require('../services/relativeGradingService');
      const gradeCounts = req.body?.gradeCounts || {};
      
      // Relative grades MUST be assigned AFTER sorting students by marks descending
      result.rankedStudents = assignRelativeGrades(result.rankedStudents, gradeCounts);

      // Map back to leaderboard structure
      const studentGradeMap = new Map(result.rankedStudents.map(st => [st.roll || st.name, st.grade]));
      if (result.leaderboard?.[0]?.students) {
        result.leaderboard[0].students = result.leaderboard[0].students.map(st => ({
          ...st,
          grade: studentGradeMap.get(st.roll || st.name) || 'F'
        }));
      }
    }

    if (req.query.exportExcel === 'true') {
      const XLSX = require('xlsx');
      const students = result.leaderboard?.[0]?.students || [];
      const labels = result.sources.map((s) => s.label);
      const bestOfGroupsMeta = result.bestOfGroups || [];
      const bestOfColLabels = bestOfGroupsMeta.map((g, i) =>
        `Best ${g.bestOf}/${g.itemCount}: ${g.label}`
      );
      const rows = students.map((s) => {
        const row = { Rank: s.rank, Name: s.name, Roll: s.roll || '' };
        labels.forEach((label) => {
          row[label] = s.breakdown?.[label]?.raw ?? 0;
        });
        bestOfGroupsMeta.forEach((bg, i) => {
          const key = `🎯 ${bg.label}`;
          const bd = s.breakdown?.[key];
          row[bestOfColLabels[i]] = bd?.score ?? 0;
          if (bd?.bestOf?.selected?.length) {
            row[`Best ${i + 1} selected`] = bd.bestOf.selected.join(', ');
          }
        });
        row['Final Score'] = s.totalScore;
        if (s.grade) {
          row['Grade'] = s.grade;
        }
        return row;
      });
      const ws = XLSX.utils.json_to_sheet(rows);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, 'Leaderboard');
      const buffer = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });
      res.setHeader('Content-Disposition', 'attachment; filename=leaderboard.xlsx');
      res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
      return res.send(buffer);
    }

    return res.json({ method: 'multi-pdf', ...result });
  } catch (err) {
    console.error('[generate-leaderboard]', err);
    return res.status(500).json({ message: err.message || 'Unexpected server error.' });
  }
}

async function generateSgpaLeaderboardHandler(req, res) {
  try {
    let sources = req.body?.sources;
    if (typeof sources === 'string') {
      try {
        sources = JSON.parse(sources);
      } catch {
        return res.status(400).json({ message: 'sources must be valid JSON.' });
      }
    }

    if (!Array.isArray(sources) || sources.length === 0) {
      return res.status(400).json({ message: 'sources array is required.' });
    }

    const normalized = sources.map((s, i) => ({
      id: s.id || `source_${i}`,
      fileName: s.fileName || `PDF ${i + 1}`,
      label: String(s.label || s.fileName || `Subject ${i + 1}`).trim() || `Subject ${i + 1}`,
      credits: s.credits === '' || s.credits === undefined ? DEFAULT_CREDITS : Number(s.credits),
      studentRows: Array.isArray(s.studentRows) ? s.studentRows : [],
    }));

    const result = buildSgpaLeaderboard(normalized);

    if (req.query.exportExcel === 'true') {
      const XLSX = require('xlsx');
      const rows = result.rankedStudents.map((s) => ({
        Rank: s.rank,
        SID: s.sid || '',
        'Roll Number': s.roll || '',
        'Student Name': s.name,
        SGPA: s.sgpa,
        'Total Credits': s.totalCredits,
        'Subjects Count': s.subjectsCount,
      }));
      const ws = XLSX.utils.json_to_sheet(rows);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, 'SGPA Leaderboard');
      const buffer = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });
      res.setHeader('Content-Disposition', 'attachment; filename=sgpa-leaderboard.xlsx');
      res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
      return res.send(buffer);
    }

    return res.json({ method: 'sgpa-multi-pdf', ...result });
  } catch (err) {
    console.error('[generate-sgpa-leaderboard]', err);
    const message = err.message || 'Unexpected server error.';
    return res.status(message.includes('Credits') ? 400 : 500).json({ message });
  }
}

/* ── AI-powered OCR grade correction ─────────────────────────────────── */
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

/* ── Save OCR review corrections and generate SGPA leaderboard ───────── */
async function ocrReviewGenerateHandler(req, res) {
  try {
    const { sources, correctedGrades } = req.body;
    if (!Array.isArray(sources) || !sources.length) {
      return res.status(400).json({ message: 'sources array is required.' });
    }

    const correctedMap = new Map();
    if (Array.isArray(correctedGrades)) {
      for (const cg of correctedGrades) {
        if (cg.roll && cg.grade) {
          const fuzzy = fuzzyMatchGrade(cg.grade);
          correctedMap.set(cg.roll, fuzzy.grade || cg.grade);
        }
      }
    }

    const normalized = sources.map((s, i) => {
      const label = String(s.label || s.fileName || `Subject ${i + 1}`).trim() || `Subject ${i + 1}`;
      const credits = Number(s.credits ?? DEFAULT_CREDITS);

      let studentRows = Array.isArray(s.studentRows) ? s.studentRows : [];
      if (correctedMap.size > 0) {
        studentRows = studentRows.map((row) => {
          const corrected = correctedMap.get(row.roll);
          if (corrected) {
            return { ...row, grade: corrected, marks: { ...row.marks, Grade: corrected } };
          }
          return row;
        });
      }

      return {
        id: s.id || `source_${i}`,
        fileName: s.fileName || `PDF ${i + 1}`,
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

module.exports = {
  uploadPdfHandler,
  parsePdfsHandler,
  generateLeaderboardHandler,
  generateSgpaLeaderboardHandler,
  ocrAiCorrectHandler,
  ocrReviewGenerateHandler,
  parsePdfWithPython,
};
