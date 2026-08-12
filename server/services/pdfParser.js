// Heavy PDF/canvas dependencies are loaded lazily (inside the functions that
// need them) rather than at module-load time. This prevents Jest from hanging
// when this module is required in tests — pdfjs-dist/legacy spins up internal
// workers that never terminate inside the Node test runner.

// Suppress PDF.js warning logs (like "Warning: TT: undefined function: 21")
const originalLog = console.log;
console.log = function (...args) {
  if (typeof args[0] === 'string' && (args[0].startsWith('Warning:') || args[0].startsWith('Warning: TT:'))) {
    return;
  }
  originalLog.apply(console, args);
};

const originalWarn = console.warn;
console.warn = function (...args) {
  if (typeof args[0] === 'string' && (args[0].startsWith('Warning:') || args[0].startsWith('Warning: TT:'))) {
    return;
  }
  originalWarn.apply(console, args);
};

async function extractTextFromPDF(buffer) {
  const pdfParse = require('pdf-parse');
  const data = await pdfParse(buffer);
  return data.text;
}

async function renderPDFPagesToImages(buffer, { maxPages = 5, scale = 2.2 } = {}) {
  const { createCanvas } = require('canvas');
  const pdfjsLib = require('pdfjs-dist/legacy/build/pdf.js');
  pdfjsLib.verbosity = pdfjsLib.VerbosityLevel.ERRORS;

  const loadingTask = pdfjsLib.getDocument({ data: new Uint8Array(buffer) });
  const doc = await loadingTask.promise;
  const pageCount = Math.min(doc.numPages, maxPages);
  const images = [];

  for (let i = 1; i <= pageCount; i++) {
    const page = await doc.getPage(i);
    const viewport = page.getViewport({ scale });
    const canvas = createCanvas(viewport.width, viewport.height);
    const context = canvas.getContext('2d');
    await page.render({ canvasContext: context, viewport }).promise;

    images.push({
      mimeType: 'image/jpeg',
      data: canvas.toBuffer('image/jpeg', { quality: 0.92 }).toString('base64'),
    });
  }
  return images;
}

function parseStudentMarks(rawText) {
  const lines = rawText
    .split('\n')
    .map(l => l.trim())
    .filter(l => l.length > 2);

  const results = [];
  let currentSubject = null;

  for (const line of lines) {
    const subjectMatch = line.match(/^(?:subject|paper|course)\s*[:\-–]?\s*(.+)/i);
    if (subjectMatch) {
      currentSubject = subjectMatch[1].trim();
      continue;
    }

    if (/^(s\.?no|rank|roll|name|marks|total|sr)/i.test(line)) continue;

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

module.exports = { extractTextFromPDF, renderPDFPagesToImages, parseStudentMarks };
