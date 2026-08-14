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

// Cache whether canvas loaded successfully so we don't retry on every call.
let _canvasAvailable = null;
function canvasAvailable() {
  if (_canvasAvailable !== null) return _canvasAvailable;
  try {
    require('canvas');
    _canvasAvailable = true;
  } catch {
    _canvasAvailable = false;
  }
  return _canvasAvailable;
}

/**
 * Render PDF pages to JPEG images.
 *
 * Strategy (tried in order):
 *  1. canvas + pdfjs-dist  — pure-Node. pdfjs v3 requires a custom
 *                             NodeCanvasFactory injected explicitly.
 *                             Skipped if the `canvas` native module isn't built
 *                             (e.g. Render Node runtime without Cairo libs).
 *  2. Python pdf2image      — uses poppler-utils (installed via the Render build
 *                             command or the Dockerfile). Primary path on Render.
 */
async function renderPDFPagesToImages(buffer, { maxPages = 5, scale = 2.2 } = {}) {
  // ── Strategy 1: canvas + pdfjs (with explicit NodeCanvasFactory for v3) ──
  if (canvasAvailable()) {
    try {
      const { createCanvas } = require('canvas');
      const pdfjsLib = require('pdfjs-dist/legacy/build/pdf.js');
      pdfjsLib.verbosity = pdfjsLib.VerbosityLevel.ERRORS;

      // pdfjs-dist v3 removed the built-in NodeCanvasFactory — must be provided.
      class NodeCanvasFactory {
        create(width, height) {
          const canvas = createCanvas(width, height);
          return { canvas, context: canvas.getContext('2d') };
        }
        reset(canvasAndContext, width, height) {
          canvasAndContext.canvas.width = width;
          canvasAndContext.canvas.height = height;
        }
        destroy(canvasAndContext) {
          canvasAndContext.canvas.width = 0;
          canvasAndContext.canvas.height = 0;
        }
      }

      const canvasFactory = new NodeCanvasFactory();
      const loadingTask = pdfjsLib.getDocument({
        data: new Uint8Array(buffer),
        canvasFactory,
      });
      const doc = await loadingTask.promise;
      const pageCount = Math.min(doc.numPages, maxPages);
      const images = [];

      for (let i = 1; i <= pageCount; i++) {
        const page = await doc.getPage(i);
        const viewport = page.getViewport({ scale });
        const canvasAndCtx = canvasFactory.create(viewport.width, viewport.height);
        await page.render({
          canvasContext: canvasAndCtx.context,
          viewport,
          canvasFactory,
        }).promise;

        images.push({
          mimeType: 'image/jpeg',
          data: canvasAndCtx.canvas.toBuffer('image/jpeg', { quality: 0.92 }).toString('base64'),
        });
      }

      if (images.length > 0) return images;
      throw new Error('pdfjs rendered 0 pages');
    } catch (canvasErr) {
      console.warn('[pdfParser] canvas/pdfjs render failed, trying pdf2image fallback:', canvasErr.message);
    }
  }

  // ── Strategy 2: Python pdf2image (poppler) ──────────────────────────────
  return spawnPdf2Image(buffer, maxPages, Math.round(scale * 72));
}

function spawnPdf2Image(buffer, maxPages, dpi) {
  return new Promise((resolve, reject) => {
    const { spawn } = require('child_process');
    const path = require('path');
    const scriptPath = path.join(__dirname, '../scripts/renderPdfPages.py');

    const trySpawn = (cmd) => new Promise((res, rej) => {
      const py = spawn(cmd, [scriptPath, String(maxPages), String(dpi)]);
      let stdout = '', stderr = '';
      py.stdout.on('data', (d) => { stdout += d; });
      py.stderr.on('data', (d) => { stderr += d; });
      py.on('error', rej);
      py.on('close', () => {
        try {
          const result = JSON.parse(stdout);
          if (result.error) return rej(new Error(`pdf2image: ${result.error}`));
          const pages = Array.isArray(result.pages) ? result.pages : [];
          if (pages.length === 0) return rej(new Error('pdf2image returned 0 pages'));
          res(pages.map((data) => ({ mimeType: 'image/jpeg', data })));
        } catch (e) {
          rej(new Error(`pdf2image parse error: ${e.message}. stderr: ${stderr.slice(0, 300)}`));
        }
      });
      py.stdin.write(buffer);
      py.stdin.end();
    });

    // Try python3 first, fall back to python
    trySpawn('python3')
      .then(resolve)
      .catch(() => trySpawn('python').then(resolve).catch(reject));
  });
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
