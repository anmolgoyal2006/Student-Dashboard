# Backend image: Node (Express API) + Python (PDF/OCR parsing scripts) + Tesseract/Poppler.
# The API itself is Node, but marksUploadController.js/ocrGradePdfParser.js spawn
# server/scripts/{parsePdf,extractGradeCells}.py as child processes, so both
# runtimes are required in the same image — this isn't a Node-only app.

FROM node:20-bookworm-slim

# System deps for the Python OCR/PDF pipeline:
#   tesseract-ocr   — OCR engine (pytesseract wraps this binary; ships its own eng tessdata)
#   poppler-utils   — provides pdftoppm/pdftotext, used by pdf2image and referenced
#                      directly in ocrGradePdfParser.js's buildChildEnv() PATH lookup
#   libgl1 / libglib2.0-0 — common runtime deps for opencv-python-headless
RUN apt-get update && apt-get install -y --no-install-recommends \
      python3 \
      python3-pip \
      tesseract-ocr \
      poppler-utils \
      libgl1 \
      libglib2.0-0 \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Install Node deps first so this layer is cached unless package.json changes
COPY package*.json ./
RUN npm ci --omit=dev

# Install Python deps (Debian 12 marks the system Python as "externally managed" —
# --break-system-packages is safe here since this container has no other Python use)
COPY requirements.txt ./
RUN pip3 install --no-cache-dir --break-system-packages -r requirements.txt

# Now the rest of the source
COPY . .

ENV NODE_ENV=production
EXPOSE 5000

CMD ["node", "server.js"]
