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

# Force tensorflow <= 2.15.1 so keras correctly ships alongside it
# RetinaFace crashes instantly with TF 2.16+ generic architecture
RUN pip install "tensorflow<2.16.0"

# Fast Download HuggingFace Pre-trained Weights using Python to bypass PATH issues (.local/bin)
# This prevents the 30-minute RunPod GitHub builder timeout
RUN pip install "huggingface_hub[cli,hf_transfer]"

# Enable extreme download speeds via hf_transfer
ENV HF_HUB_ENABLE_HF_TRANSFER=1

RUN mkdir -p models
WORKDIR /workspace/echomimic_v3/models

RUN python -c "from huggingface_hub import snapshot_download; snapshot_download(repo_id='alibaba-pai/Wan2.1-Fun-V1.1-1.3B-InP', local_dir='Wan2.1-Fun-V1.1-1.3B-InP', ignore_patterns=['*.md', '*.gitattributes', '*.txt'])"
RUN python -c "from huggingface_hub import snapshot_download; snapshot_download(repo_id='facebook/wav2vec2-base-960h', local_dir='wav2vec2-base-960h', ignore_patterns=['*.md', '*.gitattributes', '*.txt'])"
RUN python -c "from huggingface_hub import snapshot_download; snapshot_download(repo_id='BadToBest/EchoMimicV3', local_dir='preview_weights', ignore_patterns=['*.md', '*.gitattributes', '*.txt'])"

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
