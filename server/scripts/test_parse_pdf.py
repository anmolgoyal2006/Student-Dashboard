#!/usr/bin/env python3
"""Tests for parsePdf.py — the pdfplumber-based typed-PDF marks parser.

Run with: pytest server/scripts/test_parse_pdf.py -v
"""

import os
import re

import pytest

from parsePdf import (
    words_to_table,
    find_column_boundaries,
    table_is_consistent,
    is_spreadsheet_letter_row,
    find_header_index,
    normalize_headers,
    header_lists_match,
    assign_tables_to_sections,
    merge_sections,
    extract_table_rows,
    parse_pdf,
    _stitch_split_rows,
    looks_like_student_id,
    looks_like_person_name,
)

FIXTURES_DIR = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'test_fixtures')


# ── Synthetic word-coordinate helpers ────────────────────────────────────────
# Column x0 anchors mirror a dense spreadsheet-exported marks sheet: S.No, SID,
# Name (two words), 7 tightly-packed single-digit quiz columns (3pt gaps — this
# is what used to get fused into one blob like "7784677"), then 5 wider decimal
# columns (Midterm, TheoryQuiz, LabQuiz, MT, Pretotal).

CHAR_W = 5.0
DIGIT_COLS_X0 = [170, 178, 186, 194, 202, 210, 218]  # 3pt gaps between them
TAIL_COLS_X0 = [240, 270, 310, 330, 355]              # normal spacing


def _word(text, x0, top, height=10.0):
    return {'text': text, 'x0': x0, 'x1': x0 + len(text) * CHAR_W, 'top': top, 'bottom': top + height}


def _build_row_words(top, sno, sid, first_name, last_name, digits, tail_values):
    words = [_word(sno, 0, top), _word(sid, 30, top)]

    name_x0 = 70
    first_w = _word(first_name, name_x0, top)
    words.append(first_w)
    last_w = _word(last_name, first_w['x1'] + 3, top)
    words.append(last_w)

    assert len(digits) == len(DIGIT_COLS_X0)
    for digit, x0 in zip(digits, DIGIT_COLS_X0):
        words.append(_word(digit, x0, top))

    assert len(tail_values) == len(TAIL_COLS_X0)
    for val, x0 in zip(tail_values, TAIL_COLS_X0):
        words.append(_word(val, x0, top))

    return words


SYNTHETIC_ROWS = [
    (1, '45', '24103043', 'MANAN', 'THAKUR', ['7', '7', '8', '4', '6', '7', '7'],
     ['22.5', '14.67', '14', '15', '43.67']),
    (2, '46', '24103044', 'OM', 'PATEL', ['8', '6', '9', '3', '5', '8', '6'],
     ['20.0', '12.33', '13', '14', '39.33']),
    (3, '47', '24103045', 'ANKITKUMAR', 'VERMA', ['6', '5', '7', '2', '6', '7', '5'],
     ['18.5', '10.67', '12', '13', '36.17']),
    (4, '48', '24103046', 'RAVI', 'SINGH', ['9', '7', '8', '4', '7', '9', '8'],
     ['24.0', '15.00', '15', '15', '44.00']),
]


def _synthetic_words():
    words = []
    for row_idx, sno, sid, first, last, digits, tail in SYNTHETIC_ROWS:
        top = row_idx * 15.0
        words.extend(_build_row_words(top, sno, sid, first, last, digits, tail))
    return words


# ── Regression test for the concatenation bug ────────────────────────────────

def test_words_to_table_separates_dense_digit_columns():
    """The exact bug from the report: '45 24103043 MANAN THAKUR7784677 22.5 ...'
    must come back as separate cells, not one fused string like '7784677'.
    """
    table = words_to_table(_synthetic_words())
    assert len(table) == len(SYNTHETIC_ROWS)

    row = table[0]
    joined = ' '.join(row)

    # The bug signature: quiz digits fused with the name or with each other.
    assert 'THAKUR7' not in joined
    assert '7784677' not in joined

    # Name must stay one cell together...
    assert any(cell.strip() == 'MANAN THAKUR' for cell in row)
    # ...and each quiz digit must be its own cell.
    for digit in ['7', '7', '8', '4', '6', '7', '7']:
        assert digit in row

    # Tail decimals must also be separated, not merged into the digits.
    for val in ['22.5', '14.67', '14', '15', '43.67']:
        assert val in row


def test_words_to_table_all_rows_consistent_column_count():
    table = words_to_table(_synthetic_words())
    lengths = {len(row) for row in table}
    # All synthetic rows share the same column layout, so column counts must match.
    assert len(lengths) == 1


def test_find_column_boundaries_ignores_variable_name_gap():
    words = _synthetic_words()
    from parsePdf import group_words_into_lines

    lines = group_words_into_lines(words)
    boundaries = find_column_boundaries(lines)
    assert boundaries is not None

    # None of the (varying-position) name-internal gaps should show up as a
    # page-wide boundary — only gaps that recur at the same x on every row do.
    name_gap_midpoints = []
    for row_idx, _, _, first, last, _, _ in SYNTHETIC_ROWS:
        first_x1 = 70 + len(first) * CHAR_W
        last_x0 = first_x1 + 3
        name_gap_midpoints.append((first_x1 + last_x0) / 2.0)

    # Each name gap is at a different position, so at most one could coincide
    # with a real boundary by chance; the rest must not.
    coincidental = sum(
        1 for mid in name_gap_midpoints if any(abs(mid - b) < 1.0 for b in boundaries)
    )
    assert coincidental <= 1


# ── table_is_consistent ───────────────────────────────────────────────────────

def test_table_is_consistent_accepts_uniform_rows():
    table = [['a', 'b', 'c']] * 5
    assert table_is_consistent(table)


def test_table_is_consistent_rejects_ragged_rows():
    table = [['x'] * n for n in [3, 3, 1, 8, 2, 9, 4, 10, 5, 11]]
    assert not table_is_consistent(table)


# ── Header detection / multi-page letter-row filtering ───────────────────────

def test_is_spreadsheet_letter_row_detects_index_labels():
    assert is_spreadsheet_letter_row(['A', 'B', 'C', 'D', 'E'])
    assert not is_spreadsheet_letter_row(['45', '24103043', 'MANAN THAKUR'])


def test_find_header_index_skips_leading_letter_row():
    table = [
        ['A', 'B', 'C', 'D'],
        ['S.No', 'SID', 'Name', 'Pretotal'],
        ['1', '24103043', 'MANAN THAKUR', '43.67'],
    ]
    assert find_header_index(table) == 1


def test_header_lists_match_is_case_insensitive():
    assert header_lists_match(['SID', 'Name'], ['sid', 'name'])
    assert not header_lists_match(['SID', 'Name'], ['SID', 'Name', 'Extra'])


def test_assign_tables_to_sections_merges_repeated_header_across_pages():
    # Same schema repeats verbatim on a second page — must fold into one section,
    # not create a duplicate.
    page1 = [
        ['S.No', 'SID', 'Name', 'Pretotal'],
        ['1', '24103043', 'MANAN THAKUR', '43.67'],
    ]
    page2_with_repeated_header = [
        ['S.No', 'SID', 'Name', 'Pretotal'],
        ['2', '24103044', 'OM PATEL', '39.33'],
    ]

    sections = assign_tables_to_sections([page1, page2_with_repeated_header])

    assert len(sections) == 1
    assert len(sections[0]['rows']) == 2
    assert sections[0]['rows'][0][2] == 'MANAN THAKUR'
    assert sections[0]['rows'][1][2] == 'OM PATEL'


# ── Multi-schema-document regression (summary + Minor-1 + Minor-2 breakdowns) ─
# Reproduces the real failure: a document with 4 structurally different tables
# used to lock onto the first schema seen, silently dropping the summary rows
# and mislabeling Minor-2's Q1..Q6 scores as if they were Minor-1's.

SUMMARY_TABLE = [
    ['ROLL NO', 'NAME', 'Total'],
    ['CO24301', 'ASHA RAO', '85'],
    ['CO24302', 'RAVI KUMAR', '78'],
]

MINOR1_TABLE = [
    ['ROLL NO', 'NAME', 'Q1', 'Q2', 'Q3', 'Q4', 'Q5', 'Q6', 'Total-Minor 1'],
    ['CO24301', 'ASHA RAO', '2', '3', '2', '3', '2', '3', '15'],
    ['CO24302', 'RAVI KUMAR', '1', '2', '1', '2', '1', '2', '9'],
]

MINOR2_TABLE = [
    ['ROLL NO', 'NAME', 'Q1', 'Q2', 'Q3', 'Q4', 'Q5', 'Q6', 'Total-Minor 2'],
    ['CO24301', 'ASHA RAO', '3', '3', '3', '3', '3', '3', '18'],
    ['CO24302', 'RAVI KUMAR', '2', '2', '2', '2', '2', '2', '12'],
]


def test_assign_tables_to_sections_keeps_distinct_schemas_separate():
    sections = assign_tables_to_sections([SUMMARY_TABLE, MINOR1_TABLE, MINOR2_TABLE])

    assert len(sections) == 3
    assert sections[0]['headers'][-1] == 'Total'
    assert sections[1]['headers'][-1] == 'Total-Minor 1'
    assert sections[2]['headers'][-1] == 'Total-Minor 2'
    assert len(sections[0]['rows']) == 2
    assert len(sections[1]['rows']) == 2
    assert len(sections[2]['rows']) == 2


def test_merge_sections_joins_rows_without_mislabeling():
    sections = assign_tables_to_sections([SUMMARY_TABLE, MINOR1_TABLE, MINOR2_TABLE])
    merged = merge_sections(sections)

    assert len(merged) == 2  # 2 real students, not 6 mislabeled rows

    asha = next(r for r in merged if r.get('ROLL NO') == 'CO24301')

    # The summary total made it into the output at all.
    assert asha['Total'] == '85'
    # Minor-1 and Minor-2 Q1 must NOT collapse into the same key/value.
    assert asha['Minor 1 Q1'] == '2'
    assert asha['Minor 2 Q1'] == '3'
    assert asha['Total-Minor 1'] == '15'
    assert asha['Total-Minor 2'] == '18'


# ── Real-PDF integration tests (activate once fixtures are added) ───────────

def _fixture_pdfs():
    if not os.path.isdir(FIXTURES_DIR):
        return []
    return sorted(
        os.path.join(FIXTURES_DIR, f)
        for f in os.listdir(FIXTURES_DIR)
        if f.lower().endswith('.pdf')
    )


@pytest.mark.parametrize('pdf_path', _fixture_pdfs() or [None])
def test_real_pdf_rows_have_consistent_columns_and_no_concatenation(pdf_path):
    if pdf_path is None:
        pytest.skip(
            f'No sample PDFs found in {FIXTURES_DIR}. Add the two sample PDFs there '
            'to activate this test.'
        )

    sections = extract_table_rows(pdf_path)
    assert sections, f'No sections detected in {pdf_path}'
    for section in sections:
        assert section['headers'], f'Section with no headers in {pdf_path}'

    rows = parse_pdf(pdf_path)
    assert rows, f'No student rows parsed from {pdf_path}'

    # Regression guard: no cell should look like several small numbers fused
    # together (e.g. "7784677" instead of "7 7 8 4 6 7 7").
    suspicious = re.compile(r'^\d{5,}$')
    for row in rows:
        for header, value in row.items():
            if suspicious.match(str(value).strip()):
                pytest.fail(f'Suspicious concatenated value {value!r} in column {header!r}: {row}')


# ── Adversarial PDF tests ─────────────────────────────────────────────────────

ADVERSARIAL_PDF = os.path.join(FIXTURES_DIR, 'pdfplumber_adversarial_student_marks.pdf')


def _get_adversarial_rows():
    if not os.path.isfile(ADVERSARIAL_PDF):
        return None
    return parse_pdf(ADVERSARIAL_PDF)


def _skip_if_no_adversarial():
    if not os.path.isfile(ADVERSARIAL_PDF):
        pytest.skip('Adversarial PDF fixture not found.')


# 1. Row count — must be ≥ 65 (PDF has 68 non-empty rows; a few are legitimately
#    empty or header-only rows that should be dropped)
def test_adversarial_row_count():
    _skip_if_no_adversarial()
    rows = _get_adversarial_rows()
    assert len(rows) >= 65, (
        f'Expected ≥65 rows from adversarial PDF, got {len(rows)}. '
        'Many student records are being dropped.'
    )


# 2. SUMIT / SUMIT KUMAR must remain 3 separate records (CO24366, CO24367, CO24368)
def test_adversarial_sumit_variants_separate():
    _skip_if_no_adversarial()
    rows = _get_adversarial_rows()
    rolls = {r.get('ROLL NO', '') for r in rows}
    for expected in ('CO24366', 'CO24367', 'CO24368'):
        assert expected in rolls, (
            f'Roll {expected} (SUMIT variant) missing — rows with same name were merged.'
        )


# 3. NAMAN SHARMA / GUPTA / TIWARI at CO24361-363 must all be present
def test_adversarial_naman_variants_separate():
    _skip_if_no_adversarial()
    rows = _get_adversarial_rows()
    rolls = {r.get('ROLL NO', '') for r in rows}
    for expected in ('CO24361', 'CO24362', 'CO24363'):
        assert expected in rolls, (
            f'Roll {expected} (Naman variant) missing — prefix-name rows were merged.'
        )


# 4. RAM / RAM KUMAR / RAM KUMAR SINGH / KUMAR must all survive (CO24370-373)
def test_adversarial_ram_prefix_names_separate():
    _skip_if_no_adversarial()
    rows = _get_adversarial_rows()
    rolls = {r.get('ROLL NO', '') for r in rows}
    for expected in ('CO24370', 'CO24371', 'CO24372', 'CO24373'):
        assert expected in rolls, (
            f'Roll {expected} (RAM prefix variant) missing.'
        )


# 5. Blank MST-1 must not shift columns — CO24411 should have MST-2=14, not MST-2=blank
def test_adversarial_blank_mst1_no_column_shift():
    _skip_if_no_adversarial()
    rows = _get_adversarial_rows()
    target = next((r for r in rows if r.get('ROLL NO', '') == 'CO24411'), None)
    assert target is not None, 'CO24411 (ROHIT SHARMA blank MST-1) row missing.'
    mst1 = target.get('MST-1', 'ABSENT')
    mst2 = target.get('MST-2', 'ABSENT')
    # MST-1 must be blank/empty, MST-2 must be '14'
    assert mst1 == '', (
        f'CO24411 MST-1 should be blank but got {mst1!r} — column shift bug.'
    )
    assert mst2 == '14', (
        f'CO24411 MST-2 should be 14 but got {mst2!r} — blank MST-1 caused column shift.'
    )


# 6. Missing roll number — student with blank roll should still appear
def test_adversarial_missing_roll_row_preserved():
    _skip_if_no_adversarial()
    rows = _get_adversarial_rows()
    # The row with blank roll + name=ROHIT SHARMA + Att=4 + MST-1=14
    blank_roll_rows = [
        r for r in rows
        if not r.get('ROLL NO', '').strip()
        and 'ROHIT' in r.get('NAME', '').upper()
    ]
    assert blank_roll_rows, (
        'Row with blank Roll No. (ROHIT SHARMA, Att=4) was dropped — '
        'parser must not discard rows solely because roll is missing.'
    )


