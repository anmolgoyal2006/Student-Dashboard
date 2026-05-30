import os, sys
sys.path.insert(0, 'server/scripts')
os.chdir(os.path.dirname(os.path.abspath(__file__)))
from extractGradeCells import extract_cells

result = extract_cells('test.pdf', 'test_cells_output')
for p in result:
    debug = p.get('debug', {})
    print(f"Page {p['page']}: {len(p['rows'])} rows, method={debug.get('row_method','?')}, cols={debug.get('column_method','?')}, median_gap={debug.get('median_gap','?')}")
    # Check first and last row Y positions
    if p.get('rows') and len(p['rows']) > 0:
        print(f"  First row cells: {list(p['rows'][0].keys())}")

print(f"\nTotal pages: {len(result)}")
print(f"Total rows: {sum(len(p['rows']) for p in result)}")
