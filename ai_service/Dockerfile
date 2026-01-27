FROM python:3.11-slim

WORKDIR /app

# Prevents Python from writing .pyc files and buffering stdout/err
ENV PYTHONDONTWRITEBYTECODE=1
ENV PYTHONUNBUFFERED=1
ENV PYTHONPATH=/app
ARG APP_ENV=stage
ENV APP_ENV=${APP_ENV}

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt
RUN playwright install --with-deps chromium

COPY . /app/ai_service

EXPOSE 8077

CMD ["uvicorn", "ai_service.main:app", "--host", "0.0.0.0", "--port", "8077"]


