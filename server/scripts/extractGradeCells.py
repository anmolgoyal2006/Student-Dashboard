#!/usr/bin/env python3
"""
Extract student grades from scanned grade-list PDFs.
Strategy: detect table grid lines with OpenCV, crop each cell,
run Tesseract on individual cells. Falls back to full-page OCR if needed.
Outputs JSON array of {sid, name, grade} to stdout.
"""

import json
import os
import re
import sys
import tempfile

# ── Windows: ensure poppler is on PATH # ---# ---───
if sys.platform == 'win32':
    winget_root = os.path.expanduser(r'~\AppData\Local\Microsoft\WinGet\Packages')
    if os.path.isdir(winget_root):
        for root, dirs, files in os.walk(winget_root):
            if 'pdftoppm.exe' in files:
                os.environ['PATH'] = root + os.pathsep + os.environ.get('PATH', '')
                break

import cv2
import numpy as np
import pytesseract
from pdf2image import convert_from_path
from table_detector import detect_table_structure, is_tatr_available

# ── TrOCR optional engine # ---# ---# ---─
try:
    import torch
    from transformers import TrOCRProcessor, VisionEncoderDecoderModel
    from PIL import Image
    TROCR_AVAILABLE = True
except ImportError:
    torch = None
    TrOCRProcessor = None
    VisionEncoderDecoderModel = None
    Image = None
    TROCR_AVAILABLE = False
    sys.stderr.write("[TrOCR] Dependencies not installed. TrOCR disabled.\n")

ENABLE_TROCR_LOCAL = os.environ.get('ENABLE_TROCR_LOCAL', 'false').lower() == 'true'
ENABLE_TATR_LOCAL = os.environ.get('ENABLE_TATR_LOCAL', 'false').lower() == 'true'
_trocr_model = None
_trocr_processor = None

def load_trocr():
    global _trocr_model, _trocr_processor
    if not ENABLE_TROCR_LOCAL or not TROCR_AVAILABLE:
        return None, None
    if _trocr_model is None:
        try:
            device = "cuda" if torch.cuda.is_available() else "cpu"
            _trocr_processor = TrOCRProcessor.from_pretrained("microsoft/trocr-base-handwritten")
            _trocr_model = VisionEncoderDecoderModel.from_pretrained("microsoft/trocr-base-handwritten").to(device)
            sys.stderr.write("[TrOCR] Model loaded on {}\n".format(device))
        except Exception as e:
            sys.stderr.write("[TrOCR] Failed to load model: {}\n".format(e))
            _trocr_model = None
            _trocr_processor = None
    return _trocr_model, _trocr_processor

# ── Windows: find tesseract binary # ---# ---───────
if sys.platform == 'win32':
    for p in [
        r'C:\Program Files\Tesseract-OCR\tesseract.exe',
        r'C:\Program Files (x86)\Tesseract-OCR\tesseract.exe',
    ]:
        if os.path.exists(p):
            pytesseract.pytesseract.tesseract_cmd = p
            break

DEBUG_DIR = os.path.join(tempfile.gettempdir(), 'grade_debug')
os.makedirs(DEBUG_DIR, exist_ok=True)

VALID_GRADES = {'A+', 'A', 'B+', 'B', 'C+', 'C', 'D', 'F', 'F(UMC)'}

# ── Grade normalization # ---# ---# ---───

EXPLICIT_MAP = {
    'R': 'B', '8': 'B', '2': 'B', '6': 'B',
    '0': 'D', 'Q': 'D',
    'AT': 'A+', 'BT': 'B+', 'CT': 'C+',
    'AF': 'A+', 'BF': 'B+', 'CF': 'C+',
    'At': 'A+', 'Bt': 'B+', 'Ct': 'C+',
    'ND': 'D', 'NO': 'D',
    'E': 'F', 'P': 'F',
}


