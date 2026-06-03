'use strict';

/**
 * ocrGradePdfParser.js
 *
 * Calls the Python extractGradeCells.py script which:
 *   1. Detects table grid lines with OpenCV
 *   2. Crops each cell individually
 *   3. Runs Tesseract on each cell
 *   4. Returns JSON array of { sid, name, grade }
 *
 * This module just spawns the script, receives the JSON,
 * adds gradePoints, and returns rows ready for your existing pipeline.
 */

const fs   = require('fs');
const os   = require('os');
const path = require('path');
const { spawn } = require('child_process');

require('dotenv').config({ path: path.join(__dirname, '../.env') });

// ── Constants ─────────────────────────────────────────────────────────────

const EXTRACT_SCRIPT = path.join(__dirname, '../scripts/extractGradeCells.py');

const VALID_GRADES = ['A+', 'A', 'B+', 'B', 'C+', 'C', 'D', 'F', 'F(UMC)'];

const GRADE_POINTS = {
  'A+': 10, 'A': 9, 'B+': 8, 'B': 7,
  'C+': 6,  'C': 5, 'D':  4, 'F': 0, 'F(UMC)': 0,
};

// ── Python resolver ───────────────────────────────────────────────────────

function resolvePython() {
  if (process.env.PYTHON_PATH) return process.env.PYTHON_PATH;
  if (process.platform !== 'win32') return 'python3';

  const { execSync } = require('child_process');

  try {
    const lines = execSync('where.exe python', { encoding: 'utf8' })
      .split(/\r?\n/).map(s => s.trim()).filter(Boolean);
    const real = lines.find(p => !p.includes('WindowsApps'));
    if (real) return real;
  } catch (_) {}

  try {
    execSync('py -3 --version', { stdio: 'ignore' });
    return 'py';
  } catch (_) {}

  return 'python';
}

function buildChildEnv() {
  const env = { ...process.env };
  if (process.platform !== 'win32') return env;

  const { execSync } = require('child_process');
  try {
    const out = execSync(
      'where.exe pdftoppm 2>nul | findstr /v WindowsApps',
      { encoding: 'utf8', shell: true }
    );
    const popplerExe = out.split(/\r?\n/).map(s => s.trim()).filter(Boolean)[0];
    if (popplerExe) {
      env.PATH = path.dirname(popplerExe) + path.delimiter + (env.PATH || '');
    }
  } catch (_) {}

  return env;
}

// ── Grade helpers ─────────────────────────────────────────────────────────

/**
 * Normalize a raw OCR grade string to a valid grade.
 * Handles common handwriting OCR mistakes.
 */
function normalizeGrade(raw) {
  if (!raw) return '';
  let t = String(raw).trim().toUpperCase();

  // F(UMC) check first
  if (/UMC/i.test(t)) return 'F(UMC)';

  // Strip annotations
  t = t.replace(/\([^)]*\)/g, '').trim();
  // Remove internal spaces: "B +" -> "B+"
  t = t.replace(/^([ABC])\s+\+$/, '$1+').replace(/\s/g, '');

  // Explicit confusion map
  const MAP = {
    'R': 'B', '8': 'B', '2': 'B', '6': 'B',
    '0': 'D', 'Q': 'D',
    'AT': 'A+', 'BT': 'B+', 'CT': 'C+',
    'AF': 'A+', 'BF': 'B+', 'CF': 'C+',
    'ND': 'D', 'E': 'F',
  };
  if (MAP[t]) return MAP[t];

  // Direct match
  if (VALID_GRADES.includes(t)) return t;

  // Cursive t/f = +
  const cursive = t.match(/^([ABC])[TF]$/);
  if (cursive) return cursive[1] + '+';

  // Strip leading noise
  const stripped = t.replace(/^[^ABCDF(]+/, '');
  if (VALID_GRADES.includes(stripped)) return stripped;

  // Single letter
  if (stripped.length === 1 && 'ABCDF'.includes(stripped)) return stripped;

  // Letter + plus-like char
  if (stripped.length >= 2 && 'ABC'.includes(stripped[0]) && '+TF'.includes(stripped[1])) {
    return stripped[0] + '+';
  }

  // Take first valid letter
  if (stripped && 'ABCDF'.includes(stripped[0])) return stripped[0];

  return '';
}

