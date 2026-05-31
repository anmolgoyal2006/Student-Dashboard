#!/usr/bin/env python3
"""Render scanned grade-list PDFs, crop student table cells via OpenCV, OCR each with Tesseract.
Outputs JSON array of {sid, name, grade} to stdout."""

import json, os, re, sys

# Ensure poppler is on PATH before pdf2image import
if sys.platform == 'win32':
    winget_root = os.path.expanduser(
        r'~\AppData\Local\Microsoft\WinGet\Packages'
    )
    if os.path.isdir(winget_root):
        for root, dirs, files in os.walk(winget_root):
            if 'pdftoppm.exe' in files:
                os.environ['PATH'] = root + os.pathsep + os.environ.get('PATH', '')
                break

import cv2
import numpy as np
import pytesseract
from pdf2image import convert_from_path
import tempfile

DEBUG_DIR = os.path.join(tempfile.gettempdir(), 'grade_debug')
os.makedirs(DEBUG_DIR, exist_ok=True)

# Point pytesseract at the Tesseract binary on Windows
if sys.platform == 'win32':
    for p in [
        r'C:\Program Files\Tesseract-OCR\tesseract.exe',
        r'C:\Program Files (x86)\Tesseract-OCR\tesseract.exe',
    ]:
        if os.path.exists(p):
            pytesseract.pytesseract.tesseract_cmd = p
            break

# ── helpers ──────────────────────────────────────────────────────────────

VALID_GRADES = {'A+','A','B+','B','C+','C','D','F','F(UMC)'}


def normalize_grade(raw):
    if not raw:
        return ''
    t = raw.strip().upper()
    t = re.sub(r'^[^A-DF-Z0-9(]+', '', t).strip()
    t = re.sub(r'\([^)]*UMC[^)]*\)', '(UMC)', t, flags=re.IGNORECASE)
    t = re.sub(r'\([^)]*\)', '', t).strip()
    t = re.sub(r'^N\s*D$', 'D', t)
    t = re.sub(r'^[28]\s*\+?$', 'B+', t)
    t = re.sub(r'^[28]$', 'B', t)
    t = re.sub(r'^R$', 'B', t)
    t = re.sub(r'^0$', 'D', t)
    t = re.sub(r'^([ABC])\s+\+$', r'\1+', t)
    t = re.sub(r'^[^ABCDF(]+([ABCDF].*)$', r'\1', t).strip()
    t = re.sub(r'^([ABC])[TF]$', r'\1+', t)
    if t in VALID_GRADES:
        return t
    if len(t) == 1 and t in 'ABCDF':
        return t
    if len(t) >= 1 and t[0] in 'ABCDF':
        c = t[0]
        if len(t) > 1 and t[1] in '+TF' and c in 'ABC':
            g = c + '+'
            if g in VALID_GRADES:
                return g
        if c in VALID_GRADES:
            return c
    return ''


def clean_sid(raw):
    s = raw.strip()
    s = re.sub(r'[lL]', '1', s)
    s = re.sub(r'[oO]', '0', s)
    s = re.sub(r'I', '1', s)
    s = re.sub(r'\s', '', s)
    return s


def clean_name(raw):
    return re.sub(r'[^A-Za-z\s]', '', raw).strip()


def ocr_cell(gray_img, psm=7, whitelist=''):
    if gray_img.size == 0:
        return ''
    resized = cv2.resize(gray_img, None, fx=2, fy=2, interpolation=cv2.INTER_CUBIC)
    _, thresh = cv2.threshold(resized, 0, 255, cv2.THRESH_BINARY + cv2.THRESH_OTSU)
    try:
        config = f'--psm {psm} --oem 3'
        if whitelist:
            config += f' -c tessedit_char_whitelist={whitelist}'
        text = pytesseract.image_to_string(thresh, config=config)
        return text.strip()
    except Exception:
        return ''


def ocr_grade_cell(cell):
    # Try PSM 8 (single word), PSM 7 (single line), PSM 6 (block)
    for psm in [8, 7, 6]:
        raw = ocr_cell(cell, psm=psm, whitelist='ABCDFabcdf+()')
        if 'UMC' in raw.upper():
            return 'F(UMC)'
        grade = normalize_grade(raw)
        if grade:
            return grade
    # Fix 5: log raw outputs when all PSM modes fail
    sys.stderr.write(f'[Grade] All PSM failed, raw outputs: '
                     f'{[ocr_cell(cell, psm=p, whitelist="ABCDFabcdf+()") for p in [8,7,6]]}\n')
    return ''


# ── image preprocessing ──────────────────────────────────────────────────


def preprocess(bgr):
    gray = cv2.cvtColor(bgr, cv2.COLOR_BGR2GRAY)
    denoised = cv2.fastNlMeansDenoising(gray, h=10)
    return denoised