def normalize_grade(raw):
    if not raw:
        return ''
    t = raw.strip()

    # Check for F(UMC) first
    if re.search(r'UMC', t, re.IGNORECASE):
        return 'F(UMC)'

    t = t.upper()

    # Strip leading noise
    t = re.sub(r'^[^A-DF-Z0-9(]+', '', t).strip()

    # Strip parenthetical annotations (except UMC already handled)
    t = re.sub(r'\([^)]*\)', '', t).strip()

    # Remove internal spaces: "B +" -> "B+"
    t = re.sub(r'^([ABC])\s+\+$', r'\1+', t)
    t = t.replace(' ', '')

    # Explicit OCR confusion map
    if t in EXPLICIT_MAP:
        return EXPLICIT_MAP[t]

    # Direct match
    if t in VALID_GRADES:
        return t

    # Cursive t/f at end = +
    m = re.match(r'^([ABC])[TF]$', t)
    if m:
        return m.group(1) + '+'

    # Strip leading noise chars
    m = re.match(r'^[^ABCDF(]*([ABCDF].*)$', t)
    if m:
        t = m.group(1)

    if t in VALID_GRADES:
        return t

    # Single letter
    if len(t) == 1 and t in 'ABCDF':
        return t

    # Letter + plus-like
    if len(t) >= 2 and t[0] in 'ABC' and t[1] in '+TF':
        return t[0] + '+'

    # Just take first valid letter
    if t and t[0] in 'ABCDF':
        return t[0]

    return ''


def clean_sid(raw):
    s = raw.strip()
    s = re.sub(r'[lL]', '1', s)
    s = re.sub(r'[oO]', '0', s)
    s = re.sub(r'[I]', '1', s)
    s = re.sub(r'[S]', '5', s)
    s = re.sub(r'[^0-9]', '', s)
    return s


def clean_name(raw):
    name = re.sub(r'[^A-Za-z\s\-\']', ' ', raw)
    name = re.sub(r'\s+', ' ', name).strip().upper()
    # Remove single character words (OCR noise)
    words = [w for w in name.split() if len(w) > 1]
    return ' '.join(words)


# ── OCR helpers # ---# ---───────────

