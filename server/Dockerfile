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
#   libcairo2-dev / libpango1.0-dev / libpangocairo-1.0-0 / libjpeg-dev / libgif-dev
#                   — build deps for the `canvas` npm package (pdfjs PDF→image rendering)
RUN apt-get update && apt-get install -y --no-install-recommends \
      python3 \
      python3-pip \
      tesseract-ocr \
      poppler-utils \
      libgl1 \
      libglib2.0-0 \
      libcairo2-dev \
      libpango1.0-dev \
      libpangocairo-1.0-0 \
      libjpeg-dev \
      libgif-dev \
      libpixman-1-dev \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Copy dependency manifests first (both Node and Python)
COPY package*.json ./
COPY requirements.txt ./

# Install Python deps first (pip3, break-system-packages needed on Debian bookworm)
RUN pip3 install --break-system-packages -r requirements.txt

# Install Node deps (skip postinstall pip step since we already ran it above)
RUN npm ci --omit=dev --ignore-scripts

# Now the rest of the source
COPY . .

ENV NODE_ENV=production
EXPOSE 5000

CMD ["node", "server.js"]