# ── row detection via horizontal projection ──────────────────────────────


def detect_row_lines(gray):
    h, w = gray.shape
    _, binary = cv2.threshold(gray, 0, 255, cv2.THRESH_BINARY_INV + cv2.THRESH_OTSU)
    # Horizontal projection
    proj = np.sum(binary, axis=1) // 255
    # Smooth
    kernel = np.ones(7)
    proj_smooth = np.convolve(proj, kernel, mode='same')
    median = np.median(proj_smooth[proj_smooth > 0]) if np.any(proj_smooth > 0) else 0
    threshold = max(median * 0.12, 3)
    # Find row bands
    rows = []
    in_row = False
    start = 0
    for y in range(h):
        if proj_smooth[y] > threshold and not in_row:
            start = y
            in_row = True
        elif proj_smooth[y] <= threshold and in_row:
            if y - start >= 12:
                rows.append((start, y))
            in_row = False
    if in_row and h - start >= 12:
        rows.append((start, h))
    return rows


def detect_rows_by_text(gray):
    h, w = gray.shape
    _, binary = cv2.threshold(gray, 0, 255,
                              cv2.THRESH_BINARY_INV + cv2.THRESH_OTSU)
    proj = binary.sum(axis=1) / 255
    threshold = max(proj.max() * 0.15, w * 0.02)
    rows = []
    in_row = False
    start = 0
    for y in range(h):
        if proj[y] > threshold and not in_row:
            start = y
            in_row = True
        elif proj[y] <= threshold and in_row:
            mid = (start + y) // 2
            height = y - start
            if 15 <= height <= 80:
                rows.append(mid)
            in_row = False
    return rows


# ── column detection via vertical projection within row bands ────────────


def detect_col_lines(gray):
    """Find X positions separating table columns using vertical projection."""
    _, binary = cv2.threshold(gray, 0, 255, cv2.THRESH_BINARY_INV + cv2.THRESH_OTSU)
    h, w = gray.shape
    proj = np.sum(binary, axis=0) // 255
    kernel = np.ones(5)
    proj_smooth = np.convolve(proj, kernel, mode='same')
    median = np.median(proj_smooth[proj_smooth > 0]) if np.any(proj_smooth > 0) else 0
    threshold = max(median * 0.08, 2)
    cols = []
    in_col = False
    start = 0
    for x in range(w):
        if proj_smooth[x] > threshold and not in_col:
            start = x
            in_col = True
        elif proj_smooth[x] <= threshold and in_col:
            if x - start >= 8:
                cols.append((start, x))
            in_col = False
    if in_col and w - start >= 8:
        cols.append((start, w))
    return cols


def get_col_regions(col_bands, img_w):
    """Map detected column bands to sid/name/grade regions.
    Expects at least 3 columns: SID (leftmost), Grade (rightmost), Name (middle)."""
    if len(col_bands) < 3:
        return None
    regions = {
        'sid': col_bands[0],
        'grade': col_bands[-1],
    }
    if len(col_bands) == 3:
        regions['name'] = col_bands[1]
    else:
        regions['name'] = (col_bands[1][0], col_bands[-2][1])
    return regions


# ── per-page extraction ──────────────────────────────────────────────────


