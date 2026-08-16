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


# ── Cell cleaning ─────────────────────────────────────────────────────────────

_FOOTNOTE_RE = re.compile(
    r'[\u00a6\u00a7\u00b6\u00b9\u00b2\u00b3\u2070-\u2079'  # superscript digits
    r'\u2020\u2021\u2022\u2023\u204b'                        # dagger/bullet variants
    r'\u00ab\u00bb]',                                         # angle quotes (footnote markers)
    re.UNICODE,
)

# Page-break artefacts injected by pdfplumber into cells that span a page
# boundary, e.g. "32\nPage 2" or "31\nContinued".
_PAGE_BREAK_RE = re.compile(r'\n[^\n]*$', re.MULTILINE)


def _clean_cell(raw):
    """Normalise a single PDF cell value.

    - Strip page-break artefacts like "32\\nPage 2" → "32".
    - Collapse remaining whitespace (including \\n from multi-line cells).
    - Strip Unicode footnote markers (superscript digits ¹²³, daggers †‡, etc.).
    """
    if raw is None:
        return ''
    s = str(raw)
    # Remove page-break artefact first (keep only text before the first \n
    # when the part after looks like a page label rather than real data).
    pb = _PAGE_BREAK_RE.search(s)
    if pb:
        after = pb.group(0).strip()
        # Only strip if the trailing fragment is a page label, not real data
        if re.match(r'^(page\s*\d+|continued|cont\.?|\.{2,})$', after, re.IGNORECASE):
            s = s[:pb.start()]
    # Collapse remaining newlines and whitespace runs.
    s = re.sub(r'\s+', ' ', s)
    # Remove footnote/annotation characters.
    s = _FOOTNOTE_RE.sub('', s)
    return s.strip()


def row_to_obj(headers, row):
    obj = {}
    for i, header in enumerate(headers):
        cell = row[i] if i < len(row) else ''
        obj[header] = _clean_cell(cell)

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
    # Allow names with digits only if they follow alphanumeric-identifier patterns
    # like "R2D2 KUMAR" or "RAHUL 2 SHARMA" — real student names in some datasets.
    # Pure-digit strings are still rejected below via looks_like_student_id.

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
    # Pure digit run (student number) OR alphanumeric code like CO24366, MCO24386
    return bool(re.match(r'^\d{5,12}$', s)) or bool(re.match(r'^[A-Z]{1,4}\d{4,10}$', s))


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
    """Detect column-separator x-positions that recur across most rows on the page."""
    if len(lines) < 3:
        return []

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
    """Split a line into cells."""
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
    """Reconstruct tabular rows from a flat word list (borderless/invisible tables)."""
    if not words or len(words) < 5:
        return []

    lines = group_words_into_lines(words)
    boundaries = find_column_boundaries(lines)

    table = []
    for line in lines:
        if not line:
            continue
        cells = split_line_into_cells(line, boundaries)
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
    """Reject tables whose row lengths vary wildly."""
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
            break


def extract_header_cap(header):
    """Pull a declared max out of a header like 'Quiz1 (10)' or 'MT [30]'."""
    m = re.search(r'[\(\[]\s*(\d+(?:\.\d+)?)\s*[\)\]]', str(header))
    return float(m.group(1)) if m else None


def flag_implausible_marks(obj, tolerance=1.5):
    """Flag (but keep) values that exceed their column's declared max."""
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

    Pages that share the same header schema are merged into one section (same
    schema repeating on every page of a multi-page marks sheet).  Tables with a
    genuinely different schema (e.g. Minor-1 breakdown vs Minor-2 breakdown) each
    get their own section so they can be merged per-student later.
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
            candidate_headers = normalize_headers(table[0])
            section = {'headers': candidate_headers, 'rows': table[1:]}
            sections.append(section)
            last_section = section

    return sections


def extract_table_rows(pdf_path):
    """Open a PDF and return sections: [{'headers': [...], 'rows': [...]}, ...]."""
    tables = []

    with pdfplumber.open(pdf_path) as pdf:
        for page in pdf.pages:
            page_tables = list(extract_tables_from_page(page))

            if not page_tables:
                word_table = extract_table_from_words(page)
                if word_table and len(word_table) >= 2:
                    page_tables = [word_table]

            tables.extend(page_tables)

    return assign_tables_to_sections(tables)


def pick_column_by_predicate(headers, objs, predicate):
    """Pick the header whose values most often satisfy `predicate`."""
    best_header, best_hits = None, 0
    for h in headers:
        hits = sum(1 for o in objs if predicate(o.get(h, '')))
        if hits > best_hits:
            best_header, best_hits = h, hits
    return best_header


def section_label(headers, index):
    """Derive a short disambiguating label for a section."""
    for h in headers:
        m = re.search(r'total[-_\s]*(.+)', str(h), re.IGNORECASE)
        if m and m.group(1).strip():
            return m.group(1).strip()
    return f'Table {index + 1}'


# ── Page-break row stitching ──────────────────────────────────────────────────

def _stitch_split_rows(rows, headers, id_col, name_col):
    """Fix rows split across a page boundary by pdfplumber.

    When a row straddles a page boundary pdfplumber sometimes emits two partial
    rows:
      - Row A: roll + name cells filled, all mark cells empty/None
      - Row B: roll + name cells empty,  all mark cells filled

    If row A and row B are adjacent AND their non-overlapping cells would form a
    complete row, merge them into one.  Only merges when the identity cells of
    row A are non-empty and the identity cells of row B are empty (or vice-versa).
    """
    if not rows:
        return rows

    result = []
    skip_next = False

    for i, row in enumerate(rows):
        if skip_next:
            skip_next = False
            continue

        if i + 1 >= len(rows):
            result.append(row)
            continue

        next_row = rows[i + 1]

        # Identity presence in each row
        a_roll = row.get(id_col, '') if id_col else ''
        a_name = row.get(name_col, '') if name_col else ''
        b_roll = next_row.get(id_col, '') if id_col else ''
        b_name = next_row.get(name_col, '') if name_col else ''

        a_has_identity = bool(a_roll or a_name)
        b_has_identity = bool(b_roll or b_name)

        # Non-identity (marks) values in each row
        mark_headers = [h for h in headers if h not in (id_col, name_col)]
        a_has_marks = any(row.get(h, '').strip() for h in mark_headers)
        b_has_marks = any(next_row.get(h, '').strip() for h in mark_headers)

        # Stitch: row A has identity only, row B has marks only
        if a_has_identity and not a_has_marks and not b_has_identity and b_has_marks:
            merged = dict(row)
            for h in mark_headers:
                if next_row.get(h, '').strip():
                    merged[h] = next_row[h]
            result.append(merged)
            skip_next = True
            continue

        # Stitch: row A has marks only, row B has identity only (rare but possible)
        if not a_has_identity and a_has_marks and b_has_identity and not b_has_marks:
            merged = dict(next_row)
            for h in mark_headers:
                if row.get(h, '').strip():
                    merged[h] = row[h]
            result.append(merged)
            skip_next = True
            continue

        result.append(row)

    return result


# ── Core output builder ───────────────────────────────────────────────────────

def _single_schema_rows(sections):
    """All sections share the same header schema — emit every data row as its own
    record without any deduplication.

    This is the correct strategy for a standard marks sheet where:
      - Multiple students can share the same name (NAMAN SHARMA appears 6× with
        different roll numbers).
      - Duplicate roll numbers exist intentionally (CO24430 assigned to two
        different students).
      - A blank roll number does NOT mean the row should be dropped.
    """
    if not sections:
        return []

    # Use the first section's headers as canonical (they are all identical).
    headers = sections[0]['headers']
    all_rows_raw = []
    for section in sections:
        all_rows_raw.extend(section['rows'])

    # Convert raw cells → dicts
    objs = [row_to_obj(headers, row) for row in all_rows_raw]

    # Identify id / name columns
    id_col   = pick_column_by_predicate(headers, objs, looks_like_student_id)
    name_col = pick_column_by_predicate(headers, objs, looks_like_person_name)

    # Stitch page-break split rows before filtering
    objs = _stitch_split_rows(objs, headers, id_col, name_col)

    result = []
    for obj in objs:
        if not is_likely_data_row(obj):
            continue
        flag_implausible_marks(obj)
        result.append(obj)

    return result


def _multi_schema_rows(sections):
    """Sections have distinct header schemas — merge per student across sections.

    Example: Minor-1 breakdown + Minor-2 breakdown + Final-Exam breakdown in the
    same document.  Here deduplication by identity is intentional and correct.
    """
    merged = {}
    order = []
    canonical_id_key = None
    canonical_name_key = None

    for idx, section in enumerate(sections):
        headers = section['headers']
        objs = [row_to_obj(headers, row) for row in section['rows']]

        id_col   = pick_column_by_predicate(headers, objs, looks_like_student_id)
        name_col = pick_column_by_predicate(headers, objs, looks_like_person_name)

        if id_col and canonical_id_key is None:
            canonical_id_key = id_col
        if name_col and canonical_name_key is None:
            canonical_name_key = name_col

        # Stitch page-break rows within each section before merging
        objs = _stitch_split_rows(objs, headers, id_col, name_col)

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


def merge_sections(sections):
    """Choose single-schema (no dedup) vs multi-schema (merge by identity) strategy.

    A document is single-schema when all extracted sections share the same header
    layout — i.e. the same marks sheet spanning multiple pages.  In that case every
    source row must appear in the output, including rows with duplicate names or
    duplicate roll numbers.

    A document is multi-schema when it genuinely contains tables with different
    column layouts (e.g. Minor-1 + Minor-2 + Final), where merging per student is
    correct.
    """
    if not sections:
        return []

    # Check whether all sections share the same header schema
    first_headers = sections[0]['headers']
    all_same = all(header_lists_match(s['headers'], first_headers) for s in sections)

    if all_same:
        return _single_schema_rows(sections)
    else:
        return _multi_schema_rows(sections)


def parse_pdf(path):
    sections = extract_table_rows(path)
    return merge_sections(sections)


if __name__ == '__main__':
    if len(sys.argv) < 2:
        print(json.dumps({'error': 'No PDF path provided'}))
        sys.exit(1)
    try:
        print(json.dumps(parse_pdf(sys.argv[1])))
    except Exception as e:
        print(json.dumps({'error': str(e)}))
        sys.exit(1)
