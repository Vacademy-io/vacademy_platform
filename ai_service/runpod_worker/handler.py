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
# RunPod Network Volume is mounted at /runpod-volume. Models are stored there
# so they survive across container restarts (only downloaded once).
MODELS_VOLUME_DIR = "/runpod-volume/echomimic_models"
WORKSPACE_MODELS  = "/workspace/echomimic_v3/models"

# ---------------------------------------------------------------------------
# One-time model initialisation (runs before the serverless loop starts)
# ---------------------------------------------------------------------------
def initialize_models():
    """Download models to Network Volume on first cold start, then symlink."""
    os.makedirs(MODELS_VOLUME_DIR, exist_ok=True)

    from huggingface_hub import snapshot_download

    downloads = [
        ("alibaba-pai/Wan2.1-Fun-V1.1-1.3B-InP", "Wan2.1-Fun-V1.1-1.3B-InP"),
        ("facebook/wav2vec2-base-960h",            "wav2vec2-base-960h"),
        ("BadToBest/EchoMimicV3",                  "preview_weights"),
    ]

    for repo_id, local_name in downloads:
        target = os.path.join(MODELS_VOLUME_DIR, local_name)
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
    transformer_dir = os.path.join(MODELS_VOLUME_DIR, "transformer")
    os.makedirs(transformer_dir, exist_ok=True)
    src = os.path.join(MODELS_VOLUME_DIR, "preview_weights", "transformer",
                       "diffusion_pytorch_model.safetensors")
    dst = os.path.join(transformer_dir, "diffusion_pytorch_model.safetensors")
    if os.path.exists(src) and not os.path.exists(dst):
        shutil.copy2(src, dst)

    # Symlink /workspace/echomimic_v3/models → network volume so the relative
    # paths inside infer_audio2vid_cli.py work without any changes.
    if os.path.islink(WORKSPACE_MODELS):
        os.remove(WORKSPACE_MODELS)
    if not os.path.exists(WORKSPACE_MODELS):
        os.symlink(MODELS_VOLUME_DIR, WORKSPACE_MODELS)

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
        result = subprocess.run(cmd, capture_output=True, text=True, check=True)
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