def identify_columns(cells, page_gray):
    """
    Identify which columns correspond to SID, Name, Grade using OCR on the header row.
    cells: list of cell bounding boxes (x1,y1,x2,y2) from TATR.
    page_gray: grayscale image of the page.
    Returns dict with keys 'sid', 'name', 'grade' mapping to column indices (0-based within row),
    or None if identification fails.
    """
    if not cells:
        return None
    # Group cells into rows by y-coordinate (using a threshold)
    # Sort cells by y1
    cells_sorted = sorted(cells, key=lambda b: b[1])
    # Estimate row height as median cell height
    heights = [b[3]-b[1] for b in cells_sorted]
    if not heights:
        return None
    median_height = sorted(heights)[len(heights)//2]
    row_threshold = median_height * 0.5
    rows = []
    current_row = []
    current_y = cells_sorted[0][1]
    for cell in cells_sorted:
        if abs(cell[1] - current_y) < row_threshold:
            current_row.append(cell)
        else:
            if current_row:
                rows.append(sorted(current_row, key=lambda b: b[0]))
            current_row = [cell]
            current_y = cell[1]
    if current_row:
        rows.append(sorted(current_row, key=lambda b: b[0]))
    if not rows:
        return None
    # Assume first row is header
    header_row = rows[0]
    # OCR each header cell
    header_texts = []
    for (x1,y1,x2,y2) in header_row:
        # Crop region with some padding
        pad = 2
        y1_crop = max(0, y1 - pad)
        y2_crop = min(page_gray.shape[0], y2 + pad)
        x1_crop = max(0, x1 - pad)
        x2_crop = min(page_gray.shape[1], x2 + pad)
        cell_img = page_gray[y1_crop:y2_crop, x1_crop:x2_crop]
        if cell_img.size == 0:
            header_texts.append('')
            continue
        # Prepare for OCR
        prepared = prepare_cell(cell_img, scale_to_height=30)
        if prepared is not None:
            text = ocr_text(prepared, psm=7, whitelist='ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz')
        else:
            text = ''
        header_texts.append(text.strip().upper())
    # Map to column indices
    sid_keywords = ['SID', 'ROLL', 'ID', 'STUDENT ID']
    name_keywords = ['NAME', 'STUDENT NAME', 'FULL NAME']
    grade_keywords = ['GRADE', 'MARK', 'GRADE POINTS', 'GP']
    sid_idx = None
    name_idx = None
    grade_idx = None
    for idx, text in enumerate(header_texts):
        if any(kw in text for kw in sid_keywords):
            sid_idx = idx
        elif any(kw in text for kw in name_keywords):
            name_idx = idx
        elif any(kw in text for kw in grade_keywords):
            grade_idx = idx
    if sid_idx is None or name_idx is None or grade_idx is None:
        # Fallback: use positional assumption based on common layout
        # In the given PDF, columns are: Sr. No., SID, Name, Units, Grade
        # So SID at index 1, Name at 2, Grade at 4 (0-based)
        if len(header_row) >= 5:
            sid_idx = 1
            name_idx = 2
            grade_idx = 4
        else:
            # Try to guess: often first is index, second is SID, third is name, last is grade
            if len(header_row) >= 4:
                sid_idx = 1
                name_idx = 2
                grade_idx = 3
            else:
                return None
    return {'sid': sid_idx, 'name': name_idx, 'grade': grade_idx}
# ---

def prepare_cell(gray_cell, scale_to_height=80):
    """Upscale, denoise, binarize a cell image for best OCR."""
    if gray_cell is None or gray_cell.size == 0:
        return None
    h, w = gray_cell.shape[:2]
    if h == 0 or w == 0:
        return None

    # Scale up so height is at least scale_to_height
    if h < scale_to_height:
        factor = scale_to_height / h
        new_w = max(1, int(w * factor))
        new_h = scale_to_height
        gray_cell = cv2.resize(gray_cell, (new_w, new_h), interpolation=cv2.INTER_CUBIC)

    # Denoise
    denoised = cv2.fastNlMeansDenoising(gray_cell, h=15)

    # Binarize with Otsu
    _, binary = cv2.threshold(denoised, 0, 255, cv2.THRESH_BINARY + cv2.THRESH_OTSU)

    return binary


def remove_horizontal_lines(binary):
    """Remove horizontal table lines from a binarized cell image."""
    h, w = binary.shape
    inv = cv2.bitwise_not(binary)
    kw = max(20, w // 3)
    kernel = cv2.getStructuringElement(cv2.MORPH_RECT, (kw, 1))
    lines = cv2.morphologyEx(inv, cv2.MORPH_OPEN, kernel)
    cleaned_inv = cv2.subtract(inv, lines)
    return cv2.bitwise_not(cleaned_inv)


def ocr_text(binary, psm, whitelist=''):
    """Run Tesseract on a prepared binary image."""
    config = f'--psm {psm} --oem 3'
    if whitelist:
        config += f' -c tessedit_char_whitelist={whitelist}'
    try:
        return pytesseract.image_to_string(binary, config=config).strip()
    except Exception:
        return ''


def read_sid(gray_cell):
    cell = prepare_cell(gray_cell, scale_to_height=60)
    if cell is None:
        return ''
    cell = remove_horizontal_lines(cell)
    raw = ocr_text(cell, psm=7, whitelist='0123456789IlLoO')
    return clean_sid(raw)


def read_name(gray_cell):
    cell = prepare_cell(gray_cell, scale_to_height=60)
    if cell is None:
        return ''
    cell = remove_horizontal_lines(cell)
    raw = ocr_text(cell, psm=7,
                   whitelist='ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz .-\'')
    return clean_name(raw)


def read_grade_tesseract(gray_cell, debug_path=None):
    """Original Tesseract-based grade reading."""
    cell = prepare_cell(gray_cell, scale_to_height=80)
    if cell is None:
        return ''
    cell = remove_horizontal_lines(cell)
    if debug_path:
        cv2.imwrite(debug_path, cell)
    whitelist = 'ABCDFabcdf+()'
    for psm in [8, 7, 13, 6]:
        raw = ocr_text(cell, psm=psm, whitelist=whitelist)
        if 'UMC' in raw.upper():
            return 'F(UMC)'
        grade = normalize_grade(raw)
        if grade:
            return grade
    for psm in [8, 7]:
        raw = ocr_text(cell, psm=psm, whitelist='')
        grade = normalize_grade(raw)
        if grade:
            return grade
    sys.stderr.write(f'[Grade] Failed all strategies. '
                     f'Raw PSM8={ocr_text(cell, 8, whitelist)!r} '
                     f'PSM7={ocr_text(cell, 7, whitelist)!r}\n')
    return ''

def read_grade_trocr(gray_cell, model, processor):
    """Use TrOCR to read a handwritten grade cell."""
    cell = prepare_cell(gray_cell, scale_to_height=80)
    if cell is None:
        return ''
    cell = remove_horizontal_lines(cell)
    # Convert to PIL Image (TrOCR expects RGB)
    pil_img = Image.fromarray(cv2.cvtColor(cell, cv2.COLOR_GRAY2RGB))
    pixel_values = processor(images=pil_img, return_tensors="pt").pixel_values.to(model.device)
    generated_ids = model.generate(pixel_values, max_length=4, num_beams=4)
    generated_text = processor.batch_decode(generated_ids, skip_special_tokens=True)[0]
    grade = normalize_grade(generated_text)
    if grade:
        sys.stderr.write("[TrOCR] Recognized: '{}' -> '{}'\n".format(generated_text, grade))
    else:
        sys.stderr.write("[TrOCR] Failed to recognize: '{}'\n".format(generated_text))
    return grade

def read_grade(gray_cell, debug_path=None):
    """Try TrOCR if enabled, else fallback to Tesseract."""
    if ENABLE_TROCR_LOCAL and TROCR_AVAILABLE:
        model, processor = load_trocr()
        if model is not None:
            grade = read_grade_trocr(gray_cell, model, processor)
            if grade:
                return grade
    # Fallback to Tesseract
    return read_grade_tesseract(gray_cell, debug_path)


# ── Table grid detection ───────────────────────────────────────────────────

def detect_horizontal_lines(gray):
    """Find Y coordinates of horizontal table grid lines."""
    h, w = gray.shape
    _, binary = cv2.threshold(gray, 180, 255, cv2.THRESH_BINARY_INV)

    kw = max(50, w // 3)
    kernel = cv2.getStructuringElement(cv2.MORPH_RECT, (kw, 1))
    horiz = cv2.morphologyEx(binary, cv2.MORPH_OPEN, kernel)

    row_sums = horiz.sum(axis=1)
    min_sum = 255 * max(30, w // 5)
    strong_rows = np.where(row_sums > min_sum)[0]

    if len(strong_rows) == 0:
        return []

    lines = []
    cluster = [strong_rows[0]]
    for y in strong_rows[1:]:
        if y - cluster[-1] <= 4:
            cluster.append(y)
        else:
            lines.append(int(np.mean(cluster)))
            cluster = [y]
    lines.append(int(np.mean(cluster)))

    return lines

def map_columns(vert_lines, page_w):
    return {
        'sid':   (int(page_w * 0.08), int(page_w * 0.26)),
        'name':  (int(page_w * 0.26), int(page_w * 0.72)),
        'grade': (int(page_w * 0.82), int(page_w * 1.00)),
    }

def detect_rows_by_projection(gray):
    """Detect data row Y bands using horizontal text projection."""
    h, w = gray.shape
    _, binary = cv2.threshold(gray, 0, 255, cv2.THRESH_BINARY_INV + cv2.THRESH_OTSU)
    proj = binary.sum(axis=1) / 255

    threshold = max(proj.max() * 0.10, w * 0.01)
    if threshold == 0:
        return []

    bands = []
    in_band = False
    start = 0
    for y in range(h):
        if proj[y] > threshold and not in_band:
            start = y
            in_band = True
        elif proj[y] <= threshold and in_band:
            band_h = y - start
            if 12 <= band_h <= h * 0.10:
                bands.append((start, y))
            in_band = False
    if in_band and h - start >= 12:
        bands.append((start, h))

    return bands

def merge_nearby_bands(bands, gap=8):
    if not bands:
        return []
    merged = [list(bands[0])]
    for y1, y2 in bands[1:]:
        if y1 - merged[-1][1] <= gap:
            merged[-1][1] = max(merged[-1][1], y2)
        else:
            merged.append([y1, y2])
    return [tuple(b) for b in merged]

# ── Per-page extraction ───────────────────────────────────────────────────

def extract_page(pil_image, page_num):
    """Extract student rows from one page image."""
    bgr = cv2.cvtColor(np.array(pil_image), cv2.COLOR_RGB2BGR)
    gray = cv2.cvtColor(bgr, cv2.COLOR_BGR2GRAY)
    h, w = gray.shape

    # 1. Try TATR if enabled
    if ENABLE_TATR_LOCAL and is_tatr_available():
        rgb = cv2.cvtColor(bgr, cv2.COLOR_BGR2RGB)
        structure = detect_table_structure(rgb)
        if structure['table_detected'] and structure['cells']:
            col_map = identify_columns(structure['cells'], gray)
            if col_map is not None:
                cells = structure['cells']
                cells_sorted = sorted(cells, key=lambda b: b[1])
                heights = [b[3]-b[1] for b in cells_sorted]
                if heights:
                    median_height = sorted(heights)[len(heights)//2]
                    row_threshold = median_height * 0.5
                    rows = []
                    current_row = []
                    current_y = cells_sorted[0][1]
                    for cell in cells_sorted:
                        if abs(cell[1] - current_y) < row_threshold:
                            current_row.append(cell)
                        else:
                            if current_row:
                                rows.append(sorted(current_row, key=lambda b: b[0]))
                            current_row = [cell]
                            current_y = cell[1]
                    if current_row:
                        rows.append(sorted(current_row, key=lambda b: b[0]))
                    if len(rows) > 1:
                        data_rows = rows[1:]
                        seen_sids = set()
                        result_rows = []
                        for row_idx, row_cells in enumerate(data_rows):
                            if len(row_cells) <= max(col_map.values()):
                                continue
                            sid_cell = row_cells[col_map['sid']]
                            name_cell = row_cells[col_map['name']]
                            grade_cell = row_cells[col_map['grade']]
                            pad = 5
                            sx1, sy1, sx2, sy2 = sid_cell
                            sid_crop = gray[max(0, sy1-pad):min(h, sy2+pad), max(0, sx1-pad):min(w, sx2+pad)]
                            sid = read_sid(sid_crop)
                            if len(sid) < 5:
                                continue
                            if sid in seen_sids:
                                continue
                            nx1, ny1, nx2, ny2 = name_cell
                            name_crop = gray[max(0, ny1-pad):min(h, ny2+pad), max(0, nx1-pad):min(w, nx2+pad)]
                            name = read_name(name_crop)
                            gx1, gy1, gx2, gy2 = grade_cell
                            grade_crop = gray[max(0, gy1-pad):min(h, gy2+pad), max(0, gx1-pad):min(w, gx2+pad)]
                            debug_path = os.path.join(DEBUG_DIR, f'p{page_num}_r{row_idx}_grade.png')
                            grade = read_grade(grade_crop, debug_path=debug_path)
                            seen_sids.add(sid)
                            result_rows.append({'sid': sid, 'name': name, 'grade': grade})
                        if result_rows:
                            sys.stderr.write(f'[Python] Page {page_num}: {len(result_rows)} rows from TATR\n')
                            return result_rows

    # 2. Grid detection (original logic)
    horiz_lines = detect_horizontal_lines(gray)
    sys.stderr.write(f'[Python] Page {page_num}: {len(horiz_lines)} horizontal lines detected\n')

    col_map = map_columns([], w)
    sys.stderr.write(f'[Python] Page {page_num}: columns={col_map}\n')

    if len(horiz_lines) >= 2:
        row_bands = []
        for i in range(len(horiz_lines) - 1):
            y1 = horiz_lines[i]
            y2 = horiz_lines[i + 1]
            row_h = y2 - y1
            if 15 <= row_h <= h * 0.10:
                row_bands.append((y1, y2))
    else:
        raw_bands = detect_rows_by_projection(gray)
        row_bands = merge_nearby_bands(raw_bands, gap=8)
        sys.stderr.write(f'[Python] Page {page_num}: using text projection, {len(row_bands)} bands\n')

    sys.stderr.write(f'[Python] Page {page_num}: {len(row_bands)} data row bands\n')

    rows = []
    seen_sids = set()

    for row_idx, (y1, y2) in enumerate(row_bands):
        row_h = y2 - y1
        pad = max(2, int(row_h * 0.05))
        gy1 = max(0, y1 + pad)
        gy2 = min(h, y2 - pad)

        sx1, sx2 = col_map['sid']
        sid_crop = gray[gy1:gy2, max(0, sx1 + 4):min(w, sx2 - 4)]
        sid = read_sid(sid_crop)

        if len(sid) < 5:
            sys.stderr.write(f'[Python] Page {page_num} row {row_idx}: rejected sid={sid!r}\n')
            continue

        if sid in seen_sids:
            continue

        nx1, nx2 = col_map['name']
        name_crop = gray[gy1:gy2, max(0, nx1 + 4):min(w, nx2 - 4)]
        name = read_name(name_crop)

        gx1, gx2 = col_map['grade']
        grade_y1 = max(0, y1 - int(row_h * 0.30))
        grade_y2 = min(h, y2 + int(row_h * 0.40))
        grade_crop = gray[grade_y1:grade_y2, max(0, gx1):min(w, gx2)]

        debug_path = os.path.join(DEBUG_DIR, f'p{page_num}_r{row_idx}_grade.png')
        grade = read_grade(grade_crop, debug_path=debug_path)

        seen_sids.add(sid)
        rows.append({
            'sid': sid,
            'name': name,
            'grade': grade,
        })

    if rows:
        return rows

    # 3. Full-page OCR fallback
    sys.stderr.write(f'[Python] Page {page_num}: grid detection yielded no rows, trying full-page OCR\n')
    return extract_page_fullpage_ocr(pil_image, page_num)


# ── Full-page OCR fallback # ---# ---# ---

def extract_page_fullpage_ocr(pil_image, page_num):
    """
    Fallback: run Tesseract on the full page and extract rows by regex.
    Used when grid detection finds no rows.
    """
    bgr = cv2.cvtColor(np.array(pil_image), cv2.COLOR_RGB2BGR)
    gray = cv2.cvtColor(bgr, cv2.COLOR_BGR2GRAY)

    scale = 2
    gray_up = cv2.resize(gray, None, fx=scale, fy=scale, interpolation=cv2.INTER_CUBIC)
    _, binary = cv2.threshold(gray_up, 0, 255, cv2.THRESH_BINARY + cv2.THRESH_OTSU)

    try:
        text = pytesseract.image_to_string(binary, config='--psm 6 --oem 3')
    except Exception as e:
        sys.stderr.write(f'[Python] Full-page OCR failed: {e}\n')
        return []

    rows = []
    seen = set()

    for line in text.split('\n'):
        line = line.strip()
        if not line:
            continue

        # FIX 5: Accept SIDs from 5 to 12 digits to match relaxed threshold above.
        sid_match = re.search(r'\b(\d{5,12})\b', line)
        if not sid_match:
            continue

        sid = clean_sid(sid_match.group(1))
        if len(sid) < 5 or sid in seen:
            continue

        after = line[sid_match.end():].strip()

        grade = ''
        name = ''

        grade_match = re.search(
            r'\b(A\+|A|B\+|B|C\+|C|D|F(?:\(UMC\))?|[AB][TtFf])\s*$',
            after, re.IGNORECASE
        )
        if grade_match:
            grade = normalize_grade(grade_match.group(1))
            name = clean_name(after[:grade_match.start()])
        else:
            name = clean_name(after)

        seen.add(sid)
        rows.append({'sid': sid, 'name': name, 'grade': grade})

    return rows


# ── Main # ---# ---# ---# ---─

def main():
    if len(sys.argv) < 2:
        print(json.dumps({'error': 'Usage: extractGradeCells.py <pdf_path>'}))
        sys.exit(1)

    pdf_path = sys.argv[1]
    if not os.path.exists(pdf_path):
        print(json.dumps({'error': f'File not found: {pdf_path}'}))
        sys.exit(1)

    try:
        images = convert_from_path(pdf_path, dpi=300, fmt='jpeg')
    except Exception as e:
        print(json.dumps({'error': f'pdf2image failed: {str(e)}'}))
        sys.exit(1)

    all_rows = []

    for page_num, pil_img in enumerate(images, 1):
        page_rows = extract_page(pil_img, page_num)

        if not page_rows:
            sys.stderr.write(f'[Python] Page {page_num}: no rows from grid, trying full-page OCR\n')
            page_rows = extract_page_fullpage_ocr(pil_img, page_num)

        sys.stderr.write(
            f'[Python] Page {page_num}: {len(page_rows)} rows, '
            f'grades: {[r["grade"] for r in page_rows]}\n'
        )
        all_rows.extend(page_rows)

    sys.stderr.write(f'[Debug] Total rows: {len(all_rows)}\n')
    sys.stderr.write(f'[Debug] Grade debug images: {DEBUG_DIR}\n')

    print(json.dumps(all_rows))


if __name__ == '__main__':
    main()