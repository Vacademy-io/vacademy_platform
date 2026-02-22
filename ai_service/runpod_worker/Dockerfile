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
import subprocess

# ---------------------------------------------------------------------------
# CRITICAL: Force TensorFlow (used by RetinaFace) to CPU BEFORE importing
# infer_preview. Without this, TF pre-allocates ~13 GB of GPU VRAM at import
# time, leaving PyTorch without enough memory for the diffusion pipeline.
# tf.config.set_visible_devices only affects TF — PyTorch/CUDA are unaffected.
# ---------------------------------------------------------------------------
os.environ['TF_CPP_MIN_LOG_LEVEL'] = '3'
import tensorflow as tf
tf.config.set_visible_devices([], 'GPU')

from infer_preview import Config, main
import infer_preview


def to_wav_16k(src, dst):
    """Convert any audio to 16 kHz mono WAV (required by wav2vec2)."""
    subprocess.run(
        ['ffmpeg', '-y', '-i', src, '-ar', '16000', '-ac', '1', dst],
        check=True, capture_output=True, text=True
    )


def run_cli():
    import argparse
    parser = argparse.ArgumentParser()
    parser.add_argument("--image_path",  required=True)
    parser.add_argument("--audio_path",  required=True)
    parser.add_argument("--output_path", required=True)
    args = parser.parse_args()

    # Normalise to 16 kHz mono WAV so wav2vec2 always gets the correct format
    # regardless of whether the input is MP3, M4A, or already WAV.
    wav_path = "/tmp/input_norm.wav"
    print("[CLI] Converting audio to 16 kHz WAV...")
    to_wav_16k(args.audio_path, wav_path)

    job_id   = "runpod_job"
    base_dir = "datasets/dynamic_runpod"
    save_dir = "outputs_dynamic"
    os.makedirs(f"{base_dir}/imgs",    exist_ok=True)
    os.makedirs(f"{base_dir}/audios",  exist_ok=True)
    os.makedirs(f"{base_dir}/prompts", exist_ok=True)

    shutil.copy(args.image_path, f"{base_dir}/imgs/{job_id}.png")
    shutil.copy(wav_path,        f"{base_dir}/audios/{job_id}.WAV")
    with open(f"{base_dir}/prompts/{job_id}.txt", "w") as fh:
        fh.write("a teacher talking")

    class RunPodConfig(Config):
        def __init__(self):
            super().__init__()
            self.base_dir            = base_dir
            self.test_name_list      = [job_id]
            self.model_name          = "models/Wan2.1-Fun-V1.1-1.3B-InP"
            self.transformer_path    = "models/transformer/diffusion_pytorch_model.safetensors"
            self.wav2vec_model_dir   = "models/wav2vec2-base-960h"
            self.save_path           = save_dir
            self.enable_teacache     = True
            self.teacache_threshold  = 0.1
            # 10 steps: good quality/speed for talking-head (README says 5 steps
            # minimum for talking head, 15-25 for talking body)
            self.num_inference_steps = 10
            self.sample_size         = [512, 512]
            # EchoMimic V3 built-in sliding window for long video generation.
            # partial_video_length sets the window size (65 frames ≈ 2.6s at 25fps).
            # use_long_video_cfg MUST also be True to activate the windowed path —
            # without it the model still tries to process all frames at once (OOM)
            # and prints "not use long video cfg" in the logs.
            self.partial_video_length = 65
            self.use_long_video_cfg   = True

    infer_preview.Config = RunPodConfig
    main()

    # Find the most recently modified output video
    latest_video, max_time = None, 0
    for root, _, files in os.walk(save_dir):
        for f in files:
            if f.endswith("_audio.mp4"):
                p  = os.path.join(root, f)
                mt = os.path.getmtime(p)
                if mt > max_time:
                    max_time     = mt
                    latest_video = p

    if not latest_video:
        raise RuntimeError("No *_audio.mp4 found in " + save_dir)

    shutil.copy(latest_video, args.output_path)
    print(f"[CLI] Done \u2192 {args.output_path}")


if __name__ == "__main__":
    run_cli()
INFER_EOF

# ---------------------------------------------------------------------------
# Embed handler.py inline
# ---------------------------------------------------------------------------
RUN cat > /workspace/echomimic_v3/handler.py <<'HANDLER_EOF'
# RunPod Worker Handler for EchoMimic V3
import os
import shutil
import boto3
import urllib.request
import subprocess
import runpod

# ---------------------------------------------------------------------------
# Model paths
# ---------------------------------------------------------------------------
ECHOMIMIC_DIR    = "/workspace/echomimic_v3"
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

    # Pre-cache RetinaFace weights so face detection doesn't download 119 MB
    # from GitHub on every cold start (default path: /root/.deepface/weights/).
    retinaface_cache = os.path.join(MODELS_STORE, "retinaface.h5")
    retinaface_dst  = "/root/.deepface/weights/retinaface.h5"
    if not os.path.exists(retinaface_cache):
        print("[Init] Downloading retinaface.h5 to network volume cache...")
        import urllib.request
        os.makedirs(os.path.dirname(retinaface_dst), exist_ok=True)
        urllib.request.urlretrieve(
            "https://github.com/serengil/deepface_models/releases/download/v1.0/retinaface.h5",
            retinaface_cache,
        )
        print("[Init] retinaface.h5 done.")
    if not os.path.exists(retinaface_dst):
        os.makedirs(os.path.dirname(retinaface_dst), exist_ok=True)
        shutil.copy2(retinaface_cache, retinaface_dst)

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

    runpod.serverless.progress_update(job, {"progress": 5, "stage": "Downloading inputs"})
    print(f"[{job_id}] Downloading image from {image_url}")
    urllib.request.urlretrieve(image_url, image_path)
    print(f"[{job_id}] Downloading audio from {audio_url}")
    urllib.request.urlretrieve(audio_url, audio_path)

    runpod.serverless.progress_update(job, {"progress": 10, "stage": "Starting EchoMimic inference"})
    print(f"[{job_id}] Running EchoMimic Inference...")

    cmd = [
        "python", "-u", "infer_audio2vid_cli.py",
        "--image_path", image_path,
        "--audio_path", audio_path,
        "--output_path", output_video_path
    ]

    # Stream stdout+stderr line-by-line so we can forward logs to RunPod and
    # parse [CLI] progress markers emitted by infer_audio2vid_cli.py.
    # python -u ensures the subprocess writes lines without buffering.
    process = subprocess.Popen(
        cmd,
        stdout=subprocess.PIPE,
        stderr=subprocess.STDOUT,   # merge stderr into the same pipe
        text=True,
        cwd=ECHOMIMIC_DIR
    )

    output_lines = []
    num_chunks = None
    chunks_done = 0

    for line in process.stdout:
        line = line.rstrip()
        if not line:
            continue
        output_lines.append(line)
        print(f"[EchoMimic] {line}", flush=True)

        # Parse progress markers from infer_audio2vid_cli.py ───────────────
        if "chunk(s) to process" in line:
            # "[CLI] 3 chunk(s) to process"
            try:
                num_chunks = int(line.split("[CLI]")[1].strip().split()[0])
            except Exception:
                pass

        elif "[CLI]" in line and "\u2192" in line and "chunk" in line and "chunk(s)" not in line:
            # Chunk done: "[CLI]   chunk000 \u2192 outputs_dynamic_chunked/..."
            chunks_done += 1
            if num_chunks and num_chunks > 1:
                pct = 10 + int((chunks_done / num_chunks) * 75)
                runpod.serverless.progress_update(job, {
                    "progress": pct,
                    "stage": f"Inference: segment {chunks_done}/{num_chunks} complete"
                })

        elif "Concatenating" in line and "segment" in line:
            runpod.serverless.progress_update(job, {"progress": 87, "stage": "Concatenating video segments"})

        elif "[CLI] Done" in line:
            runpod.serverless.progress_update(job, {"progress": 90, "stage": "Inference complete"})

    process.wait()
    if process.returncode != 0:
        tail = "\n".join(output_lines[-30:])
        print(f"[{job_id}] EchoMimic failed (exit {process.returncode})")
        return {"error": f"EchoMimic failed (exit {process.returncode}):\n{tail}"}

    if not os.path.exists(output_video_path):
        return {"error": "Output video was not generated."}

    runpod.serverless.progress_update(job, {"progress": 92, "stage": "Uploading to S3"})
    print(f"[{job_id}] Uploading output to S3...")
    s3_key = f"runpod_outputs/{job_id}/avatar_video.mp4"

    try:
        s3_client.upload_file(
            output_video_path,
            S3_BUCKET,
            s3_key,
            ExtraArgs={'ContentType': 'video/mp4'}
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
