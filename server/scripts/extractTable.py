import pdfplumber
import json
import sys
import io

def clean_table(table):
    if not table:
        return []
    cleaned_table = []
    for row in table:
        cleaned_row = [str(cell or '').strip() for cell in row]
        if any(cleaned_row):
            cleaned_table.append(cleaned_row)
    return cleaned_table

def main():
    try:
        # Read PDF data from stdin
        input_data = sys.stdin.buffer.read()
        if not input_data:
            print(json.dumps({"error": "No input data received via stdin."}))
            sys.exit(1)
            
        with pdfplumber.open(io.BytesIO(input_data)) as pdf:
            pages_data = []
            for i, page in enumerate(pdf.pages):
                tables = page.extract_tables()
                
                # If explicit lines return no tables, fallback to text/spatial strategy
                if not tables:
                    try:
                        tables = page.extract_tables(table_settings={
                            "vertical_strategy": "text",
                            "horizontal_strategy": "text",
                            "snap_tolerance": 3
                        })
                    except Exception:
                        tables = []
                
                cleaned_tables = []
                if tables:
                    for table in tables:
                        c_table = clean_table(table)
                        if c_table:
                            cleaned_tables.append(c_table)
                
                # Also extract layout-preserved text for text-based parsing
                layout_text = ""
                try:
                    layout_text = page.extract_text(layout=True) or ""
                except Exception:
                    try:
                        layout_text = page.extract_text() or ""
                    except Exception:
                        layout_text = ""
                
                pages_data.append({
                    "page": i + 1,
                    "tables": cleaned_tables,
                    "text": layout_text
                })
            
            print(json.dumps({"pages": pages_data}))
            
    except Exception as e:
        print(json.dumps({"error": str(e)}))
        sys.exit(1)

if __name__ == '__main__':
    main()

