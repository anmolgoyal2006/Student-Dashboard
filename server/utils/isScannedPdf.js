const pdfParse = require('pdf-parse');
const fs = require('fs');

async function isScannedPdf(filePath) {
  try {
    const buffer = fs.readFileSync(filePath);
    const data = await pdfParse(buffer);
    const meaningfulChars = (data.text || '').replace(/\s+/g, '').length;
    return meaningfulChars < 50;
  } catch (err) {
    return true;
  }
}
module.exports = { isScannedPdf };
