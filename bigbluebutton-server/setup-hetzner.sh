#!/bin/bash
# =============================================================
# Hetzner CCX33 — BigBlueButton 3.0 Server Setup
# =============================================================
# Run this script on a FRESH Ubuntu 22.04 Hetzner CCX33 instance.
#
# Before running:
#   1. Create a CCX33 instance on Hetzner Cloud (8 vCPU / 32 GB / 240 GB)
#   2. Choose Ubuntu 22.04 as the OS image
#   3. Point a DNS A record (e.g. bbb.vacademy.io) to the server's IP
#   4. SSH into the server as root
#   5. Upload this script and run:  bash setup-hetzner.sh
#
# Usage:
#   bash setup-hetzner.sh <HOSTNAME> <EMAIL>
#   Example: bash setup-hetzner.sh bbb.vacademy.io admin@vacademy.io
# =============================================================

set -euo pipefail

# ── Args ──────────────────────────────────────────────────────
BBB_HOSTNAME="${1:?Usage: bash setup-hetzner.sh <HOSTNAME> <LETSENCRYPT_EMAIL>}"
LETSENCRYPT_EMAIL="${2:?Usage: bash setup-hetzner.sh <HOSTNAME> <LETSENCRYPT_EMAIL>}"

echo "============================================="
echo " BigBlueButton 3.0 Setup"
echo " Host:  $BBB_HOSTNAME"
echo " Email: $LETSENCRYPT_EMAIL"
echo "============================================="

# ── 1. System updates ────────────────────────────────────────
echo "[1/6] Updating system packages..."
apt-get update && apt-get dist-upgrade -y

# ── 2. Locale ─────────────────────────────────────────────────
echo "[2/6] Setting locale..."
cat > /etc/default/locale <<EOF
LANG="en_US.UTF-8"
EOF
locale-gen en_US.UTF-8
update-locale LANG=en_US.UTF-8

# ── 3. Docker (required by BBB 3.0) ──────────────────────────
echo "[3/6] Installing Docker..."
if ! command -v docker &>/dev/null; then
    curl -fsSL https://get.docker.com | bash
    systemctl enable --now docker
else
    echo "  Docker already installed, skipping."
fi

# ── 4. Firewall ───────────────────────────────────────────────
echo "[4/6] Configuring firewall..."
ufw allow 22/tcp       # SSH
ufw allow 80/tcp       # HTTP (redirect)
ufw allow 443/tcp      # HTTPS
ufw allow 16384:32768/udp  # WebRTC media
ufw --force enable

# ── 5. Swap (BBB recommends swap enabled) ─────────────────────
echo "[5/6] Setting up swap..."
if [ ! -f /swapfile ]; then
    fallocate -l 4G /swapfile
    chmod 600 /swapfile
    mkswap /swapfile
    swapon /swapfile
    echo '/swapfile none swap sw 0 0' >> /etc/fstab
    echo "  4 GB swap created."
else
    echo "  Swap already exists, skipping."
fi

# ── 6. Install BigBlueButton 3.0 ─────────────────────────────
echo "[6/6] Installing BigBlueButton 3.0..."
echo "  This will take 15-30 minutes..."

wget -qO- https://raw.githubusercontent.com/bigbluebutton/bbb-install/v3.0.x-release/bbb-install.sh | bash -s -- \
    -v jammy-300 \
    -s "$BBB_HOSTNAME" \
    -e "$LETSENCRYPT_EMAIL" \
    -g \
    -w

# ── Done ──────────────────────────────────────────────────────
echo ""
echo "============================================="
echo " BigBlueButton installed!"
echo "============================================="
echo ""
echo "Useful commands:"
echo "  sudo bbb-conf --check    # verify installation"
echo "  sudo bbb-conf --status   # check service status"
echo "  sudo bbb-conf --secret   # get API URL + shared secret"
echo ""
echo "Next steps:"
echo "  1. Run: sudo bbb-conf --secret"
echo "  2. Copy the URL and Secret into your Vacademy backend config"
echo "  3. Test at: https://$BBB_HOSTNAME"
echo ""
