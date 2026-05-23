#!/usr/bin/env python3
"""Extract tabular marks from PDF — multiple strategies, any layout."""

import sys
import json
import re
import pdfplumber

HEADER_HINTS = (
    'name', 'sid', 's.no', 'sno', 'roll', 'marks', 'score', 'quiz', 'lab',
    'midterm', 'endterm', 'theory', 'pretotal', 'total', 'student', 'enrollment',
    'exam', 'test', 'practical', 'assignment', 'grade', 'cgpa', 'sgpa',
)

TABLE_SETTINGS = [
    {'vertical_strategy': 'lines', 'horizontal_strategy': 'lines', 'intersection_tolerance': 5},
    {'vertical_strategy': 'text', 'horizontal_strategy': 'text', 'snap_tolerance': 4},
    {},
]


def row_header_score(row):
    score = 0
    for cell in row or []:
        c = str(cell or '').strip().lower()
        if not c:
            continue
        if any(h in c for h in HEADER_HINTS):
            score += 2
        if re.search(r'\(\s*\d+', c):
            score += 1
    return score


def is_spreadsheet_letter_row(row):
    if not row:
        return False
    cells = [str(c).strip() for c in row if c and str(c).strip()]
    if len(cells) < 3:
        return False
    letters = sum(1 for c in cells if len(c) == 1 and c.isalpha())
    return letters >= len(cells) * 0.6


def normalize_headers(raw_headers):
    out, seen = [], {}
    for i, h in enumerate(raw_headers):
        label = str(h).strip() if h else ''
        if not label or (len(label) == 1 and label.isalpha()):
            label = f'Column_{i + 1}'
        n = seen.get(label, 0)
        if n:
            label = f'{label}_{n + 1}'
        seen[label] = n + 1
        out.append(label)
    return out


def headers_match(row, headers):
    row_norm = [str(c).strip() if c else '' for c in row[:len(headers)]]
    if row_norm == headers:
        return True
    return [c.lower() for c in row_norm] == [c.lower() for c in headers]


def find_header_index(table):
    if not table:
        return 0
    if is_spreadsheet_letter_row(table[0]) and len(table) > 1 and row_header_score(table[1]) >= 2:
        return 1
    best_i, best_score = 0, row_header_score(table[0])
    for i in range(min(8, len(table))):
        sc = row_header_score(table[i])
        if sc > best_score:
            best_score, best_i = sc, i
    return best_i if best_score >= 2 else 0


def row_to_obj(headers, row):
    obj = {}
    for i, header in enumerate(headers):
        cell = row[i] if i < len(row) else ''
        obj[header] = str(cell).strip() if cell else ''
    return obj


def looks_like_person_name(val):
    s = str(val or '').strip()
    if not s or len(s) < 2:
        return False
    if re.match(r'^\d+(\.\d+)?$', s):
        return False
    return bool(re.search(r'[a-zA-Z]{2,}', s))


def looks_like_student_id(val):
    s = str(val or '').strip()
    return bool(re.match(r'^\d{5,12}$', s))


def is_likely_data_row(obj):
    """Any row with a person name or student ID in any cell."""
    if not obj:
        return False
    values = [str(v).strip() for v in obj.values() if v and str(v).strip()]
    if not values:
        return False
    if all(len(v) == 1 and v.isalpha() for v in values):
        return False
    joined = ' '.join(values).lower()
    if joined in ('s.no.', 's.no', 'sid', 'name', 'roll no', 'roll'):
        return False
    for v in values:
        if looks_like_person_name(v) or looks_like_student_id(v):
            return True
    return False


def extract_tables_from_page(page):
    seen = []
    for settings in TABLE_SETTINGS:
        try:
            tables = page.extract_tables(table_settings=settings) or []
        except Exception:
            tables = page.extract_tables() or []
        for t in tables:
            if t and len(t) >= 2:
                key = json.dumps(t[:3])
                if key not in seen:
                    seen.append(key)
                    yield t


def parse_pdf(path):
    rows = []
    headers = None

    with pdfplumber.open(path) as pdf:
        for page in pdf.pages:
            for table in extract_tables_from_page(page):
                if headers is None:
                    hi = find_header_index(table)
                    headers = normalize_headers(table[hi])
                    data_rows = table[hi + 1:]
                else:
                    hi = find_header_index(table) if row_header_score(table[0]) >= 2 else None
                    if hi is not None and headers_match(table[hi], headers):
                        data_rows = table[hi + 1:]
                    elif headers_match(table[0], headers):
                        data_rows = table[1:]
                    else:
                        data_rows = table

                for row in data_rows:
                    obj = row_to_obj(headers, row)
                    if is_likely_data_row(obj):
                        rows.append(obj)

    return rows


if __name__ == '__main__':
    if len(sys.argv) < 2:
        print(json.dumps({'error': 'No PDF path provided'}))
        sys.exit(1)
    try:
        print(json.dumps(parse_pdf(sys.argv[1])))
    except Exception as e:
        print(json.dumps({'error': str(e)}))
        sys.exit(1)
