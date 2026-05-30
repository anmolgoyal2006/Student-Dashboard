const fs = require('fs');
const { parseScannedGradePdf } = require('./server/services/ocrGradePdfParser');

(async () => {
  const pdfBuffer = fs.readFileSync('test.pdf');
  const result = await parseScannedGradePdf(pdfBuffer);
  const summary = {
    total: result.length,
    withRealRoll: result.filter(s => s.roll && !s.roll.startsWith('ocr_')).length,
    withSynthetic: result.filter(s => s.roll && s.roll.startsWith('ocr_')).length,
    withGrade: result.filter(s => s.grade).length,
    uniqueRolls: new Set(result.map(r => r.roll)).size,
  };
  console.log(JSON.stringify(summary, null, 2));
})().catch(e => {
  console.error(e.message);
  process.exit(1);
});
