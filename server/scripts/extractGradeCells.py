#!/usr/bin/env python3
"""Render scanned grade-list PDFs and crop student table cells for OCR.
Robust multi-strategy detection: grid lines + text-row fallback + adaptive columns."""

import json
import os
import sys
from pathlib import Path

import cv2
import numpy as np
import pypdfium2 as pdfium


def groups(values, gap=4):
    if len(values) == 0:
        return []
    out = []
    start = prev = int(values[0])
    for raw in values[1:]:
        value = int(raw)
        if value > prev + gap:
            out.append((start, prev, (start + prev) // 2))
            start = value
        prev = value
    out.append((start, prev, (start + prev) // 2))
    return out


def deskew(image):
    try:
        gray = cv2.cvtColor(image, cv2.COLOR_RGB2GRAY)
        _, thresh = cv2.threshold(gray, 0, 255, cv2.THRESH_BINARY_INV + cv2.THRESH_OTSU)
        coords = np.column_stack(np.where(thresh > 0))
        if len(coords) < 100:
            return image
        rect = cv2.minAreaRect(coords)
        angle = rect[-1]
        if angle < -45:
            angle = -(90 + angle)
        elif angle > 45:
            angle = 90 - angle
        else:
            angle = -angle
        if 0.2 <= abs(angle) <= 15:
            h, w = image.shape[:2]
            center = (w // 2, h // 2)
            M = cv2.getRotationMatrix2D(center, angle, 1.0)
            rotated = cv2.warpAffine(image, M, (w, h), flags=cv2.INTER_CUBIC, borderMode=cv2.BORDER_REPLICATE)
            return rotated
    except Exception as e:
        sys.stderr.write(f"Deskew error: {str(e)}\n")
    return image


# ─── ROW DETECTION STRATEGIES ───────────────────────────────────────────────

def detect_rows_by_horizontal_lines(page_image):
    """Detect row positions using horizontal grid/underline lines."""
    gray = cv2.cvtColor(page_image, cv2.COLOR_RGB2GRAY)
    _, threshold = cv2.threshold(gray, 200, 255, cv2.THRESH_BINARY_INV)
    height, width = gray.shape

    # Try multiple kernel sizes for robustness
    y_candidates = set()
    for kernel_width_factor in [18, 12, 8]:
        k_w = max(40, width // kernel_width_factor)
        kernel = cv2.getStructuringElement(cv2.MORPH_RECT, (k_w, 1))
        horiz = cv2.morphologyEx(threshold, cv2.MORPH_OPEN, kernel)
        min_pixels = max(20, width * 0.015)
        ys = np.where(horiz.sum(axis=1) > 255 * min_pixels)[0]
        for g in groups(ys):
            y_candidates.add(g[2])

    ys_sorted = sorted(y_candidates)
    # Filter: must be in the main table region
    margin = height * 0.12
    ys_sorted = [y for y in ys_sorted if margin <= y <= height - margin]

    # Merge nearby lines (within 8px)
    if not ys_sorted:
        return []
    merged = [ys_sorted[0]]
    for y in ys_sorted[1:]:
        if y - merged[-1] > 8:
            merged.append(y)
    return merged


def detect_rows_by_text_projection(page_image):
    """Fallback: detect rows by analyzing horizontal text bands."""
    gray = cv2.cvtColor(page_image, cv2.COLOR_RGB2GRAY)
    # Use Otsu for adaptive thresholding
    _, binary = cv2.threshold(gray, 0, 255, cv2.THRESH_BINARY_INV + cv2.THRESH_OTSU)
    height, width = binary.shape

    # Horizontal projection profile
    h_proj = binary.sum(axis=1) / 255
    # A row should have substantial ink
    threshold = np.percentile(h_proj[h_proj > 0], 40) if np.any(h_proj > 0) else width * 0.02
    threshold = max(threshold, width * 0.01)

    in_row = False
    row_starts = []
    row_ends = []
    for y in range(height):
        above = h_proj[y] > threshold
        if above and not in_row:
            row_starts.append(y)
            in_row = True
        elif not above and in_row:
            row_ends.append(y)
            in_row = False
    if in_row:
        row_ends.append(height - 1)

    # Build row midpoints from text bands
    band_centers = []
    for s, e in zip(row_starts, row_ends):
        band_height = e - s
        if 10 <= band_height <= height * 0.08:
            band_centers.append((s + e) // 2)

    return band_centers


def detect_rows_adaptive(page_image):
    """Try grid-line detection first, fall back to text projection."""
    ys = detect_rows_by_horizontal_lines(page_image)
    if len(ys) >= 3:
        return ys, "grid_lines"

    ys = detect_rows_by_text_projection(page_image)
    if len(ys) >= 3:
        return ys, "text_projection"

    return ys, "none"


# ─── COLUMN DETECTION ────────────────────────────────────────────────────────

def merge_close(values, max_gap=20):
    """Merge values that are very close together (double-edged lines)."""
    if not values:
        return []
    sorted_vals = sorted(values)
    merged = [sorted_vals[0]]
    for v in sorted_vals[1:]:
        if v - merged[-1] <= max_gap:
            merged[-1] = (merged[-1] + v) // 2
        else:
            merged.append(v)
    return merged


def detect_columns_by_grid(page_image, row_ys):
    """Detect vertical column boundaries using grid lines near the rows."""
    gray = cv2.cvtColor(page_image, cv2.COLOR_RGB2GRAY)
    _, threshold = cv2.threshold(gray, 180, 255, cv2.THRESH_BINARY_INV)
    h, w = gray.shape

    if len(row_ys) >= 2:
        top = max(0, row_ys[0] - 20)
        bottom = min(h, row_ys[-1] + 20)
    else:
        top, bottom = int(h * 0.15), int(h * 0.90)

    region = threshold[top:bottom, :]
    region_h = region.shape[0]

    vert_kernel = cv2.getStructuringElement(
        cv2.MORPH_RECT,
        (1, max(15, region_h // 4)),
    )
    vert = cv2.morphologyEx(region, cv2.MORPH_OPEN, vert_kernel)
    min_pixels = max(8, region_h * 0.15)
    xs = np.where(vert.sum(axis=0) > 255 * min_pixels)[0]
    x_groups = groups(xs, gap=3)
    x_centers = [g[2] for g in x_groups]
    x_centers = [x for x in x_centers if 0 <= x <= w]

    if not x_centers:
        return []

    x_centers = merge_close(x_centers, max_gap=20)

    if 4 <= len(x_centers) <= 6:
        gaps = [x_centers[i+1] - x_centers[i] for i in range(len(x_centers)-1)]
        min_gap = w * 0.03
        max_gap = w * 0.45
        if all(min_gap <= g <= max_gap for g in gaps):
            if x_centers[-1] < w * 0.80:
                x_centers.append(w - 8)
            elif x_centers[-1] < w - 40:
                x_centers.append(w - 8)
            return x_centers

    if len(x_centers) >= 4:
        return x_centers

    return []


def build_column_regions(x_centers, width):
    """Map detected vertical lines to logical columns (sid, name, units, grade)."""
    if len(x_centers) < 4:
        return None

    x = sorted(x_centers)
    num_cols = len(x)

    def validate(col_map):
        for key, (left, right) in col_map.items():
            if right - left < width * 0.02:
                return False
        return True
# This PDF format: Sr.No. | SID | Student Name | Units | Grade
    # That gives 6 vertical lines → 5 columns (indices 0-4)
    # Always take the LAST column as grade, second-last as units

    if num_cols >= 6:
        # 5 columns: srno | sid | name | units | grade
        col_map = {
            "sid":   (x[1], x[2]),
            "name":  (x[2], x[3]),
            "units": (x[3], x[4]),
            "grade": (x[4], min(x[5], x[4] + int(width * 0.18))),
        }
        if validate(col_map):
            return col_map

    if num_cols == 5:
        # 4 columns: sid | name | units | grade
        col_map = {
            "sid":   (x[0], x[1]),
            "name":  (x[1], x[2]),
            "units": (x[2], x[3]),
            "grade": (x[3], min(x[4], x[3] + int(width * 0.18))),
        }
        if validate(col_map):
            return col_map

    if num_cols == 4:
        col_map = {
            "sid":   (x[0], x[1]),
            "name":  (x[1], x[2]),
            "units": (x[2], x[3]),
            "grade": (x[3], min(width - 8, x[3] + int(width * 0.18))),
        }
        if validate(col_map):
            return col_map

    return None


def build_column_regions_fallback(width):
    """Hardcoded percentage-based column regions as last resort."""
    return {
        "sid": (int(width * 0.18), int(width * 0.36)),
        "name": (int(width * 0.34), int(width * 0.72)),
        "units": (int(width * 0.70), int(width * 0.82)),
        "grade": (int(width * 0.80), int(width * 0.96)),
    }


# ─── CELL CROPPING ──────────────────────────────────────────────────────────

def save_cell(image, path):
    Path(path).parent.mkdir(parents=True, exist_ok=True)
    cv2.imwrite(str(path), cv2.cvtColor(image, cv2.COLOR_RGB2BGR))


def extract_cells(pdf_path, output_dir):
    output = []
    doc = pdfium.PdfDocument(pdf_path)
    out_dir = Path(output_dir)
    out_dir.mkdir(parents=True, exist_ok=True)

    for page_index in range(len(doc)):
        page = doc[page_index]
        pil_image = page.render(scale=3).to_pil().convert("RGB")
        page_image = np.array(pil_image)
        page_image = deskew(page_image)
        height, width = page_image.shape[:2]

        page_path = out_dir / f"page{page_index + 1}.png"
        save_cell(page_image, page_path)

        # ── Row detection ──
        ys, method = detect_rows_adaptive(page_image)
        debug = {"page": page_index + 1, "row_method": method, "rows_found": len(ys)}

        if len(ys) < 3:
            output.append({
                "page": page_index + 1,
                "pageImage": str(page_path),
                "rows": [],
                "debug": debug,
            })
            continue

        # ── Column detection ──
        x_centers = detect_columns_by_grid(page_image, ys)
        col_regions = build_column_regions(x_centers, width)
        if col_regions is None:
            col_regions = build_column_regions_fallback(width)
            debug["column_method"] = "fallback_percentage"
        else:
            debug["column_method"] = "grid_detected"
            debug["x_centers"] = [int(x) for x in x_centers]

        debug["columns"] = {k: [int(v[0]), int(v[1])] for k, v in col_regions.items()}

        # ── Estimate typical row spacing ──
        gaps = [ys[i + 1] - ys[i] for i in range(len(ys) - 1)]
        median_gap = np.median(gaps) if gaps else 60
        min_row_h = int(median_gap * 0.25)
        max_row_h = int(median_gap * 1.5)
        debug["median_gap"] = int(median_gap)

        page_rows = []
        for row_idx in range(len(ys) - 1):
            top = ys[row_idx] + 2
            bottom = ys[row_idx + 1] - 2
            row_height = bottom - top

            if row_height < min_row_h or row_height > max_row_h:
                continue

            row_cells = {}
            for key, (left, right) in col_regions.items():
                if key == "extra":
                    continue
                pad_x = 10 if key != "grade" else 2
                crop_left = max(0, left + pad_x)
                crop_right = min(width, right - pad_x)
                crop_top = max(0, top)
                crop_bottom = min(height, bottom)

                if crop_right <= crop_left or crop_bottom <= crop_top:
                    continue

                cell = page_image[crop_top:crop_bottom, crop_left:crop_right]
                if cell.size == 0:
                    continue

                cell_path = out_dir / f"page{page_index + 1}_row{row_idx}_{key}.png"
                save_cell(cell, cell_path)
                row_cells[key] = str(cell_path)

            if len(row_cells) >= 3:
                page_rows.append(row_cells)

        output.append({
            "page": page_index + 1,
            "pageImage": str(page_path),
            "rows": page_rows,
            "debug": debug,
        })

    return output


if __name__ == "__main__":
    if len(sys.argv) < 3:
        print(json.dumps({"error": "Usage: extractGradeCells.py <pdf_path> <output_dir>"}))
        sys.exit(1)

    try:
        result = extract_cells(sys.argv[1], sys.argv[2])
        print(json.dumps(result))
    except Exception as exc:
        print(json.dumps({"error": str(exc)}))
        sys.exit(1)
