FROM python:3.11-slim-bookworm

# System deps for Playwright (Chromium), FFmpeg and LibreOffice.
#
# Fonts matter for pptx->slide rendering: PowerPoint decks are overwhelmingly
# Calibri/Cambria, and without metric-compatible faces LibreOffice substitutes a
# font with different metrics, so text reflows and drifts out of alignment in the
# rendered slides. Carlito == Calibri, Caladea == Cambria, Liberation ==
# Arial/Times/Courier.
RUN apt-get update && apt-get install -y --no-install-recommends \
    ffmpeg \
    libnss3 libnspr4 libatk1.0-0 libatk-bridge2.0-0 \
    libcups2 libdrm2 libxkbcommon0 libxcomposite1 libxdamage1 \
    libxfixes3 libxrandr2 libgbm1 libpango-1.0-0 libcairo2 \
    libasound2 libgtk-3-0 fonts-liberation fonts-noto fonts-noto-color-emoji \
    libsndfile1 \
    libreoffice-impress libreoffice-core \
    fonts-crosextra-carlito fonts-crosextra-caladea fonts-dejavu \
    wget curl \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

COPY requirements.txt .
RUN pip install --upgrade pip && \
    pip install --no-cache-dir -r requirements.txt
# Install Google Chrome (NOT Chromium) — includes H.264/AAC proprietary codecs
# Playwright's bundled Chromium lacks these codecs due to patent licensing
RUN playwright install chrome --with-deps

# Copy the render worker code
COPY . .

# Copy generate_video.py and its dependencies from the main pipeline
# These are copied at build time from the parent ai_service directory
COPY ai-video-gen-main/ ./ai-video-gen-main/

EXPOSE 8090

CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8090", "--workers", "1"]
