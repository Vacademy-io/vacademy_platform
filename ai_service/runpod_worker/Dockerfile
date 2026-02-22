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
# tf-keras is the official Google compatibility shim, but it ALSO requires the
# TF_USE_LEGACY_KERAS=1 env var to wire tensorflow.keras back into the TF namespace.
# Without the env var, installing tf-keras alone is not enough.
RUN pip install tf-keras
ENV TF_USE_LEGACY_KERAS=1

# Install huggingface_hub for runtime model downloads (handler.py downloads on first boot)
RUN pip install "huggingface_hub[cli,hf_transfer]"

# Enable extreme download speeds via hf_transfer at runtime
ENV HF_HUB_ENABLE_HF_TRANSFER=1

# Models are NOT downloaded at build time to avoid the 30-minute builder timeout.
# handler.py downloads them to /runpod-volume (Network Volume) on first cold start,
# then symlinks /workspace/echomimic_v3/models → /runpod-volume/echomimic_models.
# Subsequent starts skip the download entirely.

# ---------------------------------------------------------------------------
# Embed infer_audio2vid_cli.py inline — RunPod GitHub builder sends an empty
# build context so COPY cannot be used for files from the repository.
# ---------------------------------------------------------------------------
RUN cat > /workspace/echomimic_v3/infer_audio2vid_cli.py <<'INFER_EOF'
import sys
import os
import shutil
import glob
from infer_preview import Config, main
import infer_preview

def run_cli():
    import argparse
    parser = argparse.ArgumentParser()
    parser.add_argument("--image_path", required=True)
    parser.add_argument("--audio_path", required=True)
    parser.add_argument("--output_path", required=True)
    args = parser.parse_args()

    job_id = "runpod_job"

    # EchoMimic V3 infer_preview strictly expects a nested directory dataset format
    base_dir = "datasets/dynamic_runpod"
    os.makedirs(f"{base_dir}/imgs", exist_ok=True)
    os.makedirs(f"{base_dir}/audios", exist_ok=True)
    os.makedirs(f"{base_dir}/prompts", exist_ok=True)

    shutil.copy(args.image_path, f"{base_dir}/imgs/{job_id}.png")
    shutil.copy(args.audio_path, f"{base_dir}/audios/{job_id}.WAV")

    with open(f"{base_dir}/prompts/{job_id}.txt", "w") as f:
        f.write("a teacher talking")

    class RunPodConfig(Config):
        def __init__(self):
            super().__init__()
            self.base_dir = base_dir
            self.test_name_list = [job_id]
            self.model_name = "models/Wan2.1-Fun-V1.1-1.3B-InP"
            self.transformer_path = "models/transformer/diffusion_pytorch_model.safetensors"
            self.wav2vec_model_dir = "models/wav2vec2-base-960h"
            self.save_path = "outputs_dynamic"
            # TeaCache skips redundant attention computations — 2-3x speedup with
            # minimal quality loss. Built into EchoMimic V3's transformer.
            self.enable_teacache = True
            self.teacache_threshold = 0.1
            # 10 steps vs 25 default: good quality/speed balance for talking-head video.
            self.num_inference_steps = 10
            # 512x512 vs 768x768 default: 2.25x less VRAM + attention compute.
            # Increase back to [768, 768] if output quality is insufficient.
            self.sample_size = [512, 512]

    # Monkeypatch the Config class inside infer_preview
    infer_preview.Config = RunPodConfig

    # Execute the primary generation logic natively
    main()

    # Search the dynamic output directory to catch the result
    latest_video = None
    max_time = 0
    for root, dirs, files in os.walk("outputs_dynamic"):
        for file in files:
            if file.endswith("_audio.mp4"):
                filepath = os.path.join(root, file)
                mtime = os.path.getmtime(filepath)
                if mtime > max_time:
                    max_time = mtime
                    latest_video = filepath

    if latest_video:
        shutil.copy(latest_video, args.output_path)
        print(f"V3 Inference completed successfully. Output copied to {args.output_path}")
    else:
        raise RuntimeError("V3 generation finished but mp4 was not found in outputs_dynamic directory.")

if __name__ == "__main__":
    run_cli()
INFER_EOF

# ---------------------------------------------------------------------------
# Embed handler.py inline
# ---------------------------------------------------------------------------
RUN cat > /workspace/echomimic_v3/handler.py <<'HANDLER_EOF'
# RunPod Worker Handler for EchoMimic
import os
import shutil
import boto3
import urllib.request
import subprocess
import runpod

# ---------------------------------------------------------------------------
# Model paths
# ---------------------------------------------------------------------------
ECHOMIMIC_DIR = "/workspace/echomimic_v3"
WORKSPACE_MODELS = os.path.join(ECHOMIMIC_DIR, "models")

# Use RunPod Network Volume if mounted, otherwise fall back to local workspace.
# Fallback means models re-download on every cold start — attach a network
# volume in the RunPod dashboard to make them persist.
if os.path.isdir("/runpod-volume"):
    MODELS_STORE = "/runpod-volume/echomimic_models"
else:
    MODELS_STORE = "/workspace/echomimic_models"
    print("[Init] WARNING: /runpod-volume not found. Models will be stored locally "
          "and re-downloaded on every cold start. Attach a Network Volume to fix this.")

