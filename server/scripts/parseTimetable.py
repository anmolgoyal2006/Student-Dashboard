import pdfplumber
import json
import re
import sys

# Days mapping
DAY_MAP = {
    'mon': 'Mon', 'tues': 'Tue', 'wed': 'Wed', 'thurs': 'Thu', 'fri': 'Fri',
    'sat': 'Sat', 'sun': 'Sun', 'monday': 'Mon', 'tuesday': 'Tue',
    'wednesday': 'Wed', 'thursday': 'Thu', 'friday': 'Fri',
    'saturday': 'Sat', 'sunday': 'Sun'
}

def parse_time_header(header):
    # e.g., "9:00-10:00" -> ("09:00", "10:00")
    # e.g., "8:00-9:\n00" -> ("08:00", "09:00")
    # e.g., "1:00- 2:\n00" -> ("13:00", "14:00")
    cleaned = re.sub(r'\s+', '', header)
    # Match time range like 9:00-10:00 or 12:00-1:00
    match = re.search(r'(\d{1,2}):(\d{2})-(\d{1,2}):(\d{2})', cleaned)
    if not match:
        # Try matching simple digits like 8-9AM
        match_simple = re.search(r'(\d{1,2})-(\d{1,2})', cleaned)
        if match_simple:
            start_h, end_h = int(match_simple.group(1)), int(match_simple.group(2))
            start_m, end_m = 0, 0
        else:
            return None
    else:
        start_h, start_m = int(match.group(1)), int(match.group(2))
        end_h, end_m = int(match.group(3)), int(match.group(4))
    
    # Normalize PM hours if needed
    # Standard Indian college timetables run from 8 AM to 6 PM.
    # So if hour is 1, 2, 3, 4, 5, 6, it is PM (add 12).
    # Except if start hour is 12 (which is PM but keep as 12).
    if start_h < 8:
        start_h += 12
    if end_h < 8 or (end_h == 12 and start_h >= 12):
        # Handle case like 12:00 - 1:00
        if end_h < 8:
            end_h += 12

    return f"{start_h:02d}:{start_m:02d}", f"{end_h:02d}:{end_m:02d}"

def parse_cell(cell_text):
    # A cell may contain one or multiple subject entries.
    # Split by lines and clean
    lines = [l.strip() for l in cell_text.split('\n') if l.strip()]
    if not lines:
        return []
    
    blocks = []
    current_block = []
    
    # Group lines: a line starting with a course code starts a new block
    # Course code: letters followed by digits (e.g. CSN5003, CSN5001+AIN5001)
    code_pattern = r'\b[A-Z]{3,5}\d{3,4}'
    
    for line in lines:
        if re.search(code_pattern, line):
            if current_block:
                blocks.append(current_block)
            current_block = [line]
        else:
            if current_block:
                current_block.append(line)
            else:
                current_block = [line]
    if current_block:
        blocks.append(current_block)
        
    entries = []
    for b in blocks:
        entry = {
            'name': '',
            'code': '',
            'instructor': '',
            'room': ''
        }
        
        # Parse first line (code + name)
        first_line = b[0]
        code_match = re.search(r'\b([A-Z]{3,5}\d{3,4}(?:\+[A-Z]{3,5}\d{3,4})*)\b', first_line)
        if code_match:
            entry['code'] = code_match.group(1)
            # Name is the rest of the line
            name_part = first_line.replace(entry['code'], '').strip()
            # Clean name from group tags like (G1), (G2), Lab, etc.
            name_part = re.sub(r'\((?:G\d|G\d\+G\d|G\d,G\d|G\d-G\d|CSE\d|CSE\d,CSE\d|CSE\d\+CSE\d|CSE\d-CSE\d)\)', '', name_part)
            # Keep Lab if it's there
            entry['name'] = re.sub(r'\s+', ' ', name_part).strip()
        else:
            entry['name'] = first_line
            
        # Parse remaining lines for instructor and room
        remaining_text = " ".join(b[1:])
        
        # Room patterns: e.g. L21, L407, 301+303, 402+L405, 402+L407
        room_match = re.search(r'\b([L\d]\d{2,3}(?:\+[L\d]\d{2,3})*)\b', remaining_text)
        if room_match:
            entry['room'] = room_match.group(1)
            # Remove room from remaining text to help extract instructor
            remaining_text = remaining_text.replace(entry['room'], '')
            
        # Clean remaining text for instructor
        # Look for Dr. Name or teacher name
        inst_match = re.search(r'(?:Dr\.|Dr|Mr\.|Mr|Ms\.|Ms)\s+([A-Za-z\s]+)', remaining_text)
        if inst_match:
            entry['instructor'] = f"Dr. {inst_match.group(1).strip()}"
        else:
            # Fallback: remove common words
            cleaned_inst = re.sub(r'[-\(\)]', '', remaining_text)
            cleaned_inst = re.sub(r'\bG\d\b', '', cleaned_inst)
            cleaned_inst = re.sub(r'\bLab\b', '', cleaned_inst, flags=re.IGNORECASE)
            cleaned_inst = re.sub(r'\s+', ' ', cleaned_inst).strip()
            if cleaned_inst and len(cleaned_inst) > 2:
                entry['instructor'] = cleaned_inst
                
        # Subject name fallback if empty
        if not entry['name'] and entry['code']:
            entry['name'] = entry['code']
            
        entries.append(entry)
        
    return entries

def parse_pdf(pdf_path):
    subjects_dict = {} # key: (name, code)
    
    with pdfplumber.open(pdf_path) as pdf:
        for page in pdf.pages:
            tables = page.extract_tables()
            if not tables:
                continue
                
            for table in tables:
                if not table or len(table) < 2:
                    continue
                
                # Header row contains times
                header_row = [str(cell or '').strip() for cell in table[0]]
                time_slots = []
                for idx, cell in enumerate(header_row):
                    if idx == 0:
                        time_slots.append(None) # first column is Day
                        continue
                    times = parse_time_header(cell)
                    time_slots.append(times)
                    
                # Parse day rows
                for row_idx in range(1, len(table)):
                    row = table[row_idx]
                    if not row:
                        continue
                    day_cell = str(row[0] or '').strip().lower()
                    
                    # Match day name
                    matched_day = None
                    for k, v in DAY_MAP.items():
                        if k in day_cell:
                            matched_day = v
                            break
                    if not matched_day:
                        continue
                        
                    for col_idx in range(1, min(len(row), len(time_slots))):
                        cell_content = str(row[col_idx] or '').strip()
                        if not cell_content or 'LUNCH' in cell_content.upper() or 'BREAK' in cell_content.upper():
                            continue
                            
                        time_range = time_slots[col_idx]
                        if not time_range:
                            continue
                            
                        # Parse subjects inside cell
                        entries = parse_cell(cell_content)
                        for entry in entries:
                            name = entry['name'] or entry['code']
                            if not name:
                                continue
                            
                            # Clean up name (e.g. "SE Lab" -> "SE Lab", "TOC Tut" -> "TOC Tut")
                            # If name has code like "CSN5003", clean it
                            key = (name.lower(), entry['code'].lower())
                            
                            if key not in subjects_dict:
                                subjects_dict[key] = {
                                    'name': name,
                                    'code': entry['code'],
                                    'instructor': entry['instructor'],
                                    'credits': None,
                                    'schedule': []
                                }
                                
                            subjects_dict[key]['schedule'].append({
                                'day': matched_day,
                                'startTime': time_range[0],
                                'endTime': time_range[1],
                                'room': entry['room']
                            })
                            
    # Format to standard JSON
    subjects_list = list(subjects_dict.values())
    return {"subjects": subjects_list}

if __name__ == '__main__':
    if len(sys.argv) < 2:
        print("Usage: parseTimetable.py <pdf_path>")
        sys.exit(1)
        
    pdf_path = sys.argv[1]
    try:
        res = parse_pdf(pdf_path)
        print(json.dumps(res, indent=2))
    except Exception as e:
        print(json.dumps({"error": str(e)}))
        sys.exit(1)
