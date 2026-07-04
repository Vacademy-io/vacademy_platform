# Vacademy AI voice-bot service. Real-time audio loop — deploy in ap-south-1
# (Plivo India media anchoring) with a public WSS ingress.
FROM python:3.12-slim

WORKDIR /srv

# torch/onnx (Silero VAD) need build essentials on slim images.
RUN apt-get update && apt-get install -y --no-install-recommends \
    build-essential \
    && rm -rf /var/lib/apt/lists/*

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY app ./app

EXPOSE 8090
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8090"]
