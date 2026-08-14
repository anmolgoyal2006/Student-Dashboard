#!/usr/bin/env python3
"""Extract tabular marks from PDF — multiple strategies, any layout."""

import sys
import json
import re
from collections import Counter
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


def header_lists_match(a, b):
    """Compare two already-normalized header lists."""
    if len(a) != len(b):
        return False
    return [str(x).strip().lower() for x in a] == [str(y).strip().lower() for y in b]


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

    # ── Fix bleeding-digit artefact ───────────────────────────────────────
    # Some PDFs encode the roll number and student name as one concatenated
    # text run without a space (e.g. "MCO24386NAMAN TIWARI").  pdfplumber
    # then splits at the wrong character boundary, producing:
    #   roll → "MCO2438"   name → "6NAMAN TIWARI"
    # Detect: name cell starts with one-or-more digits followed by a letter.
    # Fix:    strip those leading digits from the name and append them to the
    #         roll cell so both values are restored correctly.
    id_col   = next((h for h in headers if looks_like_student_id(obj.get(h, '')) or
                     re.search(r'roll|sid|s\.no|enrollment', h, re.IGNORECASE)), None)
    name_col = next((h for h in headers if looks_like_person_name(
                     re.sub(r'^\d+', '', obj.get(h, '')))), None)

    if id_col and name_col and id_col != name_col:
        name_val = obj[name_col]
        bleed = re.match(r'^(\d+)([A-Za-z].*)$', name_val)
        if bleed:
            obj[name_col] = bleed.group(2).strip()
            obj[id_col]   = obj[id_col] + bleed.group(1)

    return obj


def looks_like_person_name(val):
    s = str(val or '').strip()
    if not s or len(s) < 2:
        return False
    # A person's name never contains digits (0-9)
    if re.search(r'\d', s):
        return False
    
    lower = s.lower()
    bad_keywords = {
        'total', 'average', 'avg', 'maximum', 'minimum', 'max', 'min', 'mean', 'median', 'std dev', 'highest', 'lowest',
        'topper', 'pass', 'fail', 'absent', 'present', 'grand total', 'subtotal', 'aggregate', 'marks', 'score',
        'grade', 'gpa', 'cgpa', 'pretotal', 'page', 'signature', 'instructor', 'coordinator', 'hod', 'director',
        'dean', 'professor', 'teacher', 'examiner', 'course', 'subject', 'code', 'title', 'branch', 'session',
        'semester', 'serial', 'sr. no', 's.no', 'sl.no', 'roll no', 'rollno', 'enrollment', 'enrolment', 'reg. no',
        'reg no', 'registration', 'absentee', 'class', 'summary', 'percentage', 'result', 'status', 'checked by',
        'verified by', 'date', 'remark', 'theory', 'practical', 'assignment', 'quiz', 'midsem', 'endsem', 'mid term',
        'end term', 'evaluated by', 'prepared by', 'marksheet', 'total marks', 'out of', 'roll_no',
        'sl no', 'sr no', 's no', 'sl. no', 'sr. no', 'serial no', 'academic', 'college', 'university', 'department',
        'institute', 'btech', 'mtech', 'b.tech', 'm.tech', 'examination', 'semester', 'academic year', 'group', 'section'
    }
    
    for kw in bad_keywords:
        if lower == kw or lower.startswith(kw) or lower.endswith(kw) or (' ' + kw) in lower or (kw + ' ') in lower:
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
    if all(len(v) == 0 or (len(v) == 1 and v.isalpha()) for v in values):
        return False
    joined = ' '.join(values).lower()
    if joined in ('s.no.', 's.no', 'sid', 'name', 'roll no', 'roll'):
        return False
    for v in values:
        if looks_like_person_name(v) or looks_like_student_id(v):
            return True
    return False


def group_words_into_lines(words):
    """Group words into horizontal lines by 'top' coordinate with tolerance."""
    lines = []
    for w in sorted(words, key=lambda x: x['top']):
        placed = False
        for line in lines:
            line_top = min(x['top'] for x in line)
            line_bottom = max(x['bottom'] for x in line)
            word_center = (w['top'] + w['bottom']) / 2.0

            # If vertical center of word overlaps with the line's bounds (with tolerance)
            if line_top - 2.5 <= word_center <= line_bottom + 2.5:
                line.append(w)
                placed = True
                break
        if not placed:
            lines.append([w])

    return [sorted(line, key=lambda x: x['x0']) for line in lines]


def find_column_boundaries(lines, bucket_size=2.0, min_frequency=0.4):
    """Detect column-separator x-positions that recur across most rows on the page.

    A gap between two words that lands at the SAME x-position on many rows is a real
    column boundary. A gap within a multi-word cell (e.g. a two-word name) lands at a
    different x-position on every row (names have different lengths), so it never
    accumulates enough frequency to be picked up here.
    """
    if len(lines) < 3:
        return []  # not enough rows for a reliable frequency signal

    bucket_counts = {}
    for line in lines:
        for prev_w, cur_w in zip(line, line[1:]):
            midpoint = (prev_w['x1'] + cur_w['x0']) / 2.0
            bucket = round(midpoint / bucket_size)
            bucket_counts[bucket] = bucket_counts.get(bucket, 0) + 1

    threshold = max(2, int(len(lines) * min_frequency))
    boundary_buckets = sorted(b for b, count in bucket_counts.items() if count >= threshold)
    return [b * bucket_size for b in boundary_buckets]


def split_line_into_cells(line_words, boundaries, large_gap=8.0):
    """Split a line into cells.

    A boundary is crossed when either (a) it falls at one of the page-wide consistent
    positions from find_column_boundaries — catches dense numeric columns whose gaps
    are small but recur at the same x on every row — or (b) the gap itself is larger
    than `large_gap` — catches ordinary transitions (e.g. name column -> first score
    column) whose exact x-position isn't consistent (names vary in length) but whose
    gap is reliably wide.
    """
    cells = []
    current_cell = []
    prev_word = None

    for w in line_words:
        is_boundary = False
        if prev_word is not None:
            crosses_known_boundary = any(prev_word['x1'] <= b <= w['x0'] for b in boundaries)
            is_boundary = crosses_known_boundary or (w['x0'] - prev_word['x1'] > large_gap)

        if prev_word is None:
            current_cell.append(w['text'])
        elif is_boundary:
            cells.append(' '.join(current_cell))
            current_cell = [w['text']]
        else:
            current_cell.append(w['text'])
        prev_word = w

    if current_cell:
        cells.append(' '.join(current_cell))

    return cells


def words_to_table(words):
    """Reconstruct tabular rows from a flat word list (borderless/invisible tables).

    Column boundaries are detected from cross-row positional consistency (see
    find_column_boundaries) rather than a per-line distance heuristic, since dense
    numeric columns can have smaller gaps than the gap inside a multi-word name cell.
    """
    if not words or len(words) < 5:
        return []

    lines = group_words_into_lines(words)
    boundaries = find_column_boundaries(lines)

    table = []
    for line in lines:
        if not line:
            continue
        cells = split_line_into_cells(line, boundaries)

        # Only keep rows that look like they belong to a table (at least 2 columns)
        if len(cells) >= 2:
            table.append(cells)

    return table


def extract_table_from_words(page):
    """Fallback: Reconstruct tabular rows from word coordinates for borderless/invisible tables."""
    try:
        words = page.extract_words()
    except Exception:
        return []

    return words_to_table(words)


def table_is_consistent(table, min_ratio=0.7):
    """Reject tables whose row lengths vary wildly — a sign the strategy mis-detected columns."""
    lengths = [len(row) for row in table if row]
    if len(lengths) < 2:
        return True
    mode_len, _ = Counter(lengths).most_common(1)[0]
    matching = sum(1 for l in lengths if abs(l - mode_len) <= 1)
    return (matching / len(lengths)) >= min_ratio


def extract_tables_from_page(page):
    seen = []
    for settings in TABLE_SETTINGS:
        try:
            tables = page.extract_tables(table_settings=settings) or []
        except Exception:
            tables = []

        valid_tables = [t for t in tables if t and len(t) >= 2 and table_is_consistent(t)]
        if valid_tables:
            for t in valid_tables:
                key = json.dumps(t[:3])
                if key not in seen:
                    seen.append(key)
                    yield t
            # If we successfully extracted tables with a strict strategy, don't fall back to looser ones
            break


def extract_header_cap(header):
    """Pull a declared max out of a header like 'Quiz1 (10)' or 'MT [30]'."""
    m = re.search(r'[\(\[]\s*(\d+(?:\.\d+)?)\s*[\)\]]', str(header))
    return float(m.group(1)) if m else None


def flag_implausible_marks(obj, tolerance=1.5):
    """Cheap sanity check: flag (but keep) values that exceed their column's declared
    max by more than a small tolerance — the signature of a concatenation parsing bug
    (e.g. '7784677' landing in a column meant to hold a single quiz score out of 10).
    Logged to stderr rather than added to the row, so the JSON output shape (consumed
    by columnDetector.js's Object.keys-based header discovery) stays unchanged.
    """
    for header, value in obj.items():
        cap = extract_header_cap(header)
        if cap is None:
            continue
        try:
            num = float(str(value).strip())
        except (TypeError, ValueError):
            continue
        if num > cap + tolerance:
            sys.stderr.write(
                f'[VALIDATION] value {value!r} in column {header!r} exceeds max {cap} '
                f'(row: {obj})\n'
            )


