import os, sys
sys.path.insert(0, 'server/scripts')
os.chdir(os.path.dirname(os.path.abspath(__file__)))
from extractGradeCells import *

import numpy as np
import cv2
import pypdfium2 as pdfium

pdf_path = 'test.pdf'
out_dir = 'test_cells_output'
os.makedirs(out_dir, exist_ok=True)

doc = pdfium.PdfDocument(pdf_path)
for page_index in range(len(doc)):
    page = doc[page_index]
    pil_image = page.render(scale=3).to_pil().convert("RGB")
    page_image = np.array(pil_image)
    page_image = deskew(page_image)
    height, width = page_image.shape[:2]
    
    print(f"\n=== Page {page_index+1} ({width}x{height}) ===")
    
    # Detect rows
    ys = detect_rows_by_horizontal_lines(page_image)
    print(f"  Grid-line rows: {len(ys)}")
    if len(ys) >= 3:
        print(f"  Y centers: {[int(y) for y in ys[:10]]}...")
    
    ys_text = detect_rows_by_text_projection(page_image)
    print(f"  Text-projection rows: {len(ys_text)}")
    if len(ys_text) >= 3:
        print(f"  Y centers: {[int(y) for y in ys_text[:10]]}...")
    
    # Detect columns
    x_centers = detect_columns_by_grid(page_image, ys if len(ys) >= 3 else ys_text)
    print(f"  Column X centers: {[int(x) for x in x_centers]}")
    
    col_map = build_column_regions(x_centers, width)
    if col_map:
        print(f"  Column regions: { {k: [int(v[0]), int(v[1])] for k,v in col_map.items()} }")
    else:
        fallback = build_column_regions_fallback(width)
        print(f"  Using fallback: { {k: [int(v[0]), int(v[1])] for k,v in fallback.items()} }")
