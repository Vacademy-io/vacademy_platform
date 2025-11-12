FROM python:3.11-slim

WORKDIR /app

# Prevents Python from writing .pyc files and buffering stdout/err
ENV PYTHONDONTWRITEBYTECODE=1
ENV PYTHONUNBUFFERED=1

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY . .

EXPOSE 8077

CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8077"]


