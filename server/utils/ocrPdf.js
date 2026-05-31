const { spawn } = require('child_process');
const path = require('path');
const { resolvePython, childEnv } = require('../services/ocrGradePdfParser');

function ocrPdf(filePath) {
  return new Promise((resolve, reject) => {
    const scriptPath = path.join(__dirname, '../scripts/extractGradeCells.py');
    const proc = spawn(resolvePython(), [scriptPath, filePath], { env: childEnv() });
    let stdout = '';
    let stderr = '';
    proc.stdout.on('data', d => stdout += d.toString());
    proc.stderr.on('data', d => {
      stderr += d.toString();
      process.stdout.write(d.toString());
    });
    proc.on('close', code => {
      try {
        const result = JSON.parse(stdout);
        if (result.error) return reject(new Error(result.error));
        const rows = Array.isArray(result) ? result : (result.rows || []);
        resolve(rows);
      } catch (e) {
        reject(new Error(`Python failed: ${stderr}`));
      }
    });
    proc.on('error', err => reject(new Error(`Spawn failed: ${err.message}`)));
  });
}

module.exports = { ocrPdf };
