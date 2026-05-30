const Groq = require('groq-sdk');
const { fuzzyMatchGrade, VALID_GRADES } = require('./ocrGradePdfParser');

const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });

function buildCorrectionPrompt(students) {
  const entries = students.map((s, i) =>
    `  ${i + 1}. Name: "${s.name}", Roll: "${s.roll}", OCR Raw Text: "${s.ocrGradeRaw || ''}", Current Grade: "${s.grade || '?'}", Confidence: ${s.ocrConfidence || 0}%`
  ).join('\n');

  return `You are a grade correction AI. Given OCR-extracted handwritten grades from a scanned PDF, correct any misread grades.

Rules:
- Valid grades: ${VALID_GRADES.join(', ')}
- Use fuzzy matching logic: 'R' or 'RB' → B, 'APLUS' → A+, 'GR' → B, 'AC' or 'AC' → A+, 'c' → C, 'F+' → F, etc.
- If OCR text is empty or confidence is very low, suggest the most likely grade based on context
- Output ONLY a JSON array, no markdown, no explanation:
[{ "index": 0, "correctedGrade": "A+", "reason": "OCR read 'APLUS' which maps to A+" }]

Students to correct:
${entries}`;
}

async function aiCorrectGrades(students) {
  if (!students || !students.length) return [];

  const prompt = buildCorrectionPrompt(students);

  try {
    const completion = await groq.chat.completions.create({
      model: 'llama-3.1-8b-instant',
      messages: [
        { role: 'system', content: 'You are a precise grade correction AI. Output only JSON.' },
        { role: 'user', content: prompt },
      ],
      temperature: 0.1,
      max_tokens: 2000,
    });

    const raw = completion.choices?.[0]?.message?.content || '[]';
    const cleaned = raw.replace(/```json\s*/gi, '').replace(/```\s*/gi, '').trim();
    const corrections = JSON.parse(cleaned);

    if (!Array.isArray(corrections)) return [];

    return corrections.map((c) => {
      const fuzzy = fuzzyMatchGrade(c.correctedGrade || '');
      return {
        index: c.index,
        correctedGrade: fuzzy.grade || c.correctedGrade || '',
        reason: c.reason || '',
      };
    }).filter((c) => c.correctedGrade);
  } catch (err) {
    console.error('[AI OCR Correction] Error:', err.message);
    return [];
  }
}

async function aiCorrectSingleStudent(name, roll, ocrRawText, currentGrade, confidence) {
  const [result] = await aiCorrectGrades([{
    name, roll, ocrGradeRaw: ocrRawText, grade: currentGrade, ocrConfidence: confidence,
  }]);
  return result || null;
}

module.exports = { aiCorrectGrades, aiCorrectSingleStudent };