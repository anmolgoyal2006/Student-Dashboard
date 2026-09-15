#!/usr/bin/env python3
"""
Table Transformer (TATR) wrapper for automatic table structure detection.
Local-only dependency – not used in production/Render.
"""

import os
import sys
import time
import numpy as np
from PIL import Image

# Lazy imports – only loaded when TATR is actually used
_TATR_AVAILABLE = None
_MODEL = None
_PROCESSOR = None
_DEVICE = None

def is_tatr_available():
    """Check if Table Transformer dependencies are installed."""
    global _TATR_AVAILABLE
    if _TATR_AVAILABLE is not None:
        return _TATR_AVAILABLE
    try:
        import torch
        from transformers import DetrImageProcessor, DetrForObjectDetection
        # Quick version check
        _TATR_AVAILABLE = True
        return True
    except ImportError as e:
        sys.stderr.write(f"[TATR] Dependencies not available: {e}\n")
        _TATR_AVAILABLE = False
        return False

def load_tatr():
    """
    Load the Table Transformer model once per process.
    Returns (model, processor, device) or (None, None, None) if unavailable.
    """
    global _MODEL, _PROCESSOR, _DEVICE
    if not is_tatr_available():
        return None, None, None
    if _MODEL is not None:
        return _MODEL, _PROCESSOR, _DEVICE

    try:
        import torch
        from transformers import DetrImageProcessor, DetrForObjectDetection, DetrConfig
        from transformers import __version__ as transformers_version

        device = "cuda" if torch.cuda.is_available() else "cpu"
        sys.stderr.write(f"[TATR] Loading model on {device}...\n")
        sys.stderr.write(f"[TATR] transformers version: {transformers_version}\n")
        start = time.time()

        model_name = "microsoft/table-transformer-structure-recognition-v1.1-all"
        processor = DetrImageProcessor.from_pretrained(model_name)

        # Load config and patch dilation fields
        config = DetrConfig.from_pretrained(model_name)
        # Recursively fix None values in dilation fields
        def fix_dilation(obj):
            if isinstance(obj, dict):
                for k, v in obj.items():
                    if k == 'dilation' and v is None:
                        obj[k] = False
                    else:
                        fix_dilation(v)
            elif isinstance(obj, list):
                for item in obj:
                    fix_dilation(item)
        # Convert config to dict and back to fix nested structures
        config_dict = config.to_dict()
        fix_dilation(config_dict)
        # Recreate config from patched dict
        patched_config = DetrConfig.from_dict(config_dict)

        model = DetrForObjectDetection.from_pretrained(model_name, config=patched_config).to(device)
        model.eval()

        load_time = time.time() - start
        sys.stderr.write(f"[TATR] Model loaded in {load_time:.2f}s on {device}\n")

        _MODEL = model
        _PROCESSOR = processor
        _DEVICE = device
        return model, processor, device

    except Exception as e:
        sys.stderr.write(f"[TATR] Failed to load model: {e}\n")
        _MODEL = None
        _PROCESSOR = None
        _DEVICE = None
        return None, None, None

