#!/bin/bash
# =============================================================
# Deploy BBB scheduler to backend-stage server
# =============================================================
# Usage: ./deploy-scheduler.sh
#
# Deploys bbb-schedule.sh + .env + systemd timers to backend-stage
# so the BBB server auto-starts/stops reliably via systemd.
# =============================================================

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
TARGET_HOST="root@172.232.85.240"
REMOTE_DIR="/opt/bbb-schedule"

echo "=== Deploying BBB Scheduler to backend-stage ==="
echo "  Target: $TARGET_HOST:$REMOTE_DIR"
echo ""

# Remove stale host key
ssh-keygen -R "172.232.85.240" 2>/dev/null || true

# Step 1: Create remote directory
echo "[1/4] Creating remote directory..."
ssh -o StrictHostKeyChecking=accept-new "$TARGET_HOST" "mkdir -p $REMOTE_DIR"

# Step 2: Upload files
echo "[2/4] Uploading scripts and config..."
scp -o StrictHostKeyChecking=accept-new \
    "$SCRIPT_DIR/bbb-schedule.sh" \
    "$SCRIPT_DIR/.env" \
    "$TARGET_HOST:$REMOTE_DIR/"

ssh "$TARGET_HOST" "chmod +x $REMOTE_DIR/bbb-schedule.sh"

# Step 3: Install systemd units
echo "[3/4] Installing systemd timers..."
scp -o StrictHostKeyChecking=accept-new \
    "$SCRIPT_DIR/systemd/bbb-start.service" \
    "$SCRIPT_DIR/systemd/bbb-start.timer" \
    "$SCRIPT_DIR/systemd/bbb-stop.service" \
    "$SCRIPT_DIR/systemd/bbb-stop.timer" \
    "$SCRIPT_DIR/systemd/bbb-healthcheck.service" \
    "$SCRIPT_DIR/systemd/bbb-healthcheck.timer" \
    "$TARGET_HOST:/etc/systemd/system/"

# Step 4: Enable and start timers
echo "[4/4] Enabling timers..."
ssh "$TARGET_HOST" bash -s <<'REMOTE'
    # Ensure jq is installed
    if ! command -v jq &>/dev/null; then
        apt-get update -qq && apt-get install -y -qq jq
    fi

    systemctl daemon-reload
    systemctl enable --now bbb-start.timer
    systemctl enable --now bbb-stop.timer
    systemctl enable --now bbb-healthcheck.timer

    echo ""
    echo "=== Timer status ==="
    systemctl list-timers bbb-start.timer bbb-stop.timer bbb-healthcheck.timer --no-pager
    echo ""
    echo "=== Next triggers ==="
    systemctl status bbb-start.timer --no-pager | grep -E "Trigger|Active"
    systemctl status bbb-stop.timer --no-pager | grep -E "Trigger|Active"
    systemctl status bbb-healthcheck.timer --no-pager | grep -E "Trigger|Active"
REMOTE

echo ""
echo "============================================="
echo " Deployed successfully!"
echo " Start:       Mon-Sat 3:30 PM IST"
echo " Healthcheck: Mon-Sat 3:45 PM IST (WhatsApp)"
echo " Stop:        Mon-Sat 9:00 PM IST"
echo "============================================="
echo ""
echo " Test manually:"
echo "   ssh $TARGET_HOST '$REMOTE_DIR/bbb-schedule.sh start'"
echo "   ssh $TARGET_HOST '$REMOTE_DIR/bbb-schedule.sh stop'"
echo ""
echo " Check timer status:"
echo "   ssh $TARGET_HOST 'systemctl list-timers bbb-*'"
echo ""
echo " View logs:"
echo "   ssh $TARGET_HOST 'journalctl -t bbb-schedule --since today'"
