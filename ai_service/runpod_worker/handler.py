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
            print(f"[Init] Downloading {repo_id} → {target} ...")
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
    retinaface_dst   = "/root/.deepface/weights/retinaface.h5"
    if not os.path.exists(retinaface_cache):
        print("[Init] Downloading retinaface.h5 to network volume cache...")
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

    job_id    = job['id']
    work_dir  = f"/workspace/{job_id}"
    os.makedirs(work_dir, exist_ok=True)

    image_path        = os.path.join(work_dir, "input_image.png")
    audio_path        = os.path.join(work_dir, "input_audio.mp3")
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

    # Stream stdout+stderr line-by-line so logs are forwarded to RunPod in
    # real time and we can parse [CLI] progress markers.
    process = subprocess.Popen(
        cmd,
        stdout=subprocess.PIPE,
        stderr=subprocess.STDOUT,
        text=True,
        cwd=ECHOMIMIC_DIR
    )

    output_lines = []
    for line in process.stdout:
        line = line.rstrip()
        if not line:
            continue
        output_lines.append(line)
        print(f"[EchoMimic] {line}", flush=True)

        if "[CLI] Done" in line:
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
