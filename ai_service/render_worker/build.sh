#!/bin/bash
# Build the render worker Docker image.
# Run from the ai_service directory:
#   cd ai_service && bash render_worker/build.sh

set -e

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
AI_SERVICE_DIR="$(dirname "$SCRIPT_DIR")"
BUILD_DIR="$SCRIPT_DIR/.build"

echo "==> Preparing build context..."
rm -rf "$BUILD_DIR"
mkdir -p "$BUILD_DIR"

# Copy render worker files
cp "$SCRIPT_DIR/main.py" "$BUILD_DIR/"
cp "$SCRIPT_DIR/worker.py" "$BUILD_DIR/"
cp "$SCRIPT_DIR/requirements.txt" "$BUILD_DIR/"
cp "$SCRIPT_DIR/Dockerfile" "$BUILD_DIR/"

# Copy the video generation pipeline (generate_video.py + config + assets)
mkdir -p "$BUILD_DIR/ai-video-gen-main"
cp "$AI_SERVICE_DIR/app/ai-video-gen-main/generate_video.py" "$BUILD_DIR/ai-video-gen-main/"
cp "$AI_SERVICE_DIR/app/ai-video-gen-main/video_options.json" "$BUILD_DIR/ai-video-gen-main/" 2>/dev/null || true
cp "$AI_SERVICE_DIR/app/ai-video-gen-main/captions_settings.json" "$BUILD_DIR/ai-video-gen-main/" 2>/dev/null || true
cp "$AI_SERVICE_DIR/app/ai-video-gen-main/branding.json" "$BUILD_DIR/ai-video-gen-main/" 2>/dev/null || true

# Copy assets directory if it exists (JavaScript helpers for Playwright)
if [ -d "$AI_SERVICE_DIR/app/ai-video-gen-main/assets" ]; then
    cp -r "$AI_SERVICE_DIR/app/ai-video-gen-main/assets" "$BUILD_DIR/ai-video-gen-main/"
fi

echo "==> Building Docker image..."
cd "$BUILD_DIR"
docker build -t vacademy-render:latest .

echo "==> Cleaning up build context..."
rm -rf "$BUILD_DIR"

echo "==> Done! Run with:"
echo "    docker run -d -p 8090:8090 \\"
echo "      -e AWS_ACCESS_KEY_ID=xxx \\"
echo "      -e AWS_SECRET_ACCESS_KEY=xxx \\"
echo "      -e AWS_S3_PUBLIC_BUCKET=vacademy-media-storage-public \\"
echo "      -e RENDER_KEY=your-secret-key \\"
echo "      vacademy-render:latest"
