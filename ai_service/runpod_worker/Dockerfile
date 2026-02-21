FROM runpod/pytorch:2.2.1-py3.10-cuda12.1.1-devel-ubuntu22.04

# Keep tzdata non-interactive
ENV DEBIAN_FRONTEND=noninteractive

# Install System Requirements
RUN apt-get update && apt-get install -y \
    git \
    git-lfs \
    ffmpeg \
    libsm6 \
    libxext6 \
    wget \
    curl \
    unzip \
    && rm -rf /var/lib/apt/lists/*

# Setup Workspace
WORKDIR /workspace

# Clone EchoMimic V3 (AntGroup)
RUN git clone https://github.com/antgroup/echomimic_v3.git
WORKDIR /workspace/echomimic_v3

# Upgrade pip and install standard RunPod/Boto3 wrappers
RUN pip install --upgrade pip
RUN pip install runpod boto3

# Fix opencv dependency issue commonly found on fresh Linux headless installs
RUN sed -i 's/opencv-python/opencv-python-headless/' requirements.txt

# Install V3 specific dependencies
RUN pip install -r requirements.txt

# TF 2.16+ moved keras to a standalone package (keras 3.x), removing tensorflow.keras.
# tf-keras is the official Google compatibility shim that restores tensorflow.keras
# for legacy packages like retinaface that import from tensorflow.keras.models.
RUN pip install tf-keras

# Install huggingface_hub for runtime model downloads (handler.py downloads on first boot)
RUN pip install "huggingface_hub[cli,hf_transfer]"

# Enable extreme download speeds via hf_transfer at runtime
ENV HF_HUB_ENABLE_HF_TRANSFER=1

# Models are NOT downloaded at build time to avoid the 30-minute builder timeout.
# handler.py downloads them to /runpod-volume (Network Volume) on first cold start,
# then symlinks /workspace/echomimic_v3/models → /runpod-volume/echomimic_models.
# Subsequent starts skip the download entirely.

WORKDIR /workspace/echomimic_v3

# Copy CLI wrapper injected over V3 infer_preview.py
# Paths are relative to repo root (RunPod GitHub builder sets context = repo root)
COPY ai_service/runpod_worker/infer_audio2vid_cli.py /workspace/echomimic_v3/infer_audio2vid_cli.py

# Copy out Serverless Handler
COPY ai_service/runpod_worker/handler.py /workspace/echomimic_v3/handler.py

# Start the built-in RunPod listener automatically
CMD python -u /workspace/echomimic_v3/handler.py
