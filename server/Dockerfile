FROM node:20-slim

# Install system dependencies for OCR (Tesseract, Poppler, OpenCV)
RUN apt-get update && apt-get install -y \
    tesseract-ocr \
    poppler-utils \
    libgl1 \
    libglib2.0-0 \
    python3 \
    python3-pip \
    python3-dev \
    && rm -rf /var/lib/apt/lists/*

# Install Python dependencies into a venv to avoid PEP 668 issues
RUN python3 -m pip install --no-cache-dir --break-system-packages \
    pdf2image \
    pytesseract \
    opencv-python-headless \
    pdfplumber \
    Pillow \
    numpy

WORKDIR /app

# Copy package files first for better layer caching
COPY package*.json ./

# Skip postinstall (pip deps already installed above)
RUN npm install --production --ignore-scripts

# Copy the rest of the server code
COPY . .

EXPOSE 5000
CMD ["node", "server.js"]
