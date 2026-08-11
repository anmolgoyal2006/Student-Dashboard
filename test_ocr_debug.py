import os, sys
sys.path.insert(0, 'server/scripts')
os.chdir(os.path.dirname(os.path.abspath(__file__)))
from extractGradeCells import *

import numpy as np
import cv2
import pypdfium2 as pdfium

pdf_path = 'Timetable (CSE3, G1).pdf'
out_dir = 'test_cells_output'
os.makedirs(out_dir, exist_ok=True)

doc = pdfium.PdfDocument(pdf_path)
for page_index in range(len(doc)):
    page = doc[page_index]
    pil_image = page.render(scale=3).to_pil().convert("RGB")
    page_image = np.array(pil_image)
    bgr = cv2.cvtColor(page_image, cv2.COLOR_RGB2BGR)
    gray = cv2.cvtColor(bgr, cv2.COLOR_BGR2GRAY)
    height, width = gray.shape[:2]

    print(f"\n=== Page {page_index+1} ({width}x{height}) ===")

    # Detect rows
    ys = detect_horizontal_lines(gray)
    print(f"  Grid-line rows: {len(ys)}")
    if len(ys) >= 3:
        print(f"  Y centers: {[int(y) for y in ys[:10]]}...")

    bands = detect_rows_by_projection(gray)
    merged = merge_nearby_bands(bands, gap=8)
    print(f"  Text-projection bands: {len(merged)}")
    if len(merged) >= 3:
        print(f"  Bands: {[(int(y1), int(y2)) for y1, y2 in merged[:10]]}...")

    # Detect columns
    col_map = map_columns([], width)
    print(f"  Column regions: { {k: [int(v[0]), int(v[1])] for k, v in col_map.items()} }")
