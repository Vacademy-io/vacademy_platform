#!/bin/bash
# =============================================================
# Hetzner BBB Server Pool — Start / Stop / Status
# =============================================================
# Manages a POOL of BigBlueButton servers on Hetzner Cloud.
# Each server has its own domain, snapshot chain, and Hetzner type.
#
# Usage:
#   ./manage-server.sh [--server N|all] <command>
#
#   --server N    Select server by priority (1, 2, ...). Default: 1
#   --server all  Loop command over all servers
#
# Commands:
#   start      Restore from snapshot + update DNS (billing starts)
#   stop       Snapshot + delete server (STOPS billing)
#   pause      Power off (fast, billing continues)
#   resume     Power on (fast)
#   status     Show server state
#   ip         Get server IP
#   ssh        SSH into the server
#   snapshots  List snapshots for this server
#   sync       Sync scripts to the server
#   deploy     Upload & run configure-bbb.sh
#   create     First-time server creation (fresh Ubuntu)
#   provision  Full automated BBB setup (create, install, snapshot, delete)
#   destroy    Permanently delete server + snapshots
#
# Examples:
#   ./manage-server.sh start                  # Start server 1 (default)
#   ./manage-server.sh --server 2 start       # Start server 2
#   ./manage-server.sh --server all status    # Status of all servers
#   ./manage-server.sh --server 2 ssh         # SSH into server 2
#   ./manage-server.sh --server 2 provision   # First-time setup for server 2
# =============================================================

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"

# ── Load .env ─────────────────────────────────────────────────
if [ -f "$SCRIPT_DIR/.env" ]; then
    set -a
    source "$SCRIPT_DIR/.env"
    set +a
fi

# ── Pool config ───────────────────────────────────────────────
POOL_CONFIG="$SCRIPT_DIR/pool-config.json"
if [ ! -f "$POOL_CONFIG" ]; then
    echo "ERROR: pool-config.json not found at $POOL_CONFIG"
    exit 1
fi

# ── Parse --server flag ──────────────────────────────────────
TARGET_SERVER="1"
if [ "${1:-}" = "--server" ]; then
    TARGET_SERVER="${2:-1}"
    shift 2
fi

# ── API config ────────────────────────────────────────────────
API_BASE="https://api.hetzner.cloud/v1"
TOKEN="${HETZNER_API_TOKEN:?Set HETZNER_API_TOKEN in .env}"
CF_TOKEN="${CLOUDFLARE_API_TOKEN:-}"
CF_ZONE="${CLOUDFLARE_ZONE_ID:-}"

# ── Read server config from pool-config.json ──────────────────

get_server_config() {
    local priority="$1"
    python3 -c "
import json, sys
with open('$POOL_CONFIG') as f:
    cfg = json.load(f)
servers = sorted(cfg['servers'], key=lambda s: s['priority'])
# Find by priority
for s in servers:
    if str(s['priority']) == '$priority':
        for k, v in s.items():
            print(f'{k}={v}')
        sys.exit(0)
print('ERROR=not_found')
sys.exit(1)
" 2>/dev/null
}

get_all_priorities() {
    python3 -c "
import json
with open('$POOL_CONFIG') as f:
    cfg = json.load(f)
for s in sorted(cfg['servers'], key=lambda s: s['priority']):
    print(s['priority'])
" 2>/dev/null
}

# Load config for the target server
load_server_vars() {
    local priority="$1"
    local config_output
    config_output=$(get_server_config "$priority")
    if echo "$config_output" | grep -q "ERROR=not_found"; then
        echo "ERROR: No server with priority=$priority in pool-config.json"
        exit 1
    fi

    # Parse key=value pairs into variables
    SERVER_SLUG=$(echo "$config_output" | grep "^slug=" | cut -d= -f2)
    SERVER_TYPE=$(echo "$config_output" | grep "^server_type=" | cut -d= -f2)
    SERVER_NAME=$(echo "$config_output" | grep "^server_name=" | cut -d= -f2)
    BBB_HOST=$(echo "$config_output" | grep "^domain=" | cut -d= -f2)
    SNAPSHOT_DESC=$(echo "$config_output" | grep "^snapshot_desc=" | cut -d= -f2)
    LOCATION=$(echo "$config_output" | grep "^location=" | cut -d= -f2)
    SERVER_PRIORITY="$priority"

    BBB_RECORD="${BBB_HOST%%.*}"  # "meet" from "meet.vacademy.io", "meet2" from "meet2.vacademy.io"

    # Per-server state files
    SERVER_ID_FILE="$SCRIPT_DIR/.server-id-${priority}"
    SNAPSHOT_ID_FILE="$SCRIPT_DIR/.snapshot-id-${priority}"

    # Load server ID from state file
    HETZNER_BBB_SERVER_ID=""
    if [ -f "$SERVER_ID_FILE" ]; then
        HETZNER_BBB_SERVER_ID="$(cat "$SERVER_ID_FILE")"
    fi
}

# ── API helpers ───────────────────────────────────────────────

hcloud_api() {
    local method="$1" endpoint="$2"
    shift 2
    curl -s -X "$method" \
        -H "Authorization: Bearer $TOKEN" \
        -H "Content-Type: application/json" \
        "$API_BASE$endpoint" "$@"
}

