FROM --platform=linux/amd64 runpod/pytorch:2.2.1-py3.10-cuda12.1.1-devel-ubuntu22.04

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

# Download HuggingFace Pre-trained Weights using Git LFS (Warning: Massive Models!)
RUN git lfs install
RUN mkdir -p models
WORKDIR /workspace/echomimic_v3/models

RUN git clone https://huggingface.co/alibaba-pai/Wan2.1-Fun-V1.1-1.3B-InP
RUN git clone https://huggingface.co/facebook/wav2vec2-base-960h
RUN git clone https://huggingface.co/BadToBest/EchoMimicV3 preview_weights

# Construct the exact folder structure expected by V3
RUN mkdir -p transformer
RUN cp preview_weights/transformer/diffusion_pytorch_model.safetensors transformer/

WORKDIR /workspace/echomimic_v3

# Copy CLI wrapper injected over V3 infer_preview.py
COPY infer_audio2vid_cli.py /workspace/echomimic_v3/infer_audio2vid_cli.py

# Copy out Serverless Handler
COPY handler.py /workspace/echomimic_v3/handler.py

# Start the built-in RunPod listener automatically
CMD python -u /workspace/echomimic_v3/handler.py
