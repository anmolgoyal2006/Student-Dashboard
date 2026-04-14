#!/usr/bin/env python3
"""
parsePdf.py
───────────────────────────────────────────────────────────────────────────────
Reads a marks PDF using pdfplumber (coordinate-aware table extraction).
Outputs a JSON array of raw row objects to stdout.

Called by Node.js marksUploadController via child_process.spawn:
  python3 parsePdf.py <pdf_path>

Why pdfplumber instead of pdf-parse:
  pdf-parse collapses columns on page 2+ when rows have no line separators.
  pdfplumber uses x-coordinate clustering to correctly reconstruct columns
  across ALL pages — even when text runs together visually.
───────────────────────────────────────────────────────────────────────────────
"""

import sys
import json
import pdfplumber


def parse_pdf(path):
    rows = []
    headers = None

    with pdfplumber.open(path) as pdf:
        for page in pdf.pages:
            tables = page.extract_tables()
            for table in tables:
                if not table:
                    continue

                if headers is None:
                    # First table on first page — first row is the header
                    headers = [str(h).strip() if h else '' for h in table[0]]
                    data_rows = table[1:]
                else:
                    # Subsequent pages: check if header row repeated
                    first_row = [str(c).strip() if c else '' for c in table[0]]
                    if first_row == headers:
                        data_rows = table[1:]
                    else:
                        data_rows = table

                for row in data_rows:
                    # Skip completely empty rows
                    non_empty = [c for c in row if c and str(c).strip()]
                    if not non_empty:
                        continue

                    obj = {}
                    for i, header in enumerate(headers):
                        cell = row[i] if i < len(row) else ''
                        obj[header] = str(cell).strip() if cell else ''
                    rows.append(obj)

    return rows


if __name__ == '__main__':
    if len(sys.argv) < 2:
        print(json.dumps({'error': 'No PDF path provided'}))
        sys.exit(1)

    pdf_path = sys.argv[1]

    try:
        result = parse_pdf(pdf_path)
        print(json.dumps(result))
    except Exception as e:
        print(json.dumps({'error': str(e)}))
        sys.exit(1)