# ---------------------------------------------------------------------------
# One-time model initialisation (runs before the serverless loop starts)
# ---------------------------------------------------------------------------
def initialize_models():
    """Download models to persistent store on first cold start, then symlink."""
    os.makedirs(MODELS_STORE, exist_ok=True)

    from huggingface_hub import snapshot_download

    downloads = [
        ("alibaba-pai/Wan2.1-Fun-V1.1-1.3B-InP", "Wan2.1-Fun-V1.1-1.3B-InP"),
        ("facebook/wav2vec2-base-960h",            "wav2vec2-base-960h"),
        ("BadToBest/EchoMimicV3",                  "preview_weights"),
    ]

    for repo_id, local_name in downloads:
        target = os.path.join(MODELS_STORE, local_name)
        if not os.path.exists(target):
            print(f"[Init] Downloading {repo_id} -> {target} ...")
            snapshot_download(
                repo_id=repo_id,
                local_dir=target,
                ignore_patterns=["*.md", "*.gitattributes", "*.txt"],
            )
            print(f"[Init] {repo_id} done.")
        else:
            print(f"[Init] {repo_id} already cached, skipping download.")

    # Build the transformer subfolder EchoMimic V3 expects:
    # models/transformer/diffusion_pytorch_model.safetensors
    transformer_dir = os.path.join(MODELS_STORE, "transformer")
    os.makedirs(transformer_dir, exist_ok=True)
    src = os.path.join(MODELS_STORE, "preview_weights", "transformer",
                       "diffusion_pytorch_model.safetensors")
    dst = os.path.join(transformer_dir, "diffusion_pytorch_model.safetensors")
    if os.path.exists(src) and not os.path.exists(dst):
        shutil.copy2(src, dst)

    # Point /workspace/echomimic_v3/models at the persistent store so the
    # relative paths in infer_audio2vid_cli.py work without changes.
    # Remove whatever is there (symlink OR regular directory from git clone).
    if os.path.islink(WORKSPACE_MODELS):
        os.remove(WORKSPACE_MODELS)
    elif os.path.isdir(WORKSPACE_MODELS):
        shutil.rmtree(WORKSPACE_MODELS)
    os.symlink(MODELS_STORE, WORKSPACE_MODELS)

    print("[Init] Models ready.")


# ---------------------------------------------------------------------------
# S3 client
# ---------------------------------------------------------------------------
s3_client = boto3.client(
    's3',
    aws_access_key_id=os.getenv('AWS_ACCESS_KEY_ID'),
    aws_secret_access_key=os.getenv('AWS_SECRET_ACCESS_KEY'),
    region_name=os.getenv('AWS_REGION', 'ap-south-1')
)
S3_BUCKET = os.getenv('AWS_S3_PUBLIC_BUCKET', 'your-vacademy-bucket-name')


# ---------------------------------------------------------------------------
# Job handler
# ---------------------------------------------------------------------------
def generate_avatar(job):
    job_input = job['input']
    image_url = job_input.get('image_url')
    audio_url = job_input.get('audio_url')

    if not image_url or not audio_url:
        return {"error": "Missing image_url or audio_url in payload"}

    job_id = job['id']
    work_dir = f"/workspace/{job_id}"
    os.makedirs(work_dir, exist_ok=True)

    image_path = os.path.join(work_dir, "input_image.png")
    audio_path = os.path.join(work_dir, "input_audio.mp3")
    output_video_path = os.path.join(work_dir, "output.mp4")

    print(f"[{job_id}] Downloading image from {image_url}")
    urllib.request.urlretrieve(image_url, image_path)

    print(f"[{job_id}] Downloading audio from {audio_url}")
    urllib.request.urlretrieve(audio_url, audio_path)

    print(f"[{job_id}] Running EchoMimic Inference...")
    try:
        cmd = [
            "python", "-u", "infer_audio2vid_cli.py",
            "--image_path", image_path,
            "--audio_path", audio_path,
            "--output_path", output_video_path
        ]
        # cwd must be the echomimic dir so relative paths (datasets/, outputs_dynamic/)
        # created by infer_audio2vid_cli.py land in the correct location.
        result = subprocess.run(cmd, capture_output=True, text=True, check=True,
                                cwd=ECHOMIMIC_DIR)
        print(f"[{job_id}] EchoMimic Run Success:\n{result.stdout}")

    except subprocess.CalledProcessError as e:
        print(f"[{job_id}] EchoMimic Run Failed:\n{e.stderr}")
        return {"error": f"EchoMimic failed: {e.stderr}"}

    if not os.path.exists(output_video_path):
        return {"error": "Output video was not generated."}

    print(f"[{job_id}] Uploading output to S3...")
    s3_key = f"runpod_outputs/{job_id}/avatar_video.mp4"

    try:
        s3_client.upload_file(
            output_video_path,
            S3_BUCKET,
            s3_key,
            ExtraArgs={'ContentType': 'video/mp4', 'ACL': 'public-read'}
        )
        video_url = f"https://{S3_BUCKET}.s3.{os.getenv('AWS_REGION', 'ap-south-1')}.amazonaws.com/{s3_key}"
        print(f"[{job_id}] Upload complete: {video_url}")

    except Exception as e:
        print(f"[{job_id}] S3 Upload failed: {e}")
        return {"error": f"S3 Upload failed: {str(e)}"}

    # Cleanup
    try:
        os.remove(image_path)
        os.remove(audio_path)
        os.remove(output_video_path)
    except Exception:
        pass

    return {"video_url": video_url}


# ---------------------------------------------------------------------------
# Entry point
# ---------------------------------------------------------------------------
print("[Startup] Initialising models...")
initialize_models()
print("[Startup] Starting RunPod serverless worker.")
runpod.serverless.start({"handler": generate_avatar})
HANDLER_EOF

# Set PyTorch memory allocator to avoid fragmentation OOM errors on RunPod
ENV PYTORCH_CUDA_ALLOC_CONF=expandable_segments:True

# Start the built-in RunPod listener automatically
CMD python -u /workspace/echomimic_v3/handler.py