def extract_page(bgr_img, page_num=0):
    gray = preprocess(bgr_img)
    h, w = gray.shape
    row_bands = detect_row_lines(gray)
    # Fix 4: sparse page handling — fall back to text-projection method
    if len(row_bands) < 2:
        row_ys = detect_rows_by_text(gray)
        row_bands = [(max(0, y - 12), min(h, y + 12)) for y in row_ys]
    # Get global column regions from the whole page
    col_bands = detect_col_lines(gray)
    col_regions = get_col_regions(col_bands, w)
    if col_regions is None:
        # Fallback: percentage-based
        col_regions = {
            'sid': (int(w * 0.05), int(w * 0.25)),
            'name': (int(w * 0.25), int(w * 0.72)),
            'grade': (int(w * 0.78), int(w * 0.96)),
        }
    rows = []
    for row_idx, (y1, y2) in enumerate(row_bands):
        row_h = y2 - y1
        if row_h < 14 or row_h > h * 0.08:
            continue
        margin = int(row_h * 0.1)
        cy1 = max(0, y1 + margin)
        cy2 = min(h, y2 - margin)
        if cy2 - cy1 < 8:
            continue

        # OCR each cell
        sid_text = ''
        name_text = ''
        grade_text = ''

        for key, (x1, x2) in col_regions.items():
            if key == 'grade':
                # Fix 1: aggressively widen grade crop to catch handwritten "+"
                cx1 = max(0, x1 - 10)
                cx2 = min(w, x2 + 80)
            else:
                # Fix 1: tighter crop for sid/name — pad inward
                cx1 = max(0, x1 + 4)
                cx2 = min(w, x2 - 4)
            if cx2 <= cx1:
                continue
            if key == 'sid':
                cell = gray[cy1:cy2, cx1:cx2]
                sid_text = clean_sid(ocr_cell(cell, whitelist='0123456789'))
            elif key == 'name':
                cell = gray[cy1:cy2, cx1:cx2]
                name_text = clean_name(ocr_cell(cell, whitelist='ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz .-'))
            elif key == 'grade':
                cell = gray[cy1:cy2, cx1:cx2]
                # Fix 3: scale up small grade cells before OCR
                gh, gw = cell.shape[:2]
                if gh < 40:
                    scale = max(3, 60 // gh)
                    cell = cv2.resize(cell, (gw * scale, gh * scale),
                                      interpolation=cv2.INTER_CUBIC)
                # Fix 4: save grade cell for debugging
                debug_path = os.path.join(DEBUG_DIR, f'p{page_num}_r{row_idx}_grade.png')
                cv2.imwrite(debug_path, cell)
                # Fix 2: try multiple PSM modes for grade
                grade_text = ocr_grade_cell(cell)

        if sid_text or grade_text:
            rows.append({
                'sid': sid_text if len(sid_text) >= 7 else '',
                'name': name_text,
                'grade': grade_text,
            })
    return rows


# ── full-page OCR fallback ─────────────────────────────────────────────


def full_page_ocr_fallback(bgr_img):
    """Use Tesseract full-page OCR and regex to find student rows.

    Handles grade-list layout where table column boundaries are unclear.
    """
    import pytesseract as tsrt
    gray = cv2.cvtColor(bgr_img, cv2.COLOR_BGR2GRAY)
    _, thresh = cv2.threshold(gray, 0, 255, cv2.THRESH_BINARY + cv2.THRESH_OTSU)
    try:
        text = tsrt.image_to_string(thresh, config='--psm 4 --oem 3')
    except Exception:
        return []
    rows = []
    sid_pattern = re.compile(r'\b(\d{7,12})\b')
    # Grade-like token pattern (case-insensitive, allows trailing junk)
    grade_pattern = re.compile(
        r'(?<![A-Za-z0-9])([A-F][+]?)(?:\s|$|[^A-Za-z0-9+])',
        re.IGNORECASE
    )
    for line in text.split('\n'):
        line = line.strip()
        if not line:
            continue
        sid_match = sid_pattern.search(line)
        if not sid_match:
            continue
        sid = clean_sid(sid_match.group(1))
        after_sid = line[sid_match.end():].strip()
        # Strategy 1: split on last "4" (units column)
        grade = ''
        end_idx = after_sid.rfind('4')
        if end_idx >= 0:
            grade = normalize_grade(after_sid[end_idx + 1:])
            name = clean_name(after_sid[:end_idx])
        # Strategy 2: if no grade yet, search for a grade pattern in the tail
        if not grade:
            grade_match = grade_pattern.search(after_sid)
            if grade_match:
                g = normalize_grade(grade_match.group(1))
                if g:
                    grade = g
                    gi = grade_match.start()
                    name = clean_name(after_sid[:gi])
                else:
                    name = clean_name(after_sid)
            else:
                name = clean_name(after_sid)
        else:
            # Clean pipe chars from name
            name = name.lstrip('|[').strip()
        rows.append({'sid': sid, 'name': name, 'grade': grade})
    return rows


# ── main ─────────────────────────────────────────────────────────────────


def main():
    if len(sys.argv) < 2:
        print(json.dumps({'error': 'Usage: extractGradeCells.py <pdf_path>'}))
        sys.exit(1)
    pdf_path = sys.argv[1]
    if not os.path.exists(pdf_path):
        print(json.dumps({'error': f'File not found: {pdf_path}'}))
        sys.exit(1)
    try:
        images = convert_from_path(pdf_path, dpi=200, fmt='jpeg')
    except Exception as e:
        print(json.dumps({'error': f'pdf2image failed: {str(e)}'}))
        sys.exit(1)
    all_rows = []
    for page_num, pil_img in enumerate(images, 1):
        bgr = cv2.cvtColor(np.array(pil_img), cv2.COLOR_RGB2BGR)
        # Try full-page OCR fallback first (better for scanned grade lists)
        fallback = full_page_ocr_fallback(bgr)
        if fallback:
            page_rows = fallback
        else:
            page_rows = extract_page(bgr, page_num)
        all_rows.extend(page_rows)
        # Fix 5: debug per-page output
        sys.stderr.write(f'[Python] Page {page_num}: {len(page_rows)} rows, '
                         f'grades: {[r["grade"] for r in page_rows]}\n')
    sys.stderr.write(f'[Debug] Grade cell images saved to {DEBUG_DIR}\n')
    print(json.dumps(all_rows))


if __name__ == '__main__':
    main()