lookup_server_by_name() {
    local result
    result=$(hcloud_api GET "/servers?name=$SERVER_NAME" | python3 -c "
import sys, json
servers = json.load(sys.stdin).get('servers', [])
if servers:
    s = servers[0]
    print(f\"{s['id']}|{s['status']}|{s['public_net']['ipv4']['ip']}\")
" 2>/dev/null)
    echo "$result"
}

get_server_id() {
    if [ -n "${HETZNER_BBB_SERVER_ID:-}" ]; then
        echo "$HETZNER_BBB_SERVER_ID"
        return 0
    fi
    local lookup
    lookup=$(lookup_server_by_name)
    if [ -n "$lookup" ]; then
        local found_id
        found_id=$(echo "$lookup" | cut -d'|' -f1)
        save_server_id "$found_id"
        echo "$found_id"
        return 0
    fi
    echo "Server '$SERVER_NAME' not found." >&2
    return 1
}

save_server_id() {
    echo "$1" > "$SERVER_ID_FILE"
    HETZNER_BBB_SERVER_ID="$1"
}

clear_server_id() {
    rm -f "$SERVER_ID_FILE"
    unset HETZNER_BBB_SERVER_ID 2>/dev/null || true
}

save_snapshot_id() {
    echo "$1" > "$SNAPSHOT_ID_FILE"
}

get_snapshot_id() {
    # 1. Check per-server state file
    if [ -f "$SNAPSHOT_ID_FILE" ]; then
        cat "$SNAPSHOT_ID_FILE"
        return
    fi

    # 2. Fallback: legacy .snapshot-id (server 1 backward compat)
    local legacy="$SCRIPT_DIR/.snapshot-id"
    if [ "$SERVER_PRIORITY" = "1" ] && [ -f "$legacy" ]; then
        local id
        id=$(cat "$legacy" | tr -d '[:space:]')
        if [ -n "$id" ]; then
            echo "$id" > "$SNAPSHOT_ID_FILE"  # migrate to new format
            echo "$id"
            return
        fi
    fi

    # 3. Fallback: search Hetzner API by snapshot description
    local api_snap
    api_snap=$(hcloud_api GET "/images?type=snapshot&sort=created:desc&per_page=50" 2>/dev/null | python3 -c "
import sys, json
images = json.load(sys.stdin).get('images', [])
desc = '$SNAPSHOT_DESC'
matches = [i for i in images if desc in (i.get('description') or '')]
if matches:
    matches.sort(key=lambda x: x.get('created', ''), reverse=True)
    print(matches[0]['id'])
" 2>/dev/null)

    if [ -n "$api_snap" ]; then
        echo "$api_snap" > "$SNAPSHOT_ID_FILE"  # cache locally
        echo "$api_snap"
        return
    fi

    echo ""
}

# ── Wait for action ──────────────────────────────────────────

wait_for_action() {
    local action_id="$1"
    local description="${2:-action}"
    local timeout="${3:-300}"
    local elapsed=0

    echo "  Waiting for $description to complete..."
    while [ $elapsed -lt $timeout ]; do
        sleep 5
        elapsed=$((elapsed + 5))
        local STATUS
        STATUS=$(hcloud_api GET "/actions/$action_id" | python3 -c "
import sys, json
a = json.load(sys.stdin).get('action', {})
print(a.get('status', 'unknown'))
" 2>/dev/null)

        case "$STATUS" in
            success)
                echo "  $description completed."
                return 0
                ;;
            error)
                echo "  ERROR: $description failed!"
                return 1
                ;;
            *)
                printf "  ... %ds elapsed (%s)\r" "$elapsed" "$STATUS"
                ;;
        esac
    done
    echo ""
    echo "  ERROR: Timeout after ${timeout}s waiting for $description"
    return 1
}

# ── Cloudflare DNS ────────────────────────────────────────────

update_dns() {
    local ip="$1"

    if [ -z "$CF_TOKEN" ] || [ -z "$CF_ZONE" ]; then
        echo "  Cloudflare not configured — update DNS manually to $ip"
        return 0
    fi

    echo "  Updating DNS: $BBB_HOST → $ip"

    EXISTING=$(curl -s -X GET \
        "https://api.cloudflare.com/client/v4/zones/$CF_ZONE/dns_records?type=A&name=$BBB_HOST" \
        -H "Authorization: Bearer $CF_TOKEN" \
        -H "Content-Type: application/json")

    RECORD_ID=$(echo "$EXISTING" | python3 -c "
import sys, json
r = json.load(sys.stdin).get('result', [])
print(r[0]['id'] if r else '')
" 2>/dev/null || echo "")

    if [ -n "$RECORD_ID" ]; then
        curl -s -X PUT \
            "https://api.cloudflare.com/client/v4/zones/$CF_ZONE/dns_records/$RECORD_ID" \
            -H "Authorization: Bearer $CF_TOKEN" \
            -H "Content-Type: application/json" \
            -d "{\"type\":\"A\",\"name\":\"$BBB_RECORD\",\"content\":\"$ip\",\"ttl\":120,\"proxied\":false}" \
            | python3 -c "import sys,json; r=json.load(sys.stdin); print('  DNS updated!' if r.get('success') else f'  DNS error: {r}')" 2>/dev/null
    else
        curl -s -X POST \
            "https://api.cloudflare.com/client/v4/zones/$CF_ZONE/dns_records" \
            -H "Authorization: Bearer $CF_TOKEN" \
            -H "Content-Type: application/json" \
            -d "{\"type\":\"A\",\"name\":\"$BBB_RECORD\",\"content\":\"$ip\",\"ttl\":120,\"proxied\":false}" \
            | python3 -c "import sys,json; r=json.load(sys.stdin); print('  DNS created!' if r.get('success') else f'  DNS error: {r}')" 2>/dev/null
    fi
}

# ── Commands ──────────────────────────────────────────────────

cmd_create() {
    echo "[$SERVER_SLUG] Creating Hetzner $SERVER_TYPE server..."
    echo "  Name:     $SERVER_NAME"
    echo "  Type:     $SERVER_TYPE"
    echo "  Location: $LOCATION"
    echo "  Hostname: $BBB_HOST"
    echo ""

    SSH_KEYS=$(hcloud_api GET "/ssh_keys" | python3 -c "
import sys, json
keys = json.load(sys.stdin).get('ssh_keys', [])
print(','.join(str(k['id']) for k in keys))
" 2>/dev/null || echo "")

    SSH_KEY_PARAM=""
    if [ -n "$SSH_KEYS" ]; then
        SSH_KEY_PARAM="\"ssh_keys\": [$(echo "$SSH_KEYS" | tr ',' ',')],"
    fi

    RESPONSE=$(hcloud_api POST "/servers" -d "{
        \"name\": \"$SERVER_NAME\",
        \"server_type\": \"$SERVER_TYPE\",
        \"image\": \"ubuntu-22.04\",
        \"location\": \"$LOCATION\",
        $SSH_KEY_PARAM
        \"labels\": {\"project\": \"vacademy\", \"service\": \"bbb\", \"pool\": \"$SERVER_SLUG\"},
        \"start_after_create\": true
    }")

    SERVER_ID=$(echo "$RESPONSE" | python3 -c "import sys, json; print(json.load(sys.stdin)['server']['id'])" 2>/dev/null)
    SERVER_IP=$(echo "$RESPONSE" | python3 -c "import sys, json; print(json.load(sys.stdin)['server']['public_net']['ipv4']['ip'])" 2>/dev/null)

    if [ -n "$SERVER_ID" ]; then
        save_server_id "$SERVER_ID"
        update_dns "$SERVER_IP"

        echo ""
        echo "============================================="
        echo " [$SERVER_SLUG] Server created!"
        echo " ID:   $SERVER_ID"
        echo " IP:   $SERVER_IP"
        echo " DNS:  $BBB_HOST → $SERVER_IP"
        echo "============================================="
    else
        echo "ERROR: Failed to create server"
        echo "$RESPONSE" | python3 -m json.tool 2>/dev/null || echo "$RESPONSE"
        exit 1
    fi
}

cmd_stop() {
    local sid
    sid=$(get_server_id)

    echo "============================================="
    echo " [$SERVER_SLUG] Stopping (snapshot + delete)"
    echo " Snapshot label: $SNAPSHOT_DESC"
    echo "============================================="
    echo ""

    # Step 1: Verify server exists
    echo "[1/4] Checking server status..."
    local server_status
    server_status=$(hcloud_api GET "/servers/$sid" | python3 -c "
import sys, json
s = json.load(sys.stdin).get('server', {})
print(s.get('status', 'unknown'))
" 2>/dev/null)

    if [ "$server_status" = "unknown" ] || [ -z "$server_status" ]; then
        echo "  ERROR: Server $sid not found."
        exit 1
    fi
    echo "  Server status: $server_status"

    # Step 2: Power off
    if [ "$server_status" = "running" ]; then
        echo "[2/4] Shutting down server..."
        local shutdown_response
        shutdown_response=$(hcloud_api POST "/servers/$sid/actions/shutdown")
        local shutdown_action_id
        shutdown_action_id=$(echo "$shutdown_response" | python3 -c "import sys,json; print(json.load(sys.stdin).get('action',{}).get('id',''))" 2>/dev/null)
        if [ -n "$shutdown_action_id" ]; then
            wait_for_action "$shutdown_action_id" "shutdown" 120
        fi

        sleep 3
        local post_shutdown_status
        post_shutdown_status=$(hcloud_api GET "/servers/$sid" | python3 -c "import sys,json; print(json.load(sys.stdin)['server']['status'])" 2>/dev/null)
        if [ "$post_shutdown_status" != "off" ]; then
            echo "  Force powering off..."
            local poweroff_response
            poweroff_response=$(hcloud_api POST "/servers/$sid/actions/poweroff")
            local poweroff_action_id
            poweroff_action_id=$(echo "$poweroff_response" | python3 -c "import sys,json; print(json.load(sys.stdin).get('action',{}).get('id',''))" 2>/dev/null)
            if [ -n "$poweroff_action_id" ]; then
                wait_for_action "$poweroff_action_id" "force poweroff" 60
            fi
        fi
    else
        echo "[2/4] Server already off."
    fi

    # Step 3: Create snapshot with per-server label
    echo "[3/4] Creating snapshot '$SNAPSHOT_DESC'..."
    local snap_response
    snap_response=$(hcloud_api POST "/servers/$sid/actions/create_image" -d "{
        \"description\": \"$SNAPSHOT_DESC\",
        \"type\": \"snapshot\",
        \"labels\": {\"project\": \"vacademy\", \"service\": \"bbb\", \"pool\": \"$SERVER_SLUG\", \"auto\": \"true\"}
    }")

    local snap_action_id snap_image_id
    snap_action_id=$(echo "$snap_response" | python3 -c "import sys,json; print(json.load(sys.stdin).get('action',{}).get('id',''))" 2>/dev/null)
    snap_image_id=$(echo "$snap_response" | python3 -c "import sys,json; print(json.load(sys.stdin).get('image',{}).get('id',''))" 2>/dev/null)

    if [ -z "$snap_action_id" ] || [ -z "$snap_image_id" ]; then
        echo "  ERROR: Failed to create snapshot!"
        echo "  Server NOT deleted. Billing continues."
        exit 1
    fi

    echo "  Snapshot ID: $snap_image_id"
    if ! wait_for_action "$snap_action_id" "snapshot creation" 1200; then
        echo "  ERROR: Snapshot failed. NOT deleting server."
        exit 1
    fi

    # Verify snapshot
    local snap_status
    snap_status=$(hcloud_api GET "/images/$snap_image_id" | python3 -c "
import sys, json
print(json.load(sys.stdin).get('image', {}).get('status', 'unknown'))
" 2>/dev/null)

    if [ "$snap_status" != "available" ]; then
        echo "  ERROR: Snapshot status is '$snap_status'. NOT deleting server."
        exit 1
    fi

    save_snapshot_id "$snap_image_id"

    # Step 4: Delete server
    echo "[4/4] Deleting server..."
    hcloud_api DELETE "/servers/$sid" > /dev/null

    sleep 2
    local verify_deleted
    verify_deleted=$(hcloud_api GET "/servers/$sid" | python3 -c "
import sys, json
print(json.load(sys.stdin).get('error', {}).get('code', 'exists'))
" 2>/dev/null)

    if [ "$verify_deleted" = "not_found" ]; then
        clear_server_id
        echo ""
        echo "============================================="
        echo " [$SERVER_SLUG] Stopped & deleted!"
        echo " Snapshot: $snap_image_id ($SNAPSHOT_DESC)"
        echo " Billing: STOPPED"
        echo "============================================="

        # Update pool DB status to STOPPED
        local backend_url="${ADMIN_CORE_SERVICE_BASE_URL:-https://backend-stage.vacademy.io/admin-core-service}"
        curl -s -o /dev/null -X POST \
            "$backend_url/bbb/pool/$SERVER_SLUG/status" \
            -H "Content-Type: application/json" \
            -d '{"status": "STOPPED"}' 2>/dev/null && echo "  Pool DB updated: status=STOPPED" || true

        cmd_cleanup_snapshots
    else
        echo "  WARNING: Deletion may not have completed."
    fi
}

cmd_start() {
    # Check if server already exists
    if [ -n "${HETZNER_BBB_SERVER_ID:-}" ]; then
        local existing_status
        existing_status=$(hcloud_api GET "/servers/$HETZNER_BBB_SERVER_ID" | python3 -c "
import sys, json
print(json.load(sys.stdin).get('server', {}).get('status', ''))
" 2>/dev/null)

        if [ "$existing_status" = "running" ]; then
            echo "[$SERVER_SLUG] Server already running!"
            cmd_status
            return 0
        elif [ "$existing_status" = "off" ]; then
            echo "[$SERVER_SLUG] Server exists but powered off."
            read -p "Power on? (yes/no): " confirm
            if [ "$confirm" = "yes" ]; then
                cmd_resume
                return 0
            fi
            return 1
        fi
    fi

    # Restore from snapshot
    local snapshot_id
    snapshot_id=$(get_snapshot_id)

    if [ -z "$snapshot_id" ]; then
        echo "[$SERVER_SLUG] ERROR: No snapshot found."
        echo "  First-time? Use: ./manage-server.sh --server $TARGET_SERVER create"
        echo "  Or provision:    ./manage-server.sh --server $TARGET_SERVER provision"
        exit 1
    fi

    echo "============================================="
    echo " [$SERVER_SLUG] Starting from snapshot"
    echo " Snapshot: $snapshot_id"
    echo " Type: $SERVER_TYPE | Domain: $BBB_HOST"
    echo "============================================="
    echo ""

    # Verify snapshot
    local snap_check
    snap_check=$(hcloud_api GET "/images/$snapshot_id" | python3 -c "
import sys, json
print(json.load(sys.stdin).get('image', {}).get('status', 'not_found'))
" 2>/dev/null)

    if [ "$snap_check" != "available" ]; then
        echo "ERROR: Snapshot $snapshot_id not available (status: $snap_check)"
        exit 1
    fi

    echo "[1/3] Creating server from snapshot..."

    SSH_KEYS=$(hcloud_api GET "/ssh_keys" | python3 -c "
import sys, json
keys = json.load(sys.stdin).get('ssh_keys', [])
print(','.join(str(k['id']) for k in keys))
" 2>/dev/null || echo "")

    SSH_KEY_PARAM=""
    if [ -n "$SSH_KEYS" ]; then
        SSH_KEY_PARAM="\"ssh_keys\": [$(echo "$SSH_KEYS" | tr ',' ',')],"
    fi

    RESPONSE=$(hcloud_api POST "/servers" -d "{
        \"name\": \"$SERVER_NAME\",
        \"server_type\": \"$SERVER_TYPE\",
        \"image\": \"$snapshot_id\",
        \"location\": \"$LOCATION\",
        $SSH_KEY_PARAM
        \"labels\": {\"project\": \"vacademy\", \"service\": \"bbb\", \"pool\": \"$SERVER_SLUG\"},
        \"start_after_create\": true
    }")

    local new_server_id new_server_ip
    new_server_id=$(echo "$RESPONSE" | python3 -c "import sys, json; print(json.load(sys.stdin)['server']['id'])" 2>/dev/null)
    new_server_ip=$(echo "$RESPONSE" | python3 -c "import sys, json; print(json.load(sys.stdin)['server']['public_net']['ipv4']['ip'])" 2>/dev/null)

    if [ -z "$new_server_id" ]; then
        echo "ERROR: Failed to create server!"
        echo "$RESPONSE" | python3 -m json.tool 2>/dev/null || echo "$RESPONSE"
        exit 1
    fi

    save_server_id "$new_server_id"
    echo "  Server ID: $new_server_id"
    echo "  IP: $new_server_ip"

    echo "[2/5] Waiting for boot..."
    for i in $(seq 1 60); do
        sleep 10
        STATE=$(hcloud_api GET "/servers/$new_server_id" | python3 -c "import sys, json; print(json.load(sys.stdin)['server']['status'])" 2>/dev/null)
        if [ "$STATE" = "running" ]; then
            break
        fi
        printf "  ... %ds (%s)\r" "$((i * 10))" "$STATE"
    done

    local final_ip
    final_ip=$(hcloud_api GET "/servers/$new_server_id" | python3 -c "import sys, json; print(json.load(sys.stdin)['server']['public_net']['ipv4']['ip'])" 2>/dev/null)

    echo "[3/5] Updating DNS..."
    update_dns "$final_ip"

    echo "[4/5] Configuring BBB hostname..."
    local ssh_opts="-o StrictHostKeyChecking=accept-new -o ConnectTimeout=10 -o BatchMode=yes"
    local ssh_ready=false
    for i in $(seq 1 36); do
        if ssh $ssh_opts "root@$final_ip" "echo ok" 2>/dev/null; then
            ssh_ready=true
            break
        fi
        sleep 5
        printf "  Waiting for SSH... (%ds)\r" "$((i * 5))"
    done

    if [ "$ssh_ready" = "true" ]; then
        ssh $ssh_opts "root@$final_ip" bash -s "$BBB_HOST" "$final_ip" <<'REMOTE'
            DOMAIN="$1"
            NEW_IP="$2"

            # Step 1: Set domain for web URLs (includes internal restart)
            bbb-conf --setip "$DOMAIN" 2>&1 | tail -3

            # Step 2: Fix IPs in configs that bbb-conf --setip doesn't update
            # (FreeSWITCH, bbb-webrtc-sfu, nginx sip proxy)
            echo "Fixing stale IPs to $NEW_IP..."
            for dir in /opt/freeswitch/etc/freeswitch /usr/share/bigbluebutton/nginx \
                       /etc/bigbluebutton /usr/local/bigbluebutton/bbb-webrtc-sfu/config; do
              [ -d "$dir" ] || continue
              find "$dir" -type f \( -name "*.xml" -o -name "*.nginx" -o \
                   -name "*.properties" -o -name "*.yml" -o -name "*.yaml" \) 2>/dev/null | while read f; do
                OLD_IPS=$(grep -oP '\d+\.\d+\.\d+\.\d+' "$f" 2>/dev/null | grep -v '127\.\|0\.0\.\|255\.\|169\.254\.' | sort -u)
                for old in $OLD_IPS; do
                  if [ "$old" != "$NEW_IP" ]; then
                    echo "  $f: $old → $NEW_IP"
                    sed -i "s/$old/$NEW_IP/g" "$f"
                  fi
                done
              done
            done

            # Step 3: Restart services that use the fixed IPs
            systemctl restart bbb-webrtc-sfu bbb-webrtc-recorder freeswitch 2>/dev/null || true
            bbb-conf --restart 2>&1 | tail -3

            # Step 4: Verify — re-apply sed in case restart overwrote anything
            for f in /etc/bigbluebutton/bbb-webrtc-sfu/production.yml \
                     /opt/freeswitch/etc/freeswitch/vars.xml \
                     /opt/freeswitch/etc/freeswitch/sip_profiles/external.xml \
                     /usr/share/bigbluebutton/nginx/sip.nginx; do
              [ -f "$f" ] || continue
              OLD_IPS=$(grep -oP '\d+\.\d+\.\d+\.\d+' "$f" 2>/dev/null | grep -v '127\.\|0\.0\.\|255\.\|169\.254\.' | sort -u)
              for old in $OLD_IPS; do
                if [ "$old" != "$NEW_IP" ]; then
                  sed -i "s/$old/$NEW_IP/g" "$f"
                fi
              done
            done
            systemctl restart bbb-webrtc-sfu freeswitch 2>/dev/null || true

            # Step 5: Fix default presentation URL to use domain
            sed -i "s|defaultUploadedPresentation=https://[^/]*/|defaultUploadedPresentation=https://$DOMAIN/|g" \
                /etc/bigbluebutton/bbb-web.properties 2>/dev/null || true
REMOTE
        echo "  BBB hostname set to $BBB_HOST (IP: $final_ip)"
    else
        echo "  WARNING: SSH not available — BBB may use raw IP."
        echo "  Fix manually: ssh root@$final_ip 'bbb-conf --setip $BBB_HOST && bbb-conf --restart'"
    fi

    # Update pool DB status to RUNNING
    local backend_url="${ADMIN_CORE_SERVICE_BASE_URL:-https://backend-stage.vacademy.io/admin-core-service}"
    local pool_api_response
    pool_api_response=$(curl -s -o /dev/null -w "%{http_code}" -X POST \
        "$backend_url/bbb/pool/$SERVER_SLUG/status" \
        -H "Content-Type: application/json" \
        -d "{\"status\": \"RUNNING\", \"hetznerServerId\": $new_server_id}" 2>/dev/null || echo "000")
    if [ "$pool_api_response" = "200" ]; then
        echo "  Pool DB updated: status=RUNNING"
    else
        echo "  WARNING: Could not update pool DB (HTTP $pool_api_response)"
        echo "  Run manually: UPDATE bbb_server_pool SET status='RUNNING' WHERE slug='$SERVER_SLUG';"
    fi

    echo ""
    echo "============================================="
    echo " [$SERVER_SLUG] Server running!"
    echo " ID:   $new_server_id"
    echo " IP:   $final_ip"
    echo " DNS:  $BBB_HOST → $final_ip"
    echo "============================================="
}

cmd_pause() {
    local sid
    sid=$(get_server_id)
    echo "[$SERVER_SLUG] Pausing (power off)..."
    RESPONSE=$(hcloud_api POST "/servers/$sid/actions/shutdown")
    echo "  Billing continues. Use 'stop' to save costs."
}

cmd_resume() {
    local sid
    sid=$(get_server_id)
    echo "[$SERVER_SLUG] Resuming (power on)..."
    hcloud_api POST "/servers/$sid/actions/poweron" > /dev/null

    for i in $(seq 1 30); do
        sleep 5
        STATE=$(hcloud_api GET "/servers/$sid" | python3 -c "import sys, json; print(json.load(sys.stdin)['server']['status'])" 2>/dev/null)
        if [ "$STATE" = "running" ]; then
            local IP
            IP=$(hcloud_api GET "/servers/$sid" | python3 -c "import sys, json; print(json.load(sys.stdin)['server']['public_net']['ipv4']['ip'])" 2>/dev/null)
            update_dns "$IP"
            echo ""
            echo "  [$SERVER_SLUG] RUNNING at $IP"
            return 0
        fi
        echo "  ... ($STATE)"
    done
    echo "  Timeout waiting for power on."
}

cmd_status() {
    # Try API lookup by name
    if [ -z "${HETZNER_BBB_SERVER_ID:-}" ]; then
        local lookup
        lookup=$(lookup_server_by_name)
        if [ -n "$lookup" ]; then
            local found_id
            found_id=$(echo "$lookup" | cut -d'|' -f1)
            save_server_id "$found_id"
        fi
    fi

    if [ -z "${HETZNER_BBB_SERVER_ID:-}" ]; then
        local snapshot_id
        snapshot_id=$(get_snapshot_id)
        echo "  [$SERVER_SLUG] NOT RUNNING (deleted)"
        if [ -n "$snapshot_id" ]; then
            echo "  Snapshot: $snapshot_id"
            echo "  Type: $SERVER_TYPE | Domain: $BBB_HOST"
        fi
        return 0
    fi

    local sid
    sid=$(get_server_id)
    RESPONSE=$(hcloud_api GET "/servers/$sid")

    local error_code
    error_code=$(echo "$RESPONSE" | python3 -c "
import sys, json
print(json.load(sys.stdin).get('error', {}).get('code', ''))
" 2>/dev/null)

    if [ "$error_code" = "not_found" ]; then
        clear_server_id
        echo "  [$SERVER_SLUG] NOT RUNNING (deleted)"
        return 0
    fi

    python3 -c "
import sys, json
s = json.load(sys.stdin)['server']
status = s['status']
icon = '🟢' if status == 'running' else '🔴' if status == 'off' else '🟡'
print(f'  {icon} [$SERVER_SLUG] {status.upper()}')
print(f'  Name:     {s[\"name\"]}')
print(f'  IP:       {s[\"public_net\"][\"ipv4\"][\"ip\"]}')
print(f'  Type:     {s[\"server_type\"][\"name\"]} ({s[\"server_type\"][\"description\"]})')
print(f'  Domain:   $BBB_HOST')
if status == 'off':
    print()
    print('  ⚠️  Billing continues! Use stop to save costs.')
" <<< "$RESPONSE" 2>/dev/null || echo "$RESPONSE"
}

cmd_ip() {
    local sid
    sid=$(get_server_id)
    hcloud_api GET "/servers/$sid" | python3 -c "import sys, json; print(json.load(sys.stdin)['server']['public_net']['ipv4']['ip'])" 2>/dev/null
}

cmd_ssh() {
    local ip
    ip=$(cmd_ip)
    ssh-keygen -R "$ip" 2>/dev/null || true
    echo "[$SERVER_SLUG] Connecting to root@$ip ..."
    ssh -o StrictHostKeyChecking=accept-new root@"$ip"
}

cmd_snapshots() {
    echo "[$SERVER_SLUG] Snapshots (label: $SNAPSHOT_DESC):"
    echo ""
    hcloud_api GET "/images?type=snapshot&sort=created:desc" | python3 -c "
import sys, json
images = json.load(sys.stdin).get('images', [])
bbb = [i for i in images if '$SNAPSHOT_DESC' in i.get('description', '')]
if not bbb:
    bbb = [i for i in images if i.get('created_from', {}).get('name', '') == '$SERVER_NAME']
if not bbb:
    print('  No snapshots found.')
else:
    for i in bbb:
        size = i.get('image_size', 0) or 0
        print(f'  ID: {i[\"id\"]}  |  {i.get(\"description\", \"no desc\")}  |  {size:.1f} GB  |  {i[\"created\"]}  |  {i[\"status\"]}')
" 2>/dev/null

    local current_snap
    current_snap=$(get_snapshot_id)
    if [ -n "$current_snap" ]; then
        echo ""
        echo "  Active snapshot: $current_snap"
    fi
}

cmd_cleanup_snapshots() {
    local current_snap
    current_snap=$(get_snapshot_id)
    [ -z "$current_snap" ] && return 0

    local old_snaps
    old_snaps=$(hcloud_api GET "/images?type=snapshot&sort=created:desc" | python3 -c "
import sys, json
images = json.load(sys.stdin).get('images', [])
# Only match THIS server's snapshots (by description label)
bbb = [i for i in images if '$SNAPSHOT_DESC' in i.get('description', '')]
for i in bbb:
    if str(i['id']) != '$current_snap':
        print(i['id'])
" 2>/dev/null)

    if [ -n "$old_snaps" ]; then
        echo "  Cleaning up old $SNAPSHOT_DESC snapshots..."
        while IFS= read -r old_id; do
            [ -n "$old_id" ] && hcloud_api DELETE "/images/$old_id" > /dev/null && echo "  Deleted: $old_id"
        done <<< "$old_snaps"
    fi
}

cmd_sync() {
    local ip
    ip=$(cmd_ip)
    local ssh_opts="-o StrictHostKeyChecking=accept-new"

    ssh-keygen -R "$ip" 2>/dev/null || true

    echo "============================================="
    echo " [$SERVER_SLUG] Syncing files to $BBB_HOST ($ip)"
    echo "============================================="
    echo ""

    echo "[1/4] Scripts to /root/..."
    local root_scripts=(configure-bbb.sh install-recording-hook.sh post-publish-s3-upload.sh setup-hetzner.sh)
    for f in "${root_scripts[@]}"; do
        [ -f "$SCRIPT_DIR/$f" ] && scp $ssh_opts "$SCRIPT_DIR/$f" "root@$ip:/root/$f" && echo "  ✓ $f"
    done

    echo "[2/4] Boot-time IP fix..."
    [ -f "$SCRIPT_DIR/bbb-fix-ip-on-boot.sh" ] && scp $ssh_opts "$SCRIPT_DIR/bbb-fix-ip-on-boot.sh" "root@$ip:/opt/" && echo "  ✓ bbb-fix-ip-on-boot.sh"
    [ -f "$SCRIPT_DIR/bbb-fix-ip-on-boot.service" ] && scp $ssh_opts "$SCRIPT_DIR/bbb-fix-ip-on-boot.service" "root@$ip:/etc/systemd/system/" && echo "  ✓ bbb-fix-ip-on-boot.service"

    echo "[3/4] Monitoring scripts..."
    ssh $ssh_opts "root@$ip" "mkdir -p /opt/vacademy"
    if [ -d "$SCRIPT_DIR/monitoring" ]; then
        for f in "$SCRIPT_DIR/monitoring/"*.sh; do
            [ -f "$f" ] || continue
            local fname
            fname=$(basename "$f")
            scp $ssh_opts "$f" "root@$ip:/opt/vacademy/$fname" && echo "  ✓ $fname"
        done
    fi

    echo "[4/4] Permissions & services..."
    ssh $ssh_opts "root@$ip" bash -s <<'REMOTE'
        chmod +x /opt/bbb-fix-ip-on-boot.sh 2>/dev/null || true
        chmod +x /root/*.sh 2>/dev/null || true
        chmod +x /opt/vacademy/*.sh 2>/dev/null || true
        systemctl daemon-reload
        systemctl enable bbb-fix-ip-on-boot.service 2>/dev/null || true
REMOTE

    echo ""
    echo " [$SERVER_SLUG] Sync complete! Remember to stop to save snapshot."
}

cmd_deploy() {
    local ip
    ip=$(cmd_ip)
    ssh-keygen -R "$ip" 2>/dev/null || true
    echo "[$SERVER_SLUG] Deploying to $BBB_HOST ($ip)..."
    scp -o StrictHostKeyChecking=accept-new "$SCRIPT_DIR/configure-bbb.sh" "root@$ip:/root/"
    ssh -o StrictHostKeyChecking=accept-new "root@$ip" "bash /root/configure-bbb.sh"
    echo " Done!"
}

cmd_provision() {
    echo "============================================="
    echo " [$SERVER_SLUG] Full BBB Provisioning"
    echo " Type:   $SERVER_TYPE"
    echo " Domain: $BBB_HOST"
    echo "============================================="
    echo ""
    echo "This will:"
    echo "  1. Create a fresh $SERVER_TYPE server"
    echo "  2. Install BigBlueButton 3.0 (~20 min)"
    echo "  3. Apply Vacademy white-label config"
    echo "  4. Install recording upload hooks"
    echo "  5. Sync boot scripts"
    echo "  6. Output the BBB secret"
    echo "  7. Stop server (snapshot + delete)"
    echo ""
    read -p "Continue? (yes/no): " confirm
    [ "$confirm" != "yes" ] && echo "Aborted." && return 1
    echo ""

    # Step 1: Create server
    echo "══════ Step 1/7: Creating server ══════"
    cmd_create
    echo ""

    local ip
    ip=$(cmd_ip)
    local ssh_opts="-o StrictHostKeyChecking=accept-new -o ConnectTimeout=10"

    # Step 2: Wait for SSH
    echo "══════ Step 2/7: Waiting for SSH ══════"
    local ssh_ready=false
    for i in $(seq 1 30); do
        if ssh $ssh_opts "root@$ip" "echo 'SSH up'" 2>/dev/null; then
            ssh_ready=true
            break
        fi
        echo "  Waiting... ($i/30)"
        sleep 10
    done
    if [ "$ssh_ready" != "true" ]; then
        echo "ERROR: SSH timeout after 5 minutes."
        exit 1
    fi
    echo ""

    # Step 3: Upload setup script and install BBB
    echo "══════ Step 3/7: Installing BigBlueButton ══════"
    echo "  This takes ~20-30 minutes..."
    scp $ssh_opts "$SCRIPT_DIR/setup-hetzner.sh" "root@$ip:/root/"
    ssh $ssh_opts "root@$ip" "bash /root/setup-hetzner.sh $BBB_HOST admin@vacademy.io"
    echo ""

    # Step 4: Configure BBB (white-label)
    echo "══════ Step 4/7: Configuring BBB ══════"
    scp $ssh_opts "$SCRIPT_DIR/configure-bbb.sh" "root@$ip:/root/"
    ssh $ssh_opts "root@$ip" "bash /root/configure-bbb.sh"
    echo ""

    # Step 5: Install recording hooks
    echo "══════ Step 5/7: Installing recording hooks ══════"
    if [ -f "$SCRIPT_DIR/install-recording-hook.sh" ]; then
        scp $ssh_opts "$SCRIPT_DIR/install-recording-hook.sh" "root@$ip:/root/"
        scp $ssh_opts "$SCRIPT_DIR/post-publish-s3-upload.sh" "root@$ip:/root/"
        ssh $ssh_opts "root@$ip" "bash /root/install-recording-hook.sh" || true
    fi
    echo ""

    # Step 6: Sync all scripts + boot service
    echo "══════ Step 6/7: Syncing scripts ══════"
    cmd_sync
    echo ""

    # Get the BBB secret before stopping
    echo "══════ Step 6b: Getting BBB secret ══════"
    local bbb_secret
    bbb_secret=$(ssh $ssh_opts "root@$ip" "bbb-conf --secret" 2>/dev/null | grep 'Secret:' | awk '{print \$2}')
    echo ""
    echo "╔════════════════════════════════════════════════╗"
    echo "║  BBB SECRET (save this!)                       ║"
    echo "║  $bbb_secret"
    echo "║                                                ║"
    echo "║  Update your database:                         ║"
    echo "║  UPDATE bbb_server_pool                        ║"
    echo "║  SET secret = '$bbb_secret',                   ║"
    echo "║      enabled = true                            ║"
    echo "║  WHERE slug = '$SERVER_SLUG';                  ║"
    echo "╚════════════════════════════════════════════════╝"
    echo ""

    # Step 7: Stop (snapshot + delete)
    echo "══════ Step 7/7: Creating snapshot ══════"
    read -p "Stop server and create snapshot? (yes/no): " stop_confirm
    if [ "$stop_confirm" = "yes" ]; then
        cmd_stop
    else
        echo "  Server left running at $ip"
        echo "  When ready, run: ./manage-server.sh --server $TARGET_SERVER stop"
    fi

    echo ""
    echo "============================================="
    echo " [$SERVER_SLUG] Provisioning complete!"
    echo " Domain: $BBB_HOST"
    echo " Secret: $bbb_secret"
    echo "============================================="
}

cmd_destroy() {
    echo "[$SERVER_SLUG] WARNING: Permanently delete server AND snapshots!"
    read -p "Type 'yes' to confirm: " confirm
    if [ "$confirm" = "yes" ]; then
        [ -n "${HETZNER_BBB_SERVER_ID:-}" ] && hcloud_api DELETE "/servers/$HETZNER_BBB_SERVER_ID" && echo "  Server deleted."
        local snapshot_id
        snapshot_id=$(get_snapshot_id)
        [ -n "$snapshot_id" ] && hcloud_api DELETE "/images/$snapshot_id" && echo "  Snapshot deleted."
        clear_server_id
        rm -f "$SNAPSHOT_ID_FILE"
        echo "  All cleaned up."
    else
        echo "Cancelled."
    fi
}

# ── Run for a single server ──────────────────────────────────

run_for_server() {
    local priority="$1"
    local command="$2"

    load_server_vars "$priority"

    case "$command" in
        create)    cmd_create ;;
        start)     cmd_start ;;
        stop)      cmd_stop ;;
        pause)     cmd_pause ;;
        resume)    cmd_resume ;;
        status)    cmd_status ;;
        ip)        cmd_ip ;;
        ssh)       cmd_ssh ;;
        snapshots) cmd_snapshots ;;
        deploy)    cmd_deploy ;;
        sync)      cmd_sync ;;
        provision) cmd_provision ;;
        destroy)   cmd_destroy ;;
        *)
            echo "Unknown command: $command"
            exit 1
            ;;
    esac
}

# ── Main ──────────────────────────────────────────────────────

COMMAND="${1:-help}"

if [ "$COMMAND" = "help" ] || [ "$COMMAND" = "--help" ] || [ "$COMMAND" = "-h" ]; then
    echo "Usage: $0 [--server N|all] <command>"
    echo ""
    echo "  --server N    Target server by priority (1, 2, ...). Default: 1"
    echo "  --server all  Loop over all servers in pool"
    echo ""
    echo "  Cost-saving commands:"
    echo "    start      Restore from snapshot + update DNS"
    echo "    stop       Snapshot + delete (STOPS billing)"
    echo ""
    echo "  Quick power commands (billing continues!):"
    echo "    pause      Power off"
    echo "    resume     Power on"
    echo ""
    echo "  Info:"
    echo "    status     Show server state"
    echo "    ip         Print server IP"
    echo "    ssh        SSH into the server"
    echo "    sync       Sync scripts to server"
    echo "    deploy     Upload & run configure-bbb.sh"
    echo "    snapshots  List snapshots"
    echo ""
    echo "  Setup / teardown:"
    echo "    create     First-time server creation"
    echo "    destroy    Permanently delete server + snapshots"
    echo ""
    echo "  Pool servers:"
    python3 -c "
import json
with open('$POOL_CONFIG') as f:
    cfg = json.load(f)
for s in sorted(cfg['servers'], key=lambda x: x['priority']):
    print(f'    {s[\"priority\"]}: {s[\"slug\"]} ({s[\"server_type\"]}) → {s[\"domain\"]}')
" 2>/dev/null
    exit 0
fi

if [ "$TARGET_SERVER" = "all" ]; then
    for priority in $(get_all_priorities); do
        echo ""
        echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
        run_for_server "$priority" "$COMMAND"
    done
else
    run_for_server "$TARGET_SERVER" "$COMMAND"
fi
