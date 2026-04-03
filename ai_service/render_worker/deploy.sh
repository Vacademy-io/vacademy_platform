#!/bin/bash
# ──────────────────────────────────────────────────────────────
# Deploy render worker to production server
#
# Usage:
#   cd vacademy_platform/ai_service && bash render_worker/deploy.sh
#
# What it does:
#   1. Copies updated code to the server via rsync
#   2. Runs build.sh on the server (Docker build)
#   3. Stops old container, starts new one
# ──────────────────────────────────────────────────────────────
set -euo pipefail

# ── Config ──
RENDER_SERVER="root@157.90.162.154"
REMOTE_DIR="/opt/vacademy/ai_service"
CONTAINER_NAME="vacademy-render"
IMAGE_NAME="vacademy-render:latest"

# ── Paths (relative to ai_service/) ──
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
AI_SERVICE_DIR="$(dirname "$SCRIPT_DIR")"

echo "════════════════════════════════════════════"
echo "  Deploying Render Worker"
echo "  Server: $RENDER_SERVER"
echo "════════════════════════════════════════════"

# ── Step 1: Sync code to server ──
echo ""
echo "▶ [1/3] Syncing code to $RENDER_SERVER:$REMOTE_DIR ..."

# Ensure remote directory exists
ssh "$RENDER_SERVER" "mkdir -p $REMOTE_DIR/render_worker $REMOTE_DIR/app/ai-video-gen-main"

# Sync render worker files
rsync -avz --progress \
    "$SCRIPT_DIR/main.py" \
    "$SCRIPT_DIR/worker.py" \
    "$SCRIPT_DIR/requirements.txt" \
    "$SCRIPT_DIR/Dockerfile" \
    "$SCRIPT_DIR/build.sh" \
    "$RENDER_SERVER:$REMOTE_DIR/render_worker/"

# Sync generate_video.py and config files
rsync -avz --progress \
    "$AI_SERVICE_DIR/app/ai-video-gen-main/generate_video.py" \
    "$RENDER_SERVER:$REMOTE_DIR/app/ai-video-gen-main/"

# Sync optional config/assets (ignore if missing)
for f in video_options.json captions_settings.json branding.json; do
    if [ -f "$AI_SERVICE_DIR/app/ai-video-gen-main/$f" ]; then
        rsync -avz "$AI_SERVICE_DIR/app/ai-video-gen-main/$f" \
            "$RENDER_SERVER:$REMOTE_DIR/app/ai-video-gen-main/"
    fi
done

# Sync assets directory if it exists
if [ -d "$AI_SERVICE_DIR/app/ai-video-gen-main/assets" ]; then
    rsync -avz --progress \
        "$AI_SERVICE_DIR/app/ai-video-gen-main/assets/" \
        "$RENDER_SERVER:$REMOTE_DIR/app/ai-video-gen-main/assets/"
fi

echo "✓ Code synced"

# ── Step 2: Build Docker image on server ──
echo ""
echo "▶ [2/3] Building Docker image on server ..."

ssh "$RENDER_SERVER" "cd $REMOTE_DIR && bash render_worker/build.sh"

echo "✓ Docker image built"

# ── Step 3: Restart container ──
echo ""
echo "▶ [3/3] Restarting container ..."

ssh "$RENDER_SERVER" bash -s <<'REMOTE_SCRIPT'
set -e

CONTAINER_NAME="vacademy-render"
IMAGE_NAME="vacademy-render:latest"

# Stop and remove old container (ignore errors if not running)
docker stop "$CONTAINER_NAME" 2>/dev/null || true
docker rm "$CONTAINER_NAME" 2>/dev/null || true

# Start new container
docker run -d \
    --name "$CONTAINER_NAME" \
    --restart unless-stopped \
    -p 8090:8090 \
    -e AWS_ACCESS_KEY_ID='YOUR_AWS_ACCESS_KEY_ID' \
    -e AWS_SECRET_ACCESS_KEY='YOUR_AWS_SECRET_ACCESS_KEY' \
    -e AWS_REGION='ap-south-1' \
    -e AWS_S3_PUBLIC_BUCKET='vacademy-media-storage-public' \
    -e RENDER_KEY='vsahcraedyeamsyh' \
    -e MAX_CONCURRENT_JOBS='2' \
    "$IMAGE_NAME"

echo ""
echo "Container started. Checking health..."
sleep 3
docker ps --filter "name=$CONTAINER_NAME" --format "table {{.Names}}\t{{.Status}}\t{{.Ports}}"
REMOTE_SCRIPT

echo ""
echo "════════════════════════════════════════════"
echo "  ✓ Deploy complete!"
echo "  Container: $CONTAINER_NAME"
echo "  Health:    http://157.90.162.154:8090/health"
echo "════════════════════════════════════════════"
