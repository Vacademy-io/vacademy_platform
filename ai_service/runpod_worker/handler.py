# RunPod Worker Handler for EchoMimic
import os
import uuid
import boto3
import urllib.request
import subprocess
import runpod

# Initialize S3 Client (Requires AWS_ACCESS_KEY_ID, AWS_SECRET_ACCESS_KEY, and AWS_REGION in RunPod Environment Variables)
s3_client = boto3.client(
    's3',
    aws_access_key_id=os.getenv('AWS_ACCESS_KEY_ID'),
    aws_secret_access_key=os.getenv('AWS_SECRET_ACCESS_KEY'),
    region_name=os.getenv('AWS_REGION', 'ap-south-1')
)
S3_BUCKET = os.getenv('AWS_S3_PUBLIC_BUCKET', 'your-vacademy-bucket-name')

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
    
    # Run EchoMimic Inference
    # The current working directory in the Dockerfile should be the EchoMimic checkout
    print(f"[{job_id}] Running EchoMimic Inference...")
    try:
        # Assuming infer_audio2vid.py is modified to securely accept CLI arguments 
        # For this template, we invoke the python script. 
        # (Be sure to check you have a CLI interface in your EchoMimic clone)
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
            ExtraArgs={'ContentType': 'video/mp4', 'ACL': 'public-read'} # Or without ACL depending on your bucket
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
    except:
        pass
        
    return {"video_url": video_url}

# Start the RunPod serverless worker
runpod.serverless.start({"handler": generate_avatar})
