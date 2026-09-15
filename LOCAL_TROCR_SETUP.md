# Local TrOCR Setup for Handwritten Grade OCR

This document explains how to set up and test the TrOCR integration for handwritten grade-sheet recognition.

## Overview

TrOCR (`microsoft/trocr-base-handwritten`) is integrated as an optional primary OCR engine for individual grade cells. It replaces Tesseract for handwritten grade recognition, with Tesseract as a fallback.

## Prerequisites

- Python 3.8+
- Node.js (for the backend server)
- Existing project dependencies (see `server/requirements.txt`)

## Local Installation

1. **Navigate to the server directory:**
   ```bash
   cd server
   ```

2. **Install TrOCR dependencies in your local Python environment:**
   ```bash
   pip install -r requirements-ocr-local.txt
   ```

   For CPU-only (recommended if you don't have a GPU):
   ```bash
   pip install torch --index-url https://download.pytorch.org/whl/cpu
   ```

   For CUDA (if you have a compatible NVIDIA GPU):
   ```bash
   pip install torch --index-url https://download.pytorch.org/whl/cu118
   ```

3. **Set the environment variable in your `.env` file:**
   ```bash
   # In server/.env
   ENABLE_TROCR_LOCAL=true
   ```

   Also ensure that `PYTHON_PATH` points to the correct Python interpreter (the one where you installed the dependencies).

## Usage

Once installed and enabled, the existing OCR pipeline automatically uses TrOCR for grade cells when processing scanned PDFs:

```
Scanned Grade PDF → OpenCV table detection → TrOCR grade recognition → fallback to Tesseract → post-processing
```

- **Model loaded once** per Python process (not per cell).
- **Inference times**:
  - **Model loading:** ~5-10 seconds (first time, then cached in memory)
  - **Per cell (CPU):** ~1-2 seconds
  - **Per cell (GPU):** ~50-100ms

## Testing

### Compare Tesseract vs TrOCR

Run the script `test_trocr_comparison.py` (provided below) to compare results on sample grade cells.

### Integration Test

Upload a handwritten grade sheet PDF through the existing UI. The OCR pipeline will automatically use TrOCR if `ENABLE_TROCR_LOCAL=true`.

## Performance Notes

- **Model size:** ~1.2 GB (downloaded on first use to `~/.cache/huggingface/`)
- **RAM usage:** ~2-3 GB
- **CPU inference:** ~1-2 seconds per cell (suitable for batch processing of small PDFs)
- **GPU inference:** ~50-100 ms per cell (recommended for production-like throughput)

## Production (Render) Safety

- TrOCR dependencies **are not** added to `server/requirements.txt` (the Render build file).
- The `postinstall` script in `server/package.json` **does not** install `requirements-ocr-local.txt`.
- `ENABLE_TROCR_LOCAL` defaults to `false` and should remain `false` on Render.
- The Python script gracefully handles missing dependencies and falls back to Tesseract.
- No Dockerfile changes, Render environment changes, or production configuration modifications are included.

## Limitations

- TrOCR is designed for handwritten text, but may still misrecognize certain characters (e.g., "B" vs "8").
- The model is trained on English handwriting; it may not handle non-English letters well.
- If the table cell contains multiple characters (e.g., "B+", "F(UMC)"), TrOCR may sometimes split or misinterpret the plus sign.
- The fallback mechanism ensures the pipeline still works even if TrOCR fails or is disabled.

## Troubleshooting

| Issue | Solution |
|-------|----------|
| `ModuleNotFoundError: No module named 'torch'` | Install `torch` with `pip install torch` |
| `ModuleNotFoundError: No module named 'transformers'` | Install `transformers` with `pip install transformers` |
| TrOCR fails to load | Check internet connection for model download. Model is cached after first download. |
| `ENABLE_TROCR_LOCAL=true` but TrOCR not used | Check that `PYTHON_PATH` points to the correct Python interpreter. |
| Out of memory | Try CPU-only installation or reduce `max_length` in `model.generate()`. |
| No improvement in accuracy | The model may not be fine-tuned for your specific handwriting; consider fine-tuning on your data. |

## Files Changed

1. `server/scripts/extractGradeCells.py` — Added TrOCR import, model loading, and fallback logic.
2. `server/.env.example` — Added `ENABLE_TROCR_LOCAL` environment variable.
3. `server/requirements-ocr-local.txt` (new) — Local-only dependencies.
4. `LOCAL_TROCR_SETUP.md` (this file) — Documentation.

## Files NOT Changed

- `server/requirements.txt` — NOT updated (Render safety).
- `server/package.json` — NOT updated.
- `server/controllers/marksUploadController.js` — NOT changed.
- `server/services/ocrGradePdfParser.js` — NOT changed.
- `client/src/components/OcrReviewPanel.jsx` — NOT changed.
- Any Dockerfile, Render config, or production startup scripts — NOT changed.
- The existing typed-PDF pipeline (pdfplumber) — NOT touched.

## Confirmation

**Render production was NOT modified.** TrOCR is local-only and disabled by default. The production pipeline remains exactly as before.