def assign_tables_to_sections(tables):
    """Group extracted tables into sections by header schema.

    Real marksheets often contain several structurally different tables in one
    document (e.g. a totals summary, a Minor-1 quiz breakdown, a Minor-2 quiz
    breakdown, a Final-Exam breakdown). Locking onto the first schema seen and
    force-fitting every later table's rows onto it silently drops rows that don't
    fit (too few columns) and mislabels rows that do (a Minor-2 Q1 score written
    under the Minor-1 Q1 label). Instead, each distinct header schema gets its own
    section. A table with no header row of its own (row_header_score < 2) is
    treated as a continuation of whichever section was most recently active — e.g.
    the same table's data spilling onto the next page without repeating headers.
    """
    sections = []
    last_section = None

    for table in tables:
        if not table:
            continue
        hi = find_header_index(table)
        looks_like_header = row_header_score(table[hi]) >= 2

        if looks_like_header:
            candidate_headers = normalize_headers(table[hi])
            section = next(
                (s for s in sections if header_lists_match(candidate_headers, s['headers'])),
                None,
            )
            if section is None:
                section = {'headers': candidate_headers, 'rows': []}
                sections.append(section)
            section['rows'].extend(table[hi + 1:])
            last_section = section
        elif last_section is not None:
            last_section['rows'].extend(table)
        else:
            # First table doesn't look like it has a recognizable header row —
            # best effort: treat row 0 as headers anyway (legacy behavior).
            candidate_headers = normalize_headers(table[0])
            section = {'headers': candidate_headers, 'rows': table[1:]}
            sections.append(section)
            last_section = section

    return sections


def extract_table_rows(pdf_path):
    """Open a PDF and return a list of sections: [{'headers': [...], 'rows': [...]}, ...].

    For each page, tries strategy-based table extraction first (extract_tables_from_page),
    falling back to word-coordinate clustering (extract_table_from_words) when no
    consistent table is found. Tables are then grouped into sections by schema — see
    assign_tables_to_sections.
    """
    tables = []

    with pdfplumber.open(pdf_path) as pdf:
        for page in pdf.pages:
            page_tables = list(extract_tables_from_page(page))

            # Fallback strategy: If no consistent tables were extracted, reconstruct from coordinates!
            if not page_tables:
                word_table = extract_table_from_words(page)
                if word_table and len(word_table) >= 2:
                    page_tables = [word_table]

            tables.extend(page_tables)

    return assign_tables_to_sections(tables)


def pick_column_by_predicate(headers, objs, predicate):
    """Pick the header whose values most often satisfy `predicate` across all rows."""
    best_header, best_hits = None, 0
    for h in headers:
        hits = sum(1 for o in objs if predicate(o.get(h, '')))
        if hits > best_hits:
            best_header, best_hits = h, hits
    return best_header


def section_label(headers, index):
    """Derive a short disambiguating label for a section, e.g. 'Total-Minor 1' -> 'Minor 1'."""
    for h in headers:
        m = re.search(r'total[-_\s]*(.+)', str(h), re.IGNORECASE)
        if m and m.group(1).strip():
            return m.group(1).strip()
    return f'Table {index + 1}'


def merge_sections_by_identity(sections):
    """Join rows across sections into one record per student, keyed by roll number
    (or name if roll is unavailable) — e.g. a Minor-1 breakdown, a Minor-2 breakdown
    and a Final-Exam breakdown for the same student become one row with all three
    sets of marks, instead of three separate mislabeled rows.

    Columns that collide between sections (every quiz breakdown table using the same
    'Q1'..'Q6' labels) are disambiguated with each section's own label, except the
    first section encountered, whose columns are kept as the canonical/unprefixed
    names — this matches the common case where the first table is the primary one.
    """
    merged = {}
    order = []
    canonical_id_key = None
    canonical_name_key = None

    for idx, section in enumerate(sections):
        headers = section['headers']
        objs = [row_to_obj(headers, row) for row in section['rows']]

        id_col = pick_column_by_predicate(headers, objs, looks_like_student_id)
        name_col = pick_column_by_predicate(headers, objs, looks_like_person_name)

        if id_col and canonical_id_key is None:
            canonical_id_key = id_col
        if name_col and canonical_name_key is None:
            canonical_name_key = name_col

        label = section_label(headers, idx)

        for obj in objs:
            if not is_likely_data_row(obj):
                continue
            flag_implausible_marks(obj)

            roll = obj.get(id_col, '').strip() if id_col else ''
            name = obj.get(name_col, '').strip() if name_col else ''
            if not roll and not name:
                continue
            key = f'roll:{roll.lower()}' if roll else f'name:{name.lower()}'

            if key not in merged:
                merged[key] = {}
                order.append(key)
            target = merged[key]

            if roll and canonical_id_key and canonical_id_key not in target:
                target[canonical_id_key] = roll
            if name and canonical_name_key and canonical_name_key not in target:
                target[canonical_name_key] = name

            for h, v in obj.items():
                if h in (id_col, name_col):
                    continue
                if idx == 0 or label.lower() in h.lower():
                    out_key = h
                else:
                    out_key = f'{label} {h}'
                target[out_key] = v

    return [merged[k] for k in order]


def parse_pdf(path):
    sections = extract_table_rows(path)
    return merge_sections_by_identity(sections)


if __name__ == '__main__':
    if len(sys.argv) < 2:
        print(json.dumps({'error': 'No PDF path provided'}))
        sys.exit(1)
    try:
        print(json.dumps(parse_pdf(sys.argv[1])))
    except Exception as e:
        print(json.dumps({'error': str(e)}))
        sys.exit(1)
