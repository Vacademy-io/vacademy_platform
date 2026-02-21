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
            self.num_inference_steps = 15 # Lowered slightly for faster serverless response

    # Monkeypatch the Config class inside infer_preview
    infer_preview.Config = RunPodConfig
    
    # Execute the primary generation logic natively
    main()
    
    # Search the dynamic output directory to catch the result
    latest_video = None
    max_time = 0
    for root, dirs, files in os.walk("outputs_dynamic"):
        for file in files:
            # We want the file that combined the audio (`_audio.mp4`)
            if file.endswith("_audio.mp4"):
                filepath = os.path.join(root, file)
                mtime = os.path.getmtime(filepath)
                if mtime > max_time:
                    max_time = mtime
                    latest_video = filepath
                    
    if latest_video:
        shutil.copy(latest_video, args.output_path)
        print(f"✅ V3 Inference completed successfully. Output copied to {args.output_path}")
    else:
        raise RuntimeError("V3 generation finished but mp4 was not found in outputs_dynamic directory.")

if __name__ == "__main__":
    run_cli()
