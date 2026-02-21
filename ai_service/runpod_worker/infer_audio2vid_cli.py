import argparse
import sys
import yaml
import subprocess
import os

def main():
    parser = argparse.ArgumentParser("EchoMimic CLI Wrapper for RunPod")
    parser.add_argument("--image_path", required=True)
    parser.add_argument("--audio_path", required=True)
    parser.add_argument("--output_path", required=True)
    args = parser.parse_args()
    
    # Update configs/prompts/animation.yaml temporarily
    config_path = "configs/prompts/animation.yaml"
    with open(config_path, "r") as f:
        config = yaml.safe_load(f)
        
    # Inject our dynamic paths into test_cases
    # For EchoMimic, format is typically {"image": path, "audio": path}
    config["test_cases"] = {
        "image": args.image_path,
        "audio": args.audio_path
    }
    
    with open(config_path, "w") as f:
        yaml.dump(config, f)
        
    print(f"Updated animation.yaml: {config}")
    
    # Call the original inference script cleanly
    cmd = ["python", "-u", "infer_audio2vid.py"]
    print(f"Executing: {' '.join(cmd)}")
    subprocess.run(cmd, check=True)
    
    # By default, EchoMimic drops output in ./output module. Walk directory and grab latest MP4
    latest_video = None
    max_time = 0
    demo_dir = "output_dataset" # Adjust according to EchoMimic standard output folder if modified
    
    for root, dirs, files in os.walk(os.getcwd()):
        for file in files:
            if file.endswith(".mp4"):
                filepath = os.path.join(root, file)
                mtime = os.path.getmtime(filepath)
                if mtime > max_time:
                    max_time = mtime
                    latest_video = filepath
                    
    if latest_video:
        print(f"Found generated video: {latest_video}")
        os.rename(latest_video, args.output_path)
    else:
        raise RuntimeError(f"EchoMimic completed but no .mp4 output was found.")
        
if __name__ == "__main__":
    main()