# 7. Duplicate roll CO24430 — both RAHUL SHARMA and ROHIT SHARMA must survive
def test_adversarial_duplicate_roll_both_rows_kept():
    _skip_if_no_adversarial()
    rows = _get_adversarial_rows()
    co24430 = [r for r in rows if r.get('ROLL NO', '') == 'CO24430']
    assert len(co24430) == 2, (
        f'CO24430 should appear twice (RAHUL + ROHIT) but found {len(co24430)} row(s). '
        'Duplicate roll numbers must not be deduplicated.'
    )
    names = {r.get('NAME', '') for r in co24430}
    assert 'RAHUL SHARMA' in names, 'CO24430 RAHUL SHARMA row missing.'
    assert 'ROHIT SHARMA' in names, 'CO24430 ROHIT SHARMA row missing.'


# 8. Duplicate roll+name CO24440 SUMIT KUMAR — both records must survive
def test_adversarial_duplicate_roll_and_name_both_kept():
    _skip_if_no_adversarial()
    rows = _get_adversarial_rows()
    co24440 = [r for r in rows if r.get('ROLL NO', '') == 'CO24440']
    assert len(co24440) == 2, (
        f'CO24440 SUMIT KUMAR should appear twice (scores 80 and 90) but found {len(co24440)} row(s). '
        'Records with identical roll+name but different marks must not be deduplicated.'
    )


# 9. Page-break split row — CO24560 ABHISHEK KUMAR split across pages 3 and 4
def test_adversarial_page_break_row_stitched():
    _skip_if_no_adversarial()
    rows = _get_adversarial_rows()
    co24560 = [r for r in rows if r.get('ROLL NO', '') == 'CO24560']
    # Expect exactly one fully-populated CO24560 row (stitched from the two halves)
    complete = [
        r for r in co24560
        if r.get('Att Marks', '').strip() and r.get('MST-1', '').strip()
    ]
    assert complete, (
        'CO24560 ABHISHEK KUMAR (page-break split) has no complete row with marks. '
        'The two partial rows across the page boundary must be stitched.'
    )


# 10. Footnote characters stripped — CO24590/CO24591 should have clean values
def test_adversarial_footnote_chars_stripped():
    _skip_if_no_adversarial()
    rows = _get_adversarial_rows()
    import re as _re
    footnote_pat = _re.compile(
        r'[\u00b9\u00b2\u00b3\u2070-\u2079\u2020\u2021\u2022\u00b6\u00a7†‡•]'
    )
    for row in rows:
        for k, v in row.items():
            assert not footnote_pat.search(str(v)), (
                f'Footnote character found in column {k!r}: {v!r}'
            )


# 11. Page-break artefact in EST cell stripped — "32\nPage 2" → "32"
def test_adversarial_page_break_artefact_in_cell_stripped():
    _skip_if_no_adversarial()
    rows = _get_adversarial_rows()
    for row in rows:
        for k, v in row.items():
            assert '\n' not in str(v), (
                f'Newline found in cell {k!r}: {v!r} — page-break artefact not cleaned.'
            )


# 12. looks_like_student_id recognises alphanumeric roll codes
def test_looks_like_student_id_alphanumeric():
    assert looks_like_student_id('CO24366')
    assert looks_like_student_id('MCO24386')
    assert looks_like_student_id('12345678')
    assert not looks_like_student_id('ABC')
    assert not looks_like_student_id('NAMAN')


# 13. Names with digits / special chars (R2D2, O'BRIEN, A.-K.) must survive
def test_adversarial_special_name_rows_present():
    _skip_if_no_adversarial()
    rows = _get_adversarial_rows()
    rolls = {r.get('ROLL NO', '') for r in rows}
    for expected in ('CO24460', 'CO24461', 'CO24462', 'CO24463'):
        assert expected in rolls, (
            f'Roll {expected} (special-char name) missing from output.'
        )
