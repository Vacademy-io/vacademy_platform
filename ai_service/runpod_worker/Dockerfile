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

# Clone EchoMimic
RUN git clone https://github.com/BadToBest/EchoMimic.git
WORKDIR /workspace/EchoMimic

# Upgrade pip and install standard RunPod/Boto3 wrappers
RUN pip install --upgrade pip
RUN pip install runpod boto3

# Fix older exact pinning of requirements to ensure they build successfully
RUN sed -i 's/torch>=2.0.1,<=2.2.2/torch>=2.0.1/' requirements.txt
RUN sed -i 's/torchvision>=0.15.2,<=0.17.2/torchvision>=0.15.2/' requirements.txt
RUN sed -i 's/torchaudio>=2.0.2,<=2.2.2/torchaudio>=2.0.2/' requirements.txt
RUN sed -i 's/av==11.0.0/av/' requirements.txt

# Install EchoMimic dependencies
RUN pip install -r requirements.txt

# Download HuggingFace Pre-trained Weights using Git LFS
# This bakes the weights into the Docker Image for fast cold-starts
RUN git lfs install
RUN git clone https://huggingface.co/BadToBest/EchoMimic pretrained_weights

# Optionally construct a basic CLI script to trigger infer_audio2vid dynamically
# (Instead of modifying animation.yaml manually every time)
COPY infer_audio2vid_cli.py /workspace/EchoMimic/infer_audio2vid_cli.py

# Copy out Serverless Handler
COPY handler.py /workspace/EchoMimic/handler.py

# Start the built-in RunPod listener automatically
CMD python -u /workspace/EchoMimic/handler.py
