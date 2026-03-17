FROM python:3.11-slim-bookworm

WORKDIR /app

# Prevents Python from writing .pyc files and buffering stdout/err
ENV PYTHONDONTWRITEBYTECODE=1
ENV PYTHONUNBUFFERED=1
ENV PYTHONPATH=/app
ARG APP_ENV=stage
ENV APP_ENV=${APP_ENV}

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt
# Install system dependencies for Playwright (Chromium) manually
# Install system dependencies for Playwright (Chromium) manually
# Using libgtk-3-0 to pull in most GUI dependencies including atk/atspi
RUN apt-get update && apt-get install -y \
    libnss3 \
    libnspr4 \
    libatk1.0-0 \
    libatk-bridge2.0-0 \
    libcups2 \
    libdrm2 \
    libxkbcommon0 \
    libxcomposite1 \
    libxdamage1 \
    libxfixes3 \
    libxrandr2 \
    libgbm1 \
    libpango-1.0-0 \
    libcairo2 \
    libasound2 \
    libxshmfence1 \
    libglu1-mesa \
    fonts-liberation \
    libgtk-3-0 \
    && rm -rf /var/lib/apt/lists/*

RUN playwright install chromium

COPY . /app/ai_service

EXPOSE 8077

CMD ["uvicorn", "ai_service.main:app", "--host", "0.0.0.0", "--port", "8077"]


