#!/bin/bash
# =============================================================
# Install BBB Recording Upload Hook
# =============================================================
# Run this script on the BBB server to install the post-publish
# hook that uploads recordings to S3 via the Vacademy backend.
#
# Prerequisites:
#   - BBB 3.0 installed and running
#   - ffmpeg installed (for WebM → MP4 conversion)
#   - python3 available (for JSON/XML parsing)
#
# Usage:
#   bash install-recording-hook.sh <BACKEND_URL> <BBB_SECRET>
#
# Example:
#   bash install-recording-hook.sh https://api.vacademy.io 8VhLHf3B2ouubT3nTJlUzD6m69oa8hC32GdWdpuvDU
# =============================================================

set -euo pipefail

BACKEND_URL="${1:?Usage: bash install-recording-hook.sh <BACKEND_URL> <BBB_SECRET>}"
BBB_SECRET="${2:?Usage: bash install-recording-hook.sh <BACKEND_URL> <BBB_SECRET>}"

HOOK_DIR="/usr/local/bigbluebutton/core/scripts/post_publish"
HOOK_SCRIPT="$HOOK_DIR/post-publish-s3-upload.sh"
CONF_FILE="/etc/bigbluebutton/vacademy-recording.conf"
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
SOURCE_SCRIPT="$SCRIPT_DIR/post-publish-s3-upload.sh"

echo "Installing Vacademy BBB Recording Upload Hook"
echo "============================================="
echo "  Backend URL: $BACKEND_URL"
echo "  Hook dir:    $HOOK_DIR"
echo ""

# ── 1. Install ffmpeg if not present ─────────────────────────
if ! command -v ffmpeg &>/dev/null; then
    echo "[1/5] Installing ffmpeg..."
    apt-get update -qq && apt-get install -y -qq ffmpeg
else
    echo "[1/5] ffmpeg already installed ✓"
fi

# ── 2. Configure BBB to retain raw recordings ────────────────
# Raw recordings contain individual webcam streams per user, which we
# need to extract the presenter-only video. By default BBB deletes
# raw files after publishing — this keeps them.
BBB_YML="/usr/local/bigbluebutton/core/scripts/bigbluebutton.yml"
echo "[2/5] Configuring BBB to retain raw recordings..."
if [ -f "$BBB_YML" ]; then
    if grep -q "^delete_raw_after_publish:" "$BBB_YML"; then
        # Update existing setting
        sed -i 's/^delete_raw_after_publish:.*/delete_raw_after_publish: false/' "$BBB_YML"
        echo "  Updated delete_raw_after_publish: false in $BBB_YML"
    elif grep -q "^#.*delete_raw_after_publish:" "$BBB_YML"; then
        # Uncomment and set
        sed -i 's/^#.*delete_raw_after_publish:.*/delete_raw_after_publish: false/' "$BBB_YML"
        echo "  Uncommented and set delete_raw_after_publish: false in $BBB_YML"
    else
        # Append
        echo "" >> "$BBB_YML"
        echo "# Retain raw recordings for presenter-only video extraction (Vacademy)" >> "$BBB_YML"
        echo "delete_raw_after_publish: false" >> "$BBB_YML"
        echo "  Appended delete_raw_after_publish: false to $BBB_YML"
    fi
else
    echo "  WARN: $BBB_YML not found — BBB may not be installed yet."
    echo "  After installing BBB, add this to $BBB_YML:"
    echo "    delete_raw_after_publish: false"
fi

# ── 3. Create configuration file ─────────────────────────────
echo "[3/5] Writing config to $CONF_FILE..."
cat > "$CONF_FILE" <<EOF
# Vacademy BBB Recording Upload Configuration
# Generated on $(date)

# Backend API URL (no trailing slash)
VACADEMY_BACKEND_URL=$BACKEND_URL

# BBB shared secret (must match the secret in the Vacademy DB)
VACADEMY_BBB_SECRET=$BBB_SECRET
EOF

chmod 644 "$CONF_FILE"
echo "  Config written (permissions: 644 — readable by bigbluebutton rap worker)"

# ── 4. Install the post-publish script ────────────────────────
echo "[4/5] Installing post-publish hook..."

# Ensure hook directory exists
mkdir -p "$HOOK_DIR"

# Remove old-named hook files from previous installations
rm -f "$HOOK_DIR/a]_vacademy_s3_upload.sh" "$HOOK_DIR/a]_vacademy_s3_upload.rb"

if [ -f "$SOURCE_SCRIPT" ]; then
    cp "$SOURCE_SCRIPT" "$HOOK_SCRIPT"
else
    echo "  ERROR: Source script not found at $SOURCE_SCRIPT"
    echo "  Please copy post-publish-s3-upload.sh to $HOOK_SCRIPT manually"
    exit 1
fi

chmod +x "$HOOK_SCRIPT"
echo "  Installed: $HOOK_SCRIPT"

# Create Ruby wrapper — BBB's rap-worker only executes .rb files
RUBY_WRAPPER="${HOOK_SCRIPT%.sh}.rb"
cat > "$RUBY_WRAPPER" << 'RUBYSCRIPT'
#!/usr/bin/ruby
# Wrapper to call the Vacademy S3 upload bash script
# BBB rap-worker only runs .rb files in post_publish/

meeting_id = nil
ARGV.each_with_index do |arg, i|
  meeting_id = ARGV[i + 1] if arg == '-m'
end

exit 0 if meeting_id.nil? || meeting_id.empty?

script = File.join(__dir__, File.basename(__FILE__, '.rb') + '.sh')
system("bash", script, meeting_id)
exit $?.exitstatus
RUBYSCRIPT
chmod +x "$RUBY_WRAPPER"
echo "  Ruby wrapper: $RUBY_WRAPPER"

# ── 5. Create log file ───────────────────────────────────────
echo "[5/5] Setting up logging..."
LOG_FILE="/var/log/bigbluebutton/vacademy-recording-upload.log"
touch "$LOG_FILE"
chown bigbluebutton:bigbluebutton "$LOG_FILE" 2>/dev/null || true
echo "  Log file: $LOG_FILE"

# ── Done ──────────────────────────────────────────────────────
echo ""
echo "============================================="
echo "  Installation complete!"
echo "============================================="
echo ""
echo "The recording upload hook will run automatically"
echo "after each BBB recording is processed."
echo ""
echo "To test:"
echo "  1. Start a BBB meeting with recording enabled"
echo "  2. Record for a few minutes, then end the meeting"
echo "  3. Wait for BBB to process the recording (~5-15 min)"
echo "  4. Check the log: tail -f $LOG_FILE"
echo ""
echo "NOTE: Raw recordings are now retained on disk for presenter"
echo "extraction. Monitor disk usage and clean up old raw recordings"
echo "periodically with:"
echo "  find /var/bigbluebutton/recording/raw/ -maxdepth 1 -mtime +7 -exec rm -rf {} +"
echo ""
echo "To uninstall:"
echo "  rm $HOOK_SCRIPT $CONF_FILE"
echo "  # Optionally restore raw deletion:"
echo "  # sed -i 's/^delete_raw_after_publish: false/delete_raw_after_publish: true/' $BBB_YML"
echo ""
