#!/bin/bash
# =============================================================
# Auto-fix BBB IP on boot
# Install on BBB server: runs as systemd service at startup
# Detects new IP and updates all BBB config files
# =============================================================

set -euo pipefail

LOG_TAG="bbb-fix-ip"

log() {
    echo "$(date '+%Y-%m-%d %H:%M:%S') $1" | tee >(logger -t "$LOG_TAG")
}

# Get current public IP
NEW_IP=$(curl -s --connect-timeout 5 http://169.254.169.254/hetzner/v1/metadata/public-ipv4 2>/dev/null || \
         curl -s --connect-timeout 5 https://ifconfig.me 2>/dev/null || \
         curl -s --connect-timeout 5 https://api.ipify.org 2>/dev/null || \
         echo "")

if [ -z "$NEW_IP" ]; then
    log "ERROR: Could not determine public IP"
    exit 1
fi

# Get domain name from nginx (e.g., meet.vacademy.io)
BBB_DOMAIN=$(grep -oP 'server_name\s+\K[^;]+' /etc/nginx/sites-available/bigbluebutton 2>/dev/null | head -1)
if [ -z "$BBB_DOMAIN" ] || echo "$BBB_DOMAIN" | grep -qP '^\d+\.\d+\.\d+\.\d+$'; then
    BBB_DOMAIN="$NEW_IP"
fi

# Collect ALL old IPs from critical config files (not from bbb-web which stores domain)
OLD_IPS=$(grep -ohP '\d+\.\d+\.\d+\.\d+' \
    /opt/freeswitch/etc/freeswitch/vars.xml \
    /opt/freeswitch/etc/freeswitch/sip_profiles/external.xml \
    /etc/bigbluebutton/bbb-webrtc-sfu/production.yml \
    /usr/share/bigbluebutton/nginx/sip.nginx \
    2>/dev/null | grep -v '127\.\|0\.0\.\|255\.\|169\.254\.' | sort -u)

NEEDS_FIX=false
for ip in $OLD_IPS; do
    if [ "$ip" != "$NEW_IP" ]; then
        NEEDS_FIX=true
        break
    fi
done

if [ "$NEEDS_FIX" != "true" ]; then
    log "All IPs correct ($NEW_IP), domain=$BBB_DOMAIN — restarting BBB"
    bbb-conf --restart 2>&1 | tail -5
    exit 0
fi

log "Stale IPs found — fixing to $NEW_IP (domain: $BBB_DOMAIN)"

# Step 1: Set domain for web URLs
log "Setting BBB hostname to $BBB_DOMAIN"
bbb-conf --setip "$BBB_DOMAIN" 2>&1 | tail -5

# Step 2: Replace ALL old IPs with new IP across all config dirs
log "Replacing stale IPs..."
for dir in /opt/freeswitch/etc/freeswitch /usr/share/bigbluebutton/nginx \
           /etc/bigbluebutton /usr/local/bigbluebutton/bbb-webrtc-sfu/config \
           /etc/nginx; do
    [ -d "$dir" ] || continue
    find "$dir" -type f \( \
        -name "*.yml" -o -name "*.yaml" -o -name "*.xml" -o -name "*.conf" \
        -o -name "*.override" -o -name "*.nginx" -o -name "*.properties" \
    \) 2>/dev/null | while read -r f; do
        FILE_IPS=$(grep -oP '\d+\.\d+\.\d+\.\d+' "$f" 2>/dev/null | grep -v '127\.\|0\.0\.\|255\.\|169\.254\.' | sort -u)
        for old in $FILE_IPS; do
            if [ "$old" != "$NEW_IP" ]; then
                log "  $f: $old → $NEW_IP"
                sed -i "s/$old/$NEW_IP/g" "$f"
            fi
        done
    done
done

# Step 3: Restart services
log "Restarting FreeSWITCH..."
systemctl restart freeswitch || true
sleep 3

log "Restarting BigBlueButton..."
bbb-conf --restart 2>&1 | tail -5

# Step 4: Verify — re-apply to critical files (bbb-conf --restart may overwrite)
log "Verifying critical config files..."
for f in /etc/bigbluebutton/bbb-webrtc-sfu/production.yml \
         /opt/freeswitch/etc/freeswitch/vars.xml \
         /opt/freeswitch/etc/freeswitch/sip_profiles/external.xml \
         /usr/share/bigbluebutton/nginx/sip.nginx; do
    [ -f "$f" ] || continue
    FILE_IPS=$(grep -oP '\d+\.\d+\.\d+\.\d+' "$f" 2>/dev/null | grep -v '127\.\|0\.0\.\|255\.\|169\.254\.' | sort -u)
    for old in $FILE_IPS; do
        if [ "$old" != "$NEW_IP" ]; then
            log "  REFIX: $f: $old → $NEW_IP"
            sed -i "s/$old/$NEW_IP/g" "$f"
        fi
    done
done
systemctl restart bbb-webrtc-sfu freeswitch 2>/dev/null || true

# Step 5: Fix default presentation URL to use domain
sed -i "s|defaultUploadedPresentation=https://[^/]*/|defaultUploadedPresentation=https://$BBB_DOMAIN/|g" \
    /etc/bigbluebutton/bbb-web.properties 2>/dev/null || true

log "BBB IP fix complete: $BBB_DOMAIN ($NEW_IP)"
