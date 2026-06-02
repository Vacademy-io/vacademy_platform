#!/bin/bash
# Build the render worker Docker image.
# Run from the ai_service directory:
#   cd ai_service && bash render_worker/build.sh
#
# Flags:
#   --context-only   Assemble .build/ but do NOT run `docker build`. Used by the
#                    GH Actions workflow which builds via docker/build-push-action
#                    (handles caching + push in one step).

set -e

CONTEXT_ONLY=0
for arg in "$@"; do
    case "$arg" in
        --context-only) CONTEXT_ONLY=1 ;;
        *) echo "unknown flag: $arg" >&2; exit 2 ;;
    esac
done

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
AI_SERVICE_DIR="$(dirname "$SCRIPT_DIR")"
BUILD_DIR="$SCRIPT_DIR/.build"

echo "==> Preparing build context..."
rm -rf "$BUILD_DIR"
mkdir -p "$BUILD_DIR"

# Copy render worker files
cp "$SCRIPT_DIR/main.py" "$BUILD_DIR/"
cp "$SCRIPT_DIR/worker.py" "$BUILD_DIR/"
cp "$SCRIPT_DIR/transcribe_worker.py" "$BUILD_DIR/"
cp "$SCRIPT_DIR/screenshot_worker.py" "$BUILD_DIR/"
cp "$SCRIPT_DIR/audio_ops.py" "$BUILD_DIR/"
cp "$SCRIPT_DIR/requirements.txt" "$BUILD_DIR/"
cp "$SCRIPT_DIR/Dockerfile" "$BUILD_DIR/"

# Copy the video generation pipeline (generate_video.py + config + assets).
# render_harness.py is shared between the renderer and the screenshot endpoint
# so the vision reviewer sees the same DOM the MP4 will produce.
# dispatcher_install_js.py holds the ~850-line shadow-DOM dispatcher JS
# imported by both generate_video.py (production /jobs render) and
# screenshot_worker.py (single-shot /shot/preview-mp4 path) so they install
# byte-identical state on the page.
mkdir -p "$BUILD_DIR/ai-video-gen-main"
cp "$AI_SERVICE_DIR/app/ai-video-gen-main/generate_video.py" "$BUILD_DIR/ai-video-gen-main/"
cp "$AI_SERVICE_DIR/app/ai-video-gen-main/render_harness.py" "$BUILD_DIR/ai-video-gen-main/"
cp "$AI_SERVICE_DIR/app/ai-video-gen-main/dispatcher_install_js.py" "$BUILD_DIR/ai-video-gen-main/"
# shot_preprocess.py: shared HTML preprocessing (vx-timescale rewrite,
# stage-drift / GSAP CDN strip, vx-shot CSS-to-GSAP conversion). Imported
# by both worker.py (production /jobs) and screenshot_worker.py (the
# /shot/preview-mp4 single-shot path) so preview matches production exactly.
cp "$AI_SERVICE_DIR/app/ai-video-gen-main/shot_preprocess.py" "$BUILD_DIR/ai-video-gen-main/"
cp "$AI_SERVICE_DIR/app/ai-video-gen-main/video_options.json" "$BUILD_DIR/ai-video-gen-main/" 2>/dev/null || true
cp "$AI_SERVICE_DIR/app/ai-video-gen-main/captions_settings.json" "$BUILD_DIR/ai-video-gen-main/" 2>/dev/null || true
cp "$AI_SERVICE_DIR/app/ai-video-gen-main/branding.json" "$BUILD_DIR/ai-video-gen-main/" 2>/dev/null || true

# Copy assets directory if it exists (JavaScript helpers for Playwright)
if [ -d "$AI_SERVICE_DIR/app/ai-video-gen-main/assets" ]; then
    cp -r "$AI_SERVICE_DIR/app/ai-video-gen-main/assets" "$BUILD_DIR/ai-video-gen-main/"
fi

# Copy the extractor package (video indexing pipeline)
if [ -d "$SCRIPT_DIR/extractor" ]; then
    cp -r "$SCRIPT_DIR/extractor" "$BUILD_DIR/extractor/"
fi

# Copy the pdf_ocr package (copy-check OCR pipeline — paddleocr/pymupdf based).
# main.py imports `from pdf_ocr import run_pdf_ocr_pipeline`; without this
# block the curated build context omits it and the resulting image
# ModuleNotFoundErrors on the first /pdf-ocr-jobs request.
if [ -d "$SCRIPT_DIR/pdf_ocr" ]; then
    cp -r "$SCRIPT_DIR/pdf_ocr" "$BUILD_DIR/pdf_ocr/"
fi

if [ "$CONTEXT_ONLY" = "1" ]; then
    echo "==> --context-only set; leaving build context at $BUILD_DIR and exiting."
    exit 0
fi

echo "==> Building Docker image..."
cd "$BUILD_DIR"
docker build -t vacademy-render:latest .

echo "==> Cleaning up build context..."
rm -rf "$BUILD_DIR"

echo "==> Done! Image is now in the k3s registry pipeline via render_worker/deploy.sh."