function normalizeGradeWithConfidence(raw) {
  const grade = normalizeGrade(raw);
  if (!grade) return { grade: '', confidence: 0, matches: [] };
  const exact = VALID_GRADES.includes(String(raw).trim().toUpperCase());
  return { grade, confidence: exact ? 95 : 70, matches: [grade] };
}

// ── Python subprocess runner ──────────────────────────────────────────────

/**
 * Runs extractGradeCells.py on a PDF file path.
 * Returns Promise<Array<{sid, name, grade}>>
 */
function runPythonExtractor(pdfPath) {
  return new Promise((resolve, reject) => {
    const python = resolvePython();
    const args   = python === 'py' ? ['-3', EXTRACT_SCRIPT, pdfPath] : [EXTRACT_SCRIPT, pdfPath];
    const env    = buildChildEnv();

    const proc = spawn(python, args, { env });

    let stdout = '';
    let stderr = '';

    proc.stdout.on('data', chunk => { stdout += chunk.toString(); });
    proc.stderr.on('data', chunk => {
      stderr += chunk.toString();
      process.stdout.write(chunk.toString());
    });

    proc.on('error', err => {
      reject(new Error(`Failed to start Python: ${err.message}. Is Python installed?`));
    });

    proc.on('close', code => {
      if (code !== 0) {
        return reject(new Error(
          `extractGradeCells.py exited with code ${code}.\n${stderr.slice(-500)}`
        ));
      }

      const raw = stdout.trim();
      if (!raw) {
        return reject(new Error('extractGradeCells.py produced no output.'));
      }

      try {
        const parsed = JSON.parse(raw);

        if (parsed && parsed.error) {
          return reject(new Error(`Python error: ${parsed.error}`));
        }

        if (!Array.isArray(parsed)) {
          return reject(new Error(`Unexpected Python output type: ${typeof parsed}`));
        }

        resolve(parsed);
      } catch (err) {
        reject(new Error(
          `Failed to parse Python output as JSON: ${err.message}\nOutput: ${raw.slice(0, 200)}`
        ));
      }
    });
  });
}

// ── Main exported function ────────────────────────────────────────────────

/**
 * Parse a scanned/handwritten grade-list PDF.
 *
 * @param {Buffer} pdfBuffer - PDF file contents
 * @returns {Promise<Array>} rows compatible with your existing pipeline:
 *   { name, roll, grade, gradePoints, marks, source, ocrWarning }
 */
async function parseScannedGradePdf(pdfBuffer) {
  const tmpDir  = fs.mkdtempSync(path.join(os.tmpdir(), 'grade_ocr_'));
  const pdfPath = path.join(tmpDir, 'input.pdf');

  try {
    fs.writeFileSync(pdfPath, pdfBuffer);

    const rawRows = await runPythonExtractor(pdfPath);

    const seen = new Set();
    const rows = [];

    for (const raw of rawRows) {
      const sid   = String(raw.sid  || '').trim();
      const name  = String(raw.name || '').trim() || 'Unknown Student';
      const grade = normalizeGrade(raw.grade) || raw.grade || '';

      // FIX: relaxed SID length threshold from 7 to 5 to match Python change.
      if (!sid || sid.length < 5) continue;

      if (seen.has(sid)) continue;
      seen.add(sid);

      const gp = GRADE_POINTS[grade] ?? 0;

      rows.push({
        name,
        roll:        sid,
        grade,
        gradePoints: gp,
        marks: {
          'Grade Points': gp,
        },
        source:     'ocr',
        ocrWarning: grade ? '' : 'Grade could not be read from scanned PDF.',
      });
    }

    console.log(`[OCR] Parsed ${rows.length} students from scanned PDF.`);
    return rows;

  } finally {
    try { fs.rmSync(tmpDir, { recursive: true, force: true }); } catch (_) {}
  }
}

// ── Exports ───────────────────────────────────────────────────────────────

module.exports = {
  parseScannedGradePdf,
  normalizeGrade,
  normalizeGradeWithConfidence,
  VALID_GRADES,
  GRADE_POINTS,
  resolvePython,
  buildChildEnv,
};