def detect_table_structure(image_np, threshold=0.5):
    """
    Detect table structure from a numpy image (RGB).
    Returns a dict with:
        - table_bbox: (x1, y1, x2, y2) in pixels, or None
        - rows: list of row bounding boxes [(x1,y1,x2,y2), ...]
        - cols: list of column bounding boxes [(x1,y1,x2,y2), ...]
        - cells: list of cell bounding boxes [(x1,y1,x2,y2), ...]
        - cell_labels: list of labels for each cell (e.g., "table row", "table column")
        - table_detected: bool
    """
    model, processor, device = load_tatr()
    if model is None:
        return {
            'table_bbox': None,
            'rows': [],
            'cols': [],
            'cells': [],
            'cell_labels': [],
            'table_detected': False,
            'error': 'TATR not available'
        }

    try:
        import torch
        from PIL import Image

        # Convert numpy to PIL
        if isinstance(image_np, np.ndarray):
            pil_img = Image.fromarray(image_np)
        else:
            pil_img = image_np

        # Prepare inputs
        inputs = processor(images=pil_img, return_tensors="pt").to(device)

        # Inference
        with torch.no_grad():
            outputs = model(**inputs)

        # Post-process
        target_sizes = torch.tensor([pil_img.size[::-1]]).to(device)
        results = processor.post_process_object_detection(
            outputs, target_sizes=target_sizes, threshold=threshold
        )[0]

        # Parse results
        boxes = results['boxes'].cpu().numpy()
        scores = results['scores'].cpu().numpy()
        labels = results['labels'].cpu().numpy()

        # Map label IDs to class names
        # Standard COCO classes for table detection
        class_map = {
            0: 'table',
            1: 'table row',
            2: 'table column',
            3: 'table cell',
            4: 'table header',
            5: 'table projected row header',
            6: 'table spanning cell',
        }

        rows = []
        cols = []
        cells = []
        cell_labels = []
        table_bbox = None

        for box, score, label_id in zip(boxes, scores, labels):
            x1, y1, x2, y2 = box
            label_name = class_map.get(label_id, f'class_{label_id}')

            # Convert to ints
            x1, y1, x2, y2 = int(x1), int(y1), int(x2), int(y2)

            if label_name == 'table':
                table_bbox = (x1, y1, x2, y2)
            elif label_name == 'table row':
                rows.append((x1, y1, x2, y2))
            elif label_name == 'table column':
                cols.append((x1, y1, x2, y2))
            elif label_name in ('table cell', 'table header'):
                cells.append((x1, y1, x2, y2))
                cell_labels.append(label_name)

        # If no table detected, but we have rows/cells, try to infer table bounds
        if table_bbox is None and (rows or cells):
            all_boxes = rows + cells
            x1 = min(b[0] for b in all_boxes)
            y1 = min(b[1] for b in all_boxes)
            x2 = max(b[2] for b in all_boxes)
            y2 = max(b[3] for b in all_boxes)
            table_bbox = (x1, y1, x2, y2)

        return {
            'table_bbox': table_bbox,
            'rows': rows,
            'cols': cols,
            'cells': cells,
            'cell_labels': cell_labels,
            'table_detected': table_bbox is not None or len(rows) > 0 or len(cells) > 0,
            'error': None
        }

    except Exception as e:
        sys.stderr.write(f"[TATR] Detection error: {e}\n")
        return {
            'table_bbox': None,
            'rows': [],
            'cols': [],
            'cells': [],
            'cell_labels': [],
            'table_detected': False,
            'error': str(e)
        }

def find_grade_cell(gray_cell, table_structure):
    """
    Given a cell image and table structure, find the grade column.
    This is a stub – the main extraction logic will handle column identification.
    """
    # The main script will handle column identification using header row OCR
    pass

if __name__ == "__main__":
    # Quick test
    import cv2
    if len(sys.argv) > 1:
        img_path = sys.argv[1]
        img = cv2.imread(img_path)
        if img is not None:
            img_rgb = cv2.cvtColor(img, cv2.COLOR_BGR2RGB)
            result = detect_table_structure(img_rgb)
            print(f"Table detected: {result['table_detected']}")
            print(f"Rows: {len(result['rows'])}")
            print(f"Cols: {len(result['cols'])}")
            print(f"Cells: {len(result['cells'])}")
            if result['table_bbox']:
                x1,y1,x2,y2 = result['table_bbox']
                print(f"Table bbox: ({x1},{y1}) -> ({x2},{y2})")
        else:
            print(f"Could not load image: {img_path}")
    else:
        print("Usage: python table_detector.py <image_path>")
        print("Check if TATR is available...")
        print(f"TATR available: {is_tatr_available()}")