const fs = require('fs');
const path = require('path');
const os = require('os');
const { spawn, execSync } = require('child_process');

const PDF_PATH = path.resolve('CTN401_Grade_list.pdf');
const TEMP_DEBUG = path.join(os.tmpdir(), 'grade_debug');
const OUT_DIR = path.join(__dirname, '..', 'public', 'debug');

function resolvePython() {
  if (process.env.PYTHON_PATH) return process.env.PYTHON_PATH;
  if (process.platform !== 'win32') return 'python3';
  try {
    const paths = execSync('where.exe python', { encoding: 'utf8' })
      .split(/\r?\n/).map(s => s.trim()).filter(Boolean);
    const real = paths.find(p => !p.includes('WindowsApps'));
    if (real) return real;
  } catch (_) {}
  return 'python';
}

function childEnv() {
  const env = { ...process.env };
  if (process.platform !== 'win32') return env;
  // Add known tool paths
  const extra = [
    // Tesseract
    'C:\\Program Files\\Tesseract-OCR',
    // Poppler (winget)
    path.join(os.homedir(), 'AppData', 'Local', 'Microsoft', 'WinGet', 'Packages',
      'oschwartz10612.Poppler_Microsoft.Winget.Source_8wekyb3d8bbwe',
      'poppler-25.07.0', 'Library', 'bin')
  ];
  for (const p of extra) {
    if (fs.existsSync(p)) {
      env.PATH = p + path.delimiter + (env.PATH || '');
    }
  }
  try {
    const popplerDir = execSync(
      'where.exe pdftoppm 2>nul | findstr /v WindowsApps',
      { encoding: 'utf8', shell: true }
    ).split(/\r?\n/).map(s => s.trim()).filter(Boolean)[0];
    if (popplerDir) {
      env.PATH = path.dirname(popplerDir) + path.delimiter + (env.PATH || '');
    }
  } catch (_) {}
  return env;
}

function cropGradeCells() {
  return new Promise((resolve, reject) => {
    // Python snippet: use Tesseract bounding boxes to find student SID lines, crop grade area
    const code = `
import sys, os, json, cv2, numpy as np, re
import pytesseract
from pdf2image import convert_from_path

pdf = '${PDF_PATH.replace(/\\/g, '/')}'
debug_dir = '${TEMP_DEBUG.replace(/\\/g, '/')}'
os.makedirs(debug_dir, exist_ok=True)

images = convert_from_path(pdf, dpi=200, fmt='jpeg')
sid_pat = re.compile(r'\\b(\\d{7,12})\\b')
page_rows_total = {}

for page_idx, pil in enumerate(images, 1):
    bgr = np.array(pil)
    gray = cv2.cvtColor(bgr, cv2.COLOR_RGB2GRAY)
    h, w = gray.shape

    # Get word-level bounding boxes
    data = pytesseract.image_to_data(gray, output_type=pytesseract.Output.DICT, config='--psm 4 --oem 3')

    # Find lines with SIDs — collect their Y ranges
    lines = {}
    for i in range(len(data['text'])):
        txt = (data['text'][i] or '').strip()
        if sid_pat.search(txt):
            block = data['block_num'][i]
            line = data['line_num'][i]
            key = (data['page_num'][i], block, line)
            if key not in lines:
                lines[key] = { 'y_top': data['top'][i], 'y_bot': data['top'][i] + data['height'][i], 'sid': '' }
            else:
                lines[key]['y_top'] = min(lines[key]['y_top'], data['top'][i])
                lines[key]['y_bot'] = max(lines[key]['y_bot'], data['top'][i] + data['height'][i])
            lines[key]['sid'] = txt

    # Sort lines by Y
    sorted_lines = sorted(lines.values(), key=lambda x: x['y_top'])
    page_rows_total[page_idx] = []

    for row_idx, ln in enumerate(sorted_lines):
        y1 = max(0, ln['y_top'] - 4)
        y2 = min(h, ln['y_bot'] + 4)
        sid = ln['sid']

        # Grade area: right 20% of page, centered on this line
        gx1 = int(w * 0.78)
        gx2 = min(w, int(w * 0.96) + 40)
        cell = gray[y1:y2, gx1:gx2]
        fname = f'p{page_idx}_r{row_idx}_grade.png'
        cv2.imwrite(os.path.join(debug_dir, fname), cell)
        page_rows_total[page_idx].append(row_idx)

print(json.dumps(page_rows_total))
`.trim();

    const pyBin = resolvePython();
    const proc = spawn(pyBin, ['-c', code], { env: childEnv(), cwd: path.resolve('.') });
    let stdout = '', stderr = '';
    proc.stdout.on('data', d => stdout += d);
    proc.stderr.on('data', d => stderr += d);
    proc.on('close', code => {
      if (code !== 0) return reject(new Error(stderr));
      try { resolve(JSON.parse(stdout)); } catch (e) { reject(new Error('Parse failed: ' + stdout.slice(0,500))); }
    });
    proc.on('error', reject);
  });
}

async function main() {
  console.log('Cropping grade cells using Tesseract bounding boxes...');
  const pageRows = await cropGradeCells();
  console.log('Rows per page:', JSON.stringify(pageRows));

  const page4Rows = [
    { row: 0, expected: 'C' },
    { row: 1, expected: 'C' },
    { row: 2, expected: 'D' },
    { row: 3, expected: 'B' },
    { row: 4, expected: 'C+' },
    { row: 5, expected: 'B+' },
    { row: 6, expected: 'B' },
    { row: 7, expected: 'B' },
    { row: 8, expected: 'B' },
    { row: 9, expected: 'B' },
    { row: 10, expected: 'B' },
    { row: 11, expected: 'B' },
  ];
  const page5Rows = [
    { row: 0, expected: 'B+' },
    { row: 1, expected: 'C' },
    { row: 2, expected: 'C+' },
    { row: 3, expected: 'C+' },
    { row: 4, expected: 'B' },
    { row: 5, expected: 'B+' },
    { row: 6, expected: 'D' },
    { row: 7, expected: 'B+' },
    { row: 8, expected: 'B+' },
  ];

  const fileMap = [];
  for (const e of page4Rows) fileMap.push({ page: 4, row: e.row, expected: e.expected, name: `p4_r${e.row}_grade.png` });
  for (const e of page5Rows) fileMap.push({ page: 5, row: e.row, expected: e.expected, name: `p5_r${e.row}_grade.png` });

  fs.mkdirSync(OUT_DIR, { recursive: true });

  let copied = 0;
  for (const f of fileMap) {
    const src = path.join(TEMP_DEBUG, f.name);
    const dst = path.join(OUT_DIR, f.name);
    if (fs.existsSync(src)) {
      fs.copyFileSync(src, dst);
      copied++;
    } else {
      console.warn(`  WARN: ${f.name} not found`);
    }
  }
  console.log(`Copied ${copied}/${fileMap.length} images to ${OUT_DIR}`);

  let rows = '';
  for (const f of fileMap) {
    if (!fs.existsSync(path.join(OUT_DIR, f.name))) continue;
    rows += `    <div style="text-align:center;border:1px solid #ccc;padding:4px">
      <img src="${f.name}" style="height:60px;border:1px solid red">
      <div style="font-size:11px">p${f.page}_r${f.row} (expected: ${f.expected})</div>
    </div>\n`;
  }

  const html = `<!DOCTYPE html>
<html>
<head><title>Grade Cell Debug</title></head>
<body style="background:#fff;display:flex;flex-wrap:wrap;gap:8px;padding:16px;font-family:sans-serif">
${rows}</body>
</html>`;

  fs.writeFileSync(path.join(OUT_DIR, 'index.html'), html);
  console.log('Written index.html');
  console.log(`\nOpen http://localhost:5000/debug/index.html in your browser`);
}

main().catch(err => { console.error(err.message); process.exit(1); });
