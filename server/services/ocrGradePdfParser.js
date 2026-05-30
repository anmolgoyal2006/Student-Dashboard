const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawn } = require('child_process');
require('dotenv').config({ path: path.join(__dirname, '../.env') });
const { createWorker, PSM } = require('tesseract.js');

const EXTRACT_SCRIPT = path.join(__dirname, '../scripts/extractGradeCells.py');
const GROQ_GRADE_SCRIPT = path.join(__dirname, '../scripts/readGradesWithGroq.py');
const VALID_GRADES = ['A+', 'A', 'B+', 'B', 'C+', 'C', 'D', 'F'];
const VALID_GRADES_SET = new Set(VALID_GRADES);

function readGradesWithGroq(imagePaths) {
  return new Promise((resolve) => {
    const pythonBin = process.platform === 'win32' ? 'python' : 'python3';
   const proc = spawn(pythonBin, [GROQ_GRADE_SCRIPT], { env: { ...process.env } });
    let stdout = '';
    proc.stdout.on('data', (chunk) => { stdout += chunk.toString(); });
    proc.stderr.on('data', (chunk) => { console.error('[Groq Grade]', chunk.toString()); });
    proc.on('close', () => {
      try {
        const result = JSON.parse(stdout.trim() || '{}');
        resolve(result.grades || imagePaths.map(() => ''));
      } catch {
        resolve(imagePaths.map(() => ''));
      }
    });
    proc.on('error', () => resolve(imagePaths.map(() => '')));
    proc.stdin.write(JSON.stringify({ images: imagePaths }));
    proc.stdin.end();
  });
}

function cleanup(dir) {
  try {
    fs.rmSync(dir, { recursive: true, force: true });
  } catch (_) {}
}

function runCellExtractor(pdfPath, outputDir) {
  return new Promise((resolve, reject) => {
    const pythonBin = process.platform === 'win32' ? 'python' : 'python3';
    const proc = spawn(pythonBin, [EXTRACT_SCRIPT, pdfPath, outputDir]);
    let stdout = '';
    let stderr = '';

    proc.stdout.on('data', (chunk) => { stdout += chunk.toString(); });
    proc.stderr.on('data', (chunk) => { stderr += chunk.toString(); });
    proc.on('close', (code) => {
      if (code !== 0) {
        return reject(new Error(stderr || `OCR cell extraction failed with exit ${code}.`));
      }
      try {
        const parsed = JSON.parse(stdout.trim() || '[]');
        if (parsed?.error) return reject(new Error(parsed.error));
        resolve(parsed);
      } catch (err) {
        reject(new Error(`Could not parse OCR cell extraction output: ${err.message}`));
      }
    });
    proc.on('error', reject);
  });
}

function cleanText(text) {
  return String(text || '')
    .replace(/[|_—~]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function levenshtein(a, b) {
  const m = a.length, n = b.length;
  const dp = Array.from({ length: m + 1 }, () => Array(n + 1).fill(0));
  for (let i = 0; i <= m; i++) dp[i][0] = i;
  for (let j = 0; j <= n; j++) dp[0][j] = j;
  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      dp[i][j] = a[i - 1] === b[j - 1]
        ? dp[i - 1][j - 1]
        : 1 + Math.min(dp[i - 1][j], dp[i][j - 1], dp[i - 1][j - 1]);
    }
  }
  return dp[m][n];
}

function fuzzyMatchGrade(text) {
  let raw = String(text || '').toUpperCase().replace(/\s+/g, '');
  if (!raw) return { grade: '', confidence: 0, matches: [] };

  // Strip annotations like (UMC), (I), etc.
  raw = raw.replace(/\([^)]*\)/g, '').replace(/\[[^\]]*\]/g, '').trim();

  // Cursive "t" at end means "+"
  raw = raw.replace(/^([ABC])T$/, '$1+');

  // Common OCR confusions
  raw = raw
    .replace(/^APLUS$/, 'A+')
    .replace(/^BPLUS$/, 'B+')
    .replace(/^CPLUS$/, 'C+')
    .replace(/^A\+?PLUS$/, 'A+')
    .replace(/^([ABC])\+\+$/, '$1+')
    .replace(/^([ABCDF])[)\]|]+$/, '$1')
    .replace(/^[)\]|]+([ABCDF])$/, '$1');

  const candidates = [];
  for (const grade of VALID_GRADES) {
    const stripped = grade.replace('+', '');
    const dist = levenshtein(raw, grade);
    const distStripped = levenshtein(raw, stripped);
    const bestDist = Math.min(dist, distStripped);
    const maxLen = Math.max(raw.length, grade.length);
    const similarity = maxLen > 0 ? 1 - bestDist / maxLen : 0;
    candidates.push({ grade, distance: bestDist, similarity });
  }

  candidates.sort((a, b) => b.similarity - a.similarity);
  const best = candidates[0];

  return {
    grade: best.similarity > 0.35 ? best.grade : '',
    confidence: Math.round(best.similarity * 100),
    matches: candidates.filter(c => c.similarity > 0.2).map(c => c.grade),
  };
}

