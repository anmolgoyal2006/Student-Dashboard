import pdfplumber
import json
import sys
import io

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
                if tables:
                    # Clean up tables (strip cells)
                    cleaned_tables = []
                    for table in tables:
                        cleaned_table = []
                        for row in table:
                            cleaned_row = [str(cell or '').strip() for cell in row]
                            cleaned_table.append(cleaned_row)
                        cleaned_tables.append(cleaned_table)
                    pages_data.append({
                        "page": i + 1,
                        "tables": cleaned_tables
                    })
            
            print(json.dumps({"pages": pages_data}))
            
    except Exception as e:
        print(json.dumps({"error": str(e)}))
        sys.exit(1)

if __name__ == '__main__':
    main()
