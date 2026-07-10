const fs = require('fs');
const { normalizeGrade, VALID_GRADES } = require('./ocrGradePdfParser');
const { generateContentWithInlineData, generateContent, NANO_MODEL } = require('./aiService');

// ── Vision: read a single grade cell image directly ──────────────────────────
async function readGradeCellImage(imagePath) {
  if (!imagePath || !fs.existsSync(imagePath)) return null;

  try {
    const imageData = fs.readFileSync(imagePath).toString('base64');
    const mimeType = imagePath.toLowerCase().endsWith('.png') ? 'image/png' : 'image/jpeg';

    const raw = await generateContentWithInlineData([
      { inlineData: { mimeType, data: imageData } },
      { text: `This is a cropped cell from a handwritten university grade sheet.
The cell contains exactly ONE handwritten letter grade.
Valid grades are ONLY: A+, A, B+, B, C+, C, D, F

Rules:
- "+" is often written as "t" or "f" in cursive (e.g. "Bt" = B+, "Ct" = C+, "At" = A+, "Cf" = C+)  
- Ignore any annotations in parentheses like (UMC), (I), (W) — just extract the base grade
- If the cell looks empty or unreadable, output: ?
- Output ONLY the grade, nothing else. Examples: A+ or B or C+ or F` },
    ], { model: NANO_MODEL, temperature: 0, maxOutputTokens: 10 });

    return raw;
  } catch (err) {
    console.error('[Vision] readGradeCellImage error:', err.message);
    return null;
  }
}

// ── Batch vision: read multiple grade cells in parallel (with concurrency cap) ──
async function readGradeCellsBatch(students, concurrency = 5) {
  const results = new Array(students.length).fill(null);
  const queue = students.map((s, i) => ({ s, i }));

  async function worker() {
    while (queue.length) {
      const { s, i } = queue.shift();
      if (!s.gradeCellPath) continue;
      try {
        const raw = await readGradeCellImage(s.gradeCellPath);
        results[i] = raw;
      } catch (err) {
        console.error(`[Vision] Failed for student ${s.roll}:`, err.message);
      }
    }
  }

  const workers = Array.from({ length: concurrency }, () => worker());
  await Promise.all(workers);
  return results;
}

// ── Post-process raw vision output into a valid grade ────────────────────────
function parseVisionGrade(raw) {
  if (!raw || raw === '?') return { grade: '', confidence: 0 };

  let text = String(raw).toUpperCase().trim();

  // Strip annotations
  text = text.replace(/\([^)]*\)/g, '').replace(/\[[^\]]*\]/g, '').trim();

  // Cursive "t" or "f" at end = "+"
  text = text.replace(/^([ABC])[TF]$/, '$1+');

  // Direct match
  if (VALID_GRADES.includes(text)) return { grade: text, confidence: 95 };

  const grade = normalizeGrade(text);
  if (grade) return { grade, confidence: 70 };

  return { grade: '', confidence: 0 };
}

// ── Main: AI-correct grades using vision on cell images ──────────────────────
async function aiCorrectGrades(students) {
  if (!students || !students.length) return [];

  // Separate students that have a grade cell image vs those that don't
  const withImage = [];
  const withoutImage = [];

  students.forEach((s, i) => {
    if (s.gradeCellPath && fs.existsSync(s.gradeCellPath)) {
      withImage.push({ ...s, _originalIndex: i });
    } else {
      withoutImage.push({ ...s, _originalIndex: i });
    }
  });

  const corrections = [];

  // ── Vision path: students with cell images ──
  if (withImage.length) {
    const rawResults = await readGradeCellsBatch(withImage, 5);
    rawResults.forEach((raw, idx) => {
      const student = withImage[idx];
      const { grade, confidence } = parseVisionGrade(raw);
      if (grade) {
        corrections.push({
          index: student._originalIndex,
          correctedGrade: grade,
          confidence,
          reason: `Vision model read "${raw}" → ${grade}`,
          method: 'vision',
        });
      }
    });
  }

  // ── Text fallback: students without images ──
  if (withoutImage.length) {
    const textCorrections = await aiCorrectGradesFromText(withoutImage);
    textCorrections.forEach((c) => {
      corrections.push({
        ...c,
        index: withoutImage[c.index]?._originalIndex ?? c.index,
        method: 'text',
      });
    });
  }

  return corrections.filter((c) => c.correctedGrade);
}

// ── Text-only fallback (original Groq text approach) ────────────────────────
function buildCorrectionPrompt(students) {
  // Matched back to students purely by array index (see aiCorrectGradesFromText below) —
  // name/roll are never needed by the model for a grade-symbol classification task,
  // so they're deliberately omitted to avoid sending student PII to a third-party API.
  const entries = students.map((s, i) =>
    `  ${i + 1}. OCR Raw: "${s.ocrGradeRaw || ''}", Current: "${s.grade || '?'}", Confidence: ${s.ocrConfidence || 0}%`
  ).join('\n');

  return `You are a grade correction AI for a university grade sheet.
Valid grades ONLY: ${VALID_GRADES.join(', ')}

Cursive handwriting rules:
- "Bt" or "Bf" = B+
- "Ct" or "Cf" = C+  
- "At" or "Af" = A+
- "Ba", "a", "Aa" context clues — use the letter before any suffix
- "dd", "dD" = D
- "Fc", "Fa", "Fe" = F (letter after F is noise)
- Strip anything in parentheses: "F(UMC)" = F

Output ONLY a JSON array, no markdown:
[{ "index": 0, "correctedGrade": "B+", "reason": "OCR Bt = B+" }]

Students:
${entries}`;
}

const sleep = (ms) => new Promise((res) => setTimeout(res, ms));

async function aiCorrectGradesFromText(students) {
  if (!students.length) return [];

  const CHUNK_SIZE = 20;
  const allCorrections = [];

  for (let i = 0; i < students.length; i += CHUNK_SIZE) {
    const chunk = students.slice(i, i + CHUNK_SIZE);

    try {
      const raw = await generateContent([
        { role: 'user', parts: [{ text: 'You are a precise grade correction AI. Output only JSON.' }] },
        { role: 'user', parts: [{ text: buildCorrectionPrompt(chunk) }] },
      ], { model: NANO_MODEL, temperature: 0.1, maxOutputTokens: 800 });

      const cleaned = (raw || '[]').replace(/```json\s*/gi, '').replace(/```\s*/gi, '').trim();
      const result = JSON.parse(cleaned);
      if (!Array.isArray(result)) continue;

      result.forEach((c) => {
        const grade = normalizeGrade(c.correctedGrade || '') || c.correctedGrade || '';
        if (grade) {
          allCorrections.push({
            index: i + c.index,  // offset by chunk start
            correctedGrade: grade,
            reason: c.reason || '',
          });
        }
      });
    } catch (err) {
      console.error(`[AI Text Correction] Chunk ${i}-${i + CHUNK_SIZE} error:`, err.message);
    }

    // Small delay between chunks to avoid TPM rate limit
    if (i + CHUNK_SIZE < students.length) await sleep(1500);
  }

  return allCorrections;
}
async function aiCorrectSingleStudent(name, roll, ocrRawText, currentGrade, confidence, gradeCellPath) {
  const [result] = await aiCorrectGrades([{
    name, roll, ocrGradeRaw: ocrRawText, grade: currentGrade,
    ocrConfidence: confidence, gradeCellPath,
  }]);
  return result || null;
}

module.exports = { aiCorrectGrades, aiCorrectSingleStudent };