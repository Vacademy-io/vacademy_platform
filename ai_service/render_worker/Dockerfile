FROM python:3.11-slim-bookworm

# System deps for Playwright (Chromium) and FFmpeg
RUN apt-get update && apt-get install -y --no-install-recommends \
    ffmpeg \
    libnss3 libnspr4 libatk1.0-0 libatk-bridge2.0-0 \
    libcups2 libdrm2 libxkbcommon0 libxcomposite1 libxdamage1 \
    libxfixes3 libxrandr2 libgbm1 libpango-1.0-0 libcairo2 \
    libasound2 libgtk-3-0 fonts-liberation fonts-noto-color-emoji \
    wget curl \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt
RUN playwright install chromium

# Copy the render worker code
COPY . .

# Copy generate_video.py and its dependencies from the main pipeline
# These are copied at build time from the parent ai_service directory
COPY ai-video-gen-main/ ./ai-video-gen-main/

EXPOSE 8090

CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8090", "--workers", "1"]
