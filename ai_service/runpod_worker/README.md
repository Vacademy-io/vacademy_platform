# How to build the Docker image and deploy to RunPod from AWS ECR

## 1. Environment Requirements

Since you are using AWS, you can host the massive Docker Image for EchoMimic directly on **Amazon Elastic Container Registry (ECR)**.
Then, RunPod can quickly stream and boot this image natively.

### Prerequisites (Run these locally where you have Docker installed):

Make sure Docker is installed on your Mac / local machine.
Make sure the `aws` CLI is installed and configured (`aws configure`).

## 2. Create the ECR Repository

Open your AWS console and create a **Public** or **Private** ECR repository (Public is heavily recommended to avoid tricky Secret setups on RunPod):

```bash
# E.g. Creating public ECR
aws ecr-public get-login-password --region us-east-1 | docker login --username AWS --password-stdin public.ecr.aws

# Create repository if you haven't (or do this in AWS Web Console)
aws ecr-public create-repository --repository-name echomimic-runpod-worker
```

## 3. Build the Docker Image

Inside this very folder `ai_service/runpod_worker`, open a terminal and run the Docker build command.
_(Note: Building this image natively downloads up to ~20GB of EchoMimic weights and dependencies. Ensure you have fast internet! It might take 10-15 minutes.)_

```bash
cd ai_service/runpod_worker

docker build -t echomimic-runpod-worker:latest .
```

## 4. Push the Docker Image to AWS ECR

Tag your built image with the URL of the public ECR registry you created earlier:

```bash
docker tag echomimic-runpod-worker:latest public.ecr.aws/YOUR_ALIAS/echomimic-runpod-worker:latest

docker push public.ecr.aws/YOUR_ALIAS/echomimic-runpod-worker:latest
```

## 5. Deploy on RunPod Dashboard

Now that the gigantic worker image lives safely on your AWS ECR, go back to **RunPod**:

1. Open the [RunPod Serverless Dashboard](https://www.runpod.io/console/serverless).
2. Click **New Endpoint**.
3. Container Image: Paste the ECR Image URI you just pushed!
   _(e.g., `public.ecr.aws/YOUR_ALIAS/echomimic-runpod-worker:latest`)_
4. Select your GPUs (Suggest RTX 3090, RTX 4090, or A100 for EchoMimic).
5. Open the **Environment Variables** tab and set the required S3 upload keys:
   - `AWS_ACCESS_KEY_ID`: `your-aws-access-key`
   - `AWS_SECRET_ACCESS_KEY`: `your-aws-secret-access-key`
   - `AWS_REGION`: `ap-south-1`
   - `AWS_S3_PUBLIC_BUCKET`: `your-vacademy-s3-bucket-name`
     _(Without these, the worker will fail to upload the completed avatar back from RunPod to your platform!)_
6. Click **Deploy**.

## 6. Finish the Backend integration

When RunPod finishes setting it up, you will get the new **`RUNPOD_ENDPOINT_ID`**.
Grab that value and your `RUNPOD_API_KEY`, upload them to GitHub Secrets, and you are totally finished!

Whenever `automation_pipeline.py` hits the `AVATAR` stage, it'll send `"input": {"image_url": "...", "audio_url": "..."}` cleanly to the RunPod API, invoking `handler.py` natively running on the GPU container!
