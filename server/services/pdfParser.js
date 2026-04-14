const pdfParse = require('pdf-parse');

/**
 * Extracts text from a PDF buffer.
 * Returns raw string.
 */
async function extractTextFromPDF(buffer) {
  const data = await pdfParse(buffer);
  return data.text;
}

/**
 * Parses raw text into array of { name, roll, marks, subject }
 * Handles common formats:
 *   "John Doe  101  85"
 *   "1. John Doe - 85"
 *   "Roll: 101 | Name: John | Marks: 85"
 */
function parseStudentMarks(rawText) {
  const lines = rawText
    .split('\n')
    .map(l => l.trim())
    .filter(l => l.length > 2);

  const results = [];
  let currentSubject = null;

  for (const line of lines) {
    // Detect subject header lines like "Subject: Mathematics" or "## Physics"
    const subjectMatch = line.match(/^(?:subject|paper|course)\s*[:\-–]?\s*(.+)/i);
    if (subjectMatch) {
      currentSubject = subjectMatch[1].trim();
      continue;
    }

    // Skip pure header rows
    if (/^(s\.?no|rank|roll|name|marks|total|sr)/i.test(line)) continue;

    // Try to extract: optional rank/sno, name, optional roll, marks
    // Pattern: anything with a number at the end (marks)
    const pattern = /^(?:\d+[\.\)]\s*)?([A-Za-z][A-Za-z\s\.\-']{2,40?})\s+(\d{2,6})?\s*(\d{1,3}(?:\.\d{1,2})?)$/;
    const match = line.match(pattern);

    if (match) {
      const name  = match[1].trim();
      const roll  = match[2] || null;
      const marks = parseFloat(match[3]);

      if (!isNaN(marks) && marks >= 0 && marks <= 1000) {
        results.push({ name, roll, marks, subject: currentSubject });
      }
      continue;
    }

    // Fallback: pipe or comma separated
    const parts = line.split(/[|,\t]/).map(p => p.trim());
    if (parts.length >= 2) {
      const lastPart = parts[parts.length - 1];
      const marks = parseFloat(lastPart);
      if (!isNaN(marks) && marks >= 0 && marks <= 1000) {
        const name = parts[0].replace(/^\d+[\.\)]\s*/, '').trim();
        const roll = parts.length >= 3 ? parts[1] : null;
        if (name.length >= 2) {
          results.push({ name, roll, marks, subject: currentSubject });
        }
      }
    }
  }

  return results;
}

module.exports = { extractTextFromPDF, parseStudentMarks };