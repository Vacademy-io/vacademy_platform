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
            # 10 steps is ideal for talking-head (README recommends 5 steps for
            # talking head, 15-25 for talking body — 10 is a quality/speed balance)
            self.num_inference_steps = 10
            self.sample_size         = [512, 512]
            # EchoMimic V3 built-in sliding window for long video generation.
            # Without this, generating >138 frames tries to process all frames
            # at once → OOM on any GPU. At 25fps, 65 frames = ~2.6s per window.
            # The model maintains temporal consistency across windows automatically.
            self.partial_video_length = 65

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
    print(f"[CLI] Done → {args.output_path}")


if __name__ == "__main__":
    run_cli()