function normalizeGrade(text) {
  const result = fuzzyMatchGrade(text);
  return result.grade;
}

function normalizeGradeWithConfidence(text) {
  return fuzzyMatchGrade(text);
}

function extractSid(text) {
  return cleanText(text).match(/\b\d{5,12}\b/)?.[0] || '';
}

function extractSidFuzzy(text) {
  const cleaned = cleanText(text);
  const strict = cleaned.match(/\b\d{5,12}\b/)?.[0];
  if (strict) return strict;
  const digitsOnly = cleaned
    .replace(/[OoD]/g, '0')
    .replace(/[IilL]/g, '1')
    .replace(/[Ss]/g, '5')
    .replace(/[Bb]/g, '8');
  const digitMatch = digitsOnly.match(/\b\d{4,12}\b/);
  return digitMatch ? digitMatch[0] : '';
}

function extractUnits(text) {
  const match = cleanText(text).match(/\d+(?:\.\d+)?/);
  return match ? Number(match[0]) : '';
}

function cleanName(text) {
  const value = cleanText(text)
    .replace(/[^a-zA-Z .'-]/g, ' ')
    .replace(/\b(Student|Name|Units|Grade|SID|Sr|No)\b/gi, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  return value.length >= 2 ? value.replace(/\s+[a-zA-Z]$/, '').trim() : '';
}

function confidenceLevel(score) {
  if (score >= 80) return 'high';
  if (score >= 50) return 'medium';
  return 'low';
}

function repairSid(sid, pagePrefix) {
  if (!sid) return '';
  if (/^\d{8,12}$/.test(sid)) return sid;
  if (/^\d{5,7}$/.test(sid) && pagePrefix) return `${pagePrefix}${sid}`;
  return sid;
}

function extractGradeFromLine(line) {
  if (!line) return '';
  const afterUnits = String(line).match(/\b4\b\s+(.+)$/);
  return normalizeGrade(afterUnits ? afterUnits[1] : line);
}

function parseFullPageOcr(text) {
  const map = new Map();
  for (const rawLine of String(text || '').split(/\r?\n/)) {
    const line = cleanText(rawLine);
    const sid = extractSid(line);
    if (!sid) continue;
    const grade = extractGradeFromLine(line);
    if (grade) map.set(sid, grade);
  }
  return map;
}

function parseFullPageRows(text) {
  const map = new Map();
  for (const rawLine of String(text || '').split(/\r?\n/)) {
    const line = cleanText(rawLine);
    const sid = extractSid(line);
    if (!sid) continue;

    const afterSid = line.slice(line.indexOf(sid) + sid.length);
    const beforeUnits = afterSid.split(/\b4\b/)[0] || afterSid;
    const name = cleanName(beforeUnits);
    const grade = extractGradeFromLine(line);

    map.set(sid, { name, grade });
  }
  return map;
}

async function recognizeCell(worker, filePath, mode = PSM.SINGLE_LINE, whitelist = '') {
  if (!filePath || !fs.existsSync(filePath)) return { text: '', confidence: 0 };
  const params = { tessedit_pageseg_mode: mode };
  if (whitelist) params.tessedit_char_whitelist = whitelist;
  await worker.setParameters(params);
  const result = await worker.recognize(filePath);
  const text = result.data.text || '';
  const confidence = result.data.confidence || 0;
  return { text, confidence };
}

async function parseScannedGradePdf(buffer) {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'grade_ocr_'));
  const pdfPath = path.join(tmpDir, 'input.pdf');
  const cellDir = path.join(tmpDir, 'cells');
  fs.writeFileSync(pdfPath, buffer);

  let worker;
  try {
    const pages = await runCellExtractor(pdfPath, cellDir);
    worker = await createWorker('eng');
    const rows = [];
    const seen = new Set();

    for (const page of pages) {
      let pagePrefix = '';
      let lastSidNumber = 0;
      let pageGradeMap = new Map();
      let pageTextRows = new Map();
      if (page.pageImage) {
        const fullPageResult = await recognizeCell(worker, page.pageImage, PSM.AUTO);
        const fullPageText = fullPageResult.text;
        pageGradeMap = parseFullPageOcr(fullPageText);
        pageTextRows = parseFullPageRows(fullPageText);
      }
      for (let rowIdx = 0; rowIdx < (page.rows || []).length; rowIdx++) {
        const row = page.rows[rowIdx];
        const sidResult = await recognizeCell(worker, row.sid, PSM.SINGLE_LINE, '0123456789');
        let sid = extractSid(sidResult.text);
        if (!sid) {
          const sidNoWhitelist = await recognizeCell(worker, row.sid, PSM.SINGLE_LINE, '');
          sid = extractSidFuzzy(sidNoWhitelist.text);
        }
        const nameResult = await recognizeCell(
          worker,
          row.name,
          PSM.SINGLE_LINE,
          'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz .-'
        );
        const unitsResult = await recognizeCell(worker, row.units, PSM.SINGLE_LINE, '0123456789.');
        const gradeResult = await recognizeCell(worker, row.grade, PSM.SINGLE_LINE, 'ABCDF+abcdf');

        let name = cleanName(nameResult.text);
        sid = repairSid(sid, pagePrefix);
        if (!sid && lastSidNumber && String(lastSidNumber).startsWith('241') && name) {
          sid = String(lastSidNumber + 1);
        }
        if (!sid) {
          sid = name
            ? `ocr_${page.page}_${rowIdx}_${name.replace(/\s+/g, '_').toLowerCase().slice(0, 20)}`
            : `ocr_${page.page}_${rowIdx}`;
        }
        if (seen.has(sid)) continue;
        if (/^\d{8}$/.test(sid)) {
          pagePrefix = sid.slice(0, 3);
          lastSidNumber = Number(sid);
        }

        const gradeWithConfidence = normalizeGradeWithConfidence(gradeResult.text);
        const grade = gradeWithConfidence.grade;
        const ocrConfidence = gradeWithConfidence.confidence;
        const units = extractUnits(unitsResult.text);
        const pageTextRow = pageTextRows.get(sid) || {};
        if (!name && pageTextRow.name) name = pageTextRow.name;
        const gradeFromPage = pageTextRow.grade || pageGradeMap.get(sid) || '';
        const finalGrade = gradeFromPage || grade;
        const displayName = name || 'Unknown Student';
        seen.add(sid);

        let sidImage = '';
        let gradeImage = '';
        try {
          if (row.sid && fs.existsSync(row.sid)) {
            sidImage = 'data:image/png;base64,' + fs.readFileSync(row.sid).toString('base64');
          }
          if (row.grade && fs.existsSync(row.grade)) {
            gradeImage = 'data:image/png;base64,' + fs.readFileSync(row.grade).toString('base64');
          }
        } catch (err) {
          console.error('[OCR Parser] Failed to read cell images:', err);
        }

        const rowConfidence = Math.round(
          (sidResult.confidence + nameResult.confidence + gradeResult.confidence) / 3
        );

        rows.push({
          name: displayName,
          roll: sid,
          grade: finalGrade,
          sidImage,
          gradeImage,
          gradeCellPath: row.grade || '',
          ocrGradeRaw: gradeResult.text.trim(),
          ocrConfidence,
          ocrConfidenceLevel: confidenceLevel(ocrConfidence),
          overallConfidence: rowConfidence,
          marks: {
            Units: units || 4,
            Grade: finalGrade,
          },
          ocrWarning: finalGrade ? '' : 'Grade could not be read confidently from scanned PDF.',
          source: 'ocr',
        });
      }

      for (const [sid, row] of pageTextRows.entries()) {
        if (seen.has(sid)) continue;
        seen.add(sid);
        rows.push({
          name: row.name || 'Unknown Student',
          roll: sid,
          grade: row.grade || '',
          sidImage: '',
          gradeImage: '',
          gradeCellPath: '',
          ocrGradeRaw: '',
          ocrConfidence: 0,
          ocrConfidenceLevel: 'low',
          overallConfidence: 0,
          marks: {
            Units: 4,
            Grade: row.grade || '',
          },
          ocrWarning: row.grade ? '' : 'Grade could not be read confidently from scanned PDF.',
          source: 'ocr',
        });
      }
    }

    // ── Groq vision pass: correct all grades ──
    try {
      const gradePaths = rows.map((r) => r.gradeCellPath || '');
      const hasImages = gradePaths.some((p) => p && fs.existsSync(p));
      if (hasImages) {
        console.error('[OCR] Running Groq vision grade correction...');
        const correctedGrades = await readGradesWithGroq(gradePaths);
        correctedGrades.forEach((g, idx) => {
          if (g && VALID_GRADES_SET.has(g)) {
            rows[idx].grade = g;
            rows[idx].marks = { ...rows[idx].marks, Grade: g };
            rows[idx].ocrConfidence = 95;
            rows[idx].ocrConfidenceLevel = 'high';
          }
        });
        console.error(`[OCR] Groq corrected ${correctedGrades.filter(g => g).length}/${rows.length} grades`);
      }
    } catch (err) {
      console.error('[OCR] Groq vision pass failed:', err.message);
    }

    return rows;
  } finally {
    if (worker) await worker.terminate();
    cleanup(tmpDir);
  }
}

module.exports = {
  parseScannedGradePdf,
  normalizeGrade,
  normalizeGradeWithConfidence,
  fuzzyMatchGrade,
  VALID_GRADES,
};