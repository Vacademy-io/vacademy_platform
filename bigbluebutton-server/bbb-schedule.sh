#!/bin/bash
# =============================================================
# BBB Server Scheduler — runs on backend-stage via systemd timer
# =============================================================
# Usage:
#   bbb-schedule.sh start   # Restore from snapshot + update DNS
#   bbb-schedule.sh stop    # Snapshot + delete (stops billing)
#
# Idempotent: safe to run multiple times (no-ops if already in desired state)
# =============================================================

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
LOG_TAG="bbb-schedule"

# ── Load config from env file ────────────────────────────────
ENV_FILE="$SCRIPT_DIR/.env"
if [ ! -f "$ENV_FILE" ]; then
    echo "ERROR: $ENV_FILE not found" | logger -t "$LOG_TAG"
    exit 1
fi
set -a
source "$ENV_FILE"
set +a

# ── Config ───────────────────────────────────────────────────
HETZNER_API="https://api.hetzner.cloud/v1"
CF_API="https://api.cloudflare.com/client/v4"
SERVER_NAME="vacademy-bbb"
SERVER_TYPE="ccx33"
LOCATION="sin"
SNAPSHOT_DESC="vacademy-bbb-auto"
HOSTNAME_BBB="${BBB_HOSTNAME:-meet.vacademy.io}"
RECORD_NAME="${HOSTNAME_BBB%%.*}"

# WhatsApp Business API config
WA_TOKEN="${WHATSAPP_ACCESS_TOKEN:-}"
WA_PHONE_ID="${WHATSAPP_PHONE_NUMBER_ID:-}"
WA_API="https://graph.facebook.com/v21.0"

# Phone numbers to notify (with country code, no + prefix)
# Override in .env: NOTIFY_PHONES="919876543210,919876543211"
NOTIFY_PHONES="${NOTIFY_PHONES:-}"

log() {
    echo "$(date '+%Y-%m-%d %H:%M:%S') $1" | tee >(logger -t "$LOG_TAG")
}

send_whatsapp() {
    local status="$1" server_ip="$2" details="$3" timestamp="$4"

    if [ -z "$WA_TOKEN" ] || [ -z "$WA_PHONE_ID" ] || [ -z "$NOTIFY_PHONES" ]; then
        log "WhatsApp not configured — skipping notification"
        return 0
    fi

    # Send to each phone number
    IFS=',' read -ra PHONES <<< "$NOTIFY_PHONES"
    for phone in "${PHONES[@]}"; do
        phone=$(echo "$phone" | tr -d ' ')
        [ -z "$phone" ] && continue

        local response
        response=$(curl -s -X POST "$WA_API/$WA_PHONE_ID/messages" \
            -H "Authorization: Bearer $WA_TOKEN" \
            -H "Content-Type: application/json" \
            -d "{
                \"messaging_product\": \"whatsapp\",
                \"to\": \"$phone\",
                \"type\": \"template\",
                \"template\": {
                    \"name\": \"vacademy_server_health_check_utility\",
                    \"language\": { \"code\": \"en\" },
                    \"components\": [
                        {
                            \"type\": \"body\",
                            \"parameters\": [
                                { \"type\": \"text\", \"text\": \"$status\" },
                                { \"type\": \"text\", \"text\": \"$HOSTNAME_BBB\" },
                                { \"type\": \"text\", \"text\": \"$server_ip\" },
                                { \"type\": \"text\", \"text\": \"$details\" },
                                { \"type\": \"text\", \"text\": \"$timestamp\" }
                            ]
                        }
                    ]
                }
            }" 2>&1)

        local msg_id
        msg_id=$(echo "$response" | jq -r '.messages[0].id // empty' 2>/dev/null)
        if [ -n "$msg_id" ]; then
            log "WhatsApp sent to $phone (msg: $msg_id)"
        else
            log "WARNING: WhatsApp to $phone failed — $(echo "$response" | jq -c '.error.message // .error // .' 2>/dev/null)"
        fi
    done
}

# ── API helpers ──────────────────────────────────────────────

hetzner() {
    local method="$1" endpoint="$2"
    shift 2
    curl -s -X "$method" \
        -H "Authorization: Bearer $HETZNER_API_TOKEN" \
        -H "Content-Type: application/json" \
        "$HETZNER_API$endpoint" "$@"
}

cloudflare() {
    local method="$1" endpoint="$2"
    shift 2
    curl -s -X "$method" \
        -H "Authorization: Bearer $CLOUDFLARE_API_TOKEN" \
        -H "Content-Type: application/json" \
        "$CF_API$endpoint" "$@"
}

find_server() {
    hetzner GET "/servers?name=$SERVER_NAME" | jq -r '.servers[0] // empty'
}

find_latest_snapshot() {
    hetzner GET "/images?type=snapshot&sort=created:desc&per_page=50" | jq -r "
        [.images[] | select(
            (.description | contains(\"$SNAPSHOT_DESC\")) or
            (.created_from.name == \"$SERVER_NAME\")
        )] | sort_by(.created) | last | .id // empty"
}

update_dns() {
    local ip="$1"
    log "Updating DNS: $HOSTNAME_BBB → $ip"

    local existing
    existing=$(cloudflare GET "/zones/$CLOUDFLARE_ZONE_ID/dns_records?type=A&name=$HOSTNAME_BBB")
    local record_id
    record_id=$(echo "$existing" | jq -r '.result[0].id // empty')

    local result
    if [ -n "$record_id" ]; then
        result=$(cloudflare PUT "/zones/$CLOUDFLARE_ZONE_ID/dns_records/$record_id" \
            -d "{\"type\":\"A\",\"name\":\"$RECORD_NAME\",\"content\":\"$ip\",\"ttl\":120,\"proxied\":false}")
    else
        result=$(cloudflare POST "/zones/$CLOUDFLARE_ZONE_ID/dns_records" \
            -d "{\"type\":\"A\",\"name\":\"$RECORD_NAME\",\"content\":\"$ip\",\"ttl\":120,\"proxied\":false}")
    fi

    local success
    success=$(echo "$result" | jq -r '.success')
    if [ "$success" = "true" ]; then
        log "DNS updated: $HOSTNAME_BBB → $ip"
    else
        log "ERROR: DNS update failed — $(echo "$result" | jq -c '.errors')"
        return 1
    fi
}

wait_for_action() {
    local action_id="$1" description="$2" timeout="${3:-300}"
    local elapsed=0

    while [ $elapsed -lt $timeout ]; do
        sleep 10
        elapsed=$((elapsed + 10))
        local status
        status=$(hetzner GET "/actions/$action_id" | jq -r '.action.status')

        case "$status" in
            success) log "$description completed (${elapsed}s)"; return 0 ;;
            error)   log "ERROR: $description failed!"; return 1 ;;
            *)       log "  ... ${elapsed}s ($status)" ;;
        esac
    done

    log "WARNING: $description timed out after ${timeout}s"
    return 1
}

# ── START ────────────────────────────────────────────────────

cmd_start() {
    log "=== START: Checking server state ==="

    # Check if server already exists
    local server
    server=$(find_server)

    if [ -n "$server" ]; then
        local status ip
        status=$(echo "$server" | jq -r '.status')
        ip=$(echo "$server" | jq -r '.public_net.ipv4.ip')

        if [ "$status" = "running" ]; then
            log "Server already running at $ip — updating DNS just in case"
            update_dns "$ip"
            return 0
        elif [ "$status" = "off" ]; then
            log "Server exists but powered off — powering on"
            local server_id
            server_id=$(echo "$server" | jq -r '.id')

            hetzner POST "/servers/$server_id/actions/poweron" > /dev/null

            for i in $(seq 1 18); do
                sleep 10
                local state
                state=$(hetzner GET "/servers/$server_id" | jq -r '.server.status')
                if [ "$state" = "running" ]; then
                    ip=$(hetzner GET "/servers/$server_id" | jq -r '.server.public_net.ipv4.ip')
                    log "Server powered on at $ip"
                    update_dns "$ip"
                    return 0
                fi
            done
            log "ERROR: Timeout powering on server"
            return 1
        fi
    fi

    # Restore from snapshot
    local snapshot_id
    snapshot_id=$(find_latest_snapshot)

    if [ -z "$snapshot_id" ]; then
        log "ERROR: No snapshot found! Cannot restore."
        return 1
    fi

    log "Restoring from snapshot $snapshot_id"

    # Get SSH keys
    local ssh_keys
    ssh_keys=$(hetzner GET "/ssh_keys" | jq -c '[.ssh_keys[].id]')

    # Create server
    local response
    response=$(hetzner POST "/servers" -d "{
        \"name\": \"$SERVER_NAME\",
        \"server_type\": \"$SERVER_TYPE\",
        \"image\": $snapshot_id,
        \"location\": \"$LOCATION\",
        \"ssh_keys\": $ssh_keys,
        \"labels\": {\"project\": \"vacademy\", \"service\": \"bbb\"},
        \"start_after_create\": true
    }")

    local server_id server_ip
    server_id=$(echo "$response" | jq -r '.server.id // empty')
    server_ip=$(echo "$response" | jq -r '.server.public_net.ipv4.ip // empty')

    if [ -z "$server_id" ]; then
        log "ERROR: Failed to create server — $(echo "$response" | jq -c '.error')"
        return 1
    fi

    log "Server created: ID=$server_id, IP=$server_ip"

    # Update DNS immediately (don't wait for boot)
    update_dns "$server_ip"

    # Wait for boot (non-fatal — DNS is already updated)
    local booted=false
    for i in $(seq 1 60); do
        sleep 10
        local state
        state=$(hetzner GET "/servers/$server_id" | jq -r '.server.status')
        if [ "$state" = "running" ]; then
            log "Server is running at $server_ip"
            booted=true
            break
        fi
    done

    if [ "$booted" != "true" ]; then
        log "WARNING: Boot timed out after 10 min — DNS is updated, server will come up shortly"
    fi

    # BBB IP fix happens automatically on server boot via bbb-fix-ip-on-boot.service
    # (installed on the BBB server itself, baked into snapshot)

    return 0
}

# ── STOP ─────────────────────────────────────────────────────

cmd_stop() {
    log "=== STOP: Checking server state ==="

    local server
    server=$(find_server)

    if [ -z "$server" ]; then
        log "No server found — nothing to stop"
        return 0
    fi

    local server_id status
    server_id=$(echo "$server" | jq -r '.id')
    status=$(echo "$server" | jq -r '.status')
    log "Found server $server_id (status: $status)"

    # Step 1: Shutdown if running
    if [ "$status" = "running" ]; then
        log "Shutting down server..."
        local shutdown_resp
        shutdown_resp=$(hetzner POST "/servers/$server_id/actions/shutdown")
        local action_id
        action_id=$(echo "$shutdown_resp" | jq -r '.action.id // empty')

        if [ -n "$action_id" ]; then
            wait_for_action "$action_id" "shutdown" 120 || true
        fi

        sleep 3
        local current
        current=$(hetzner GET "/servers/$server_id" | jq -r '.server.status')
        if [ "$current" != "off" ]; then
            log "Graceful shutdown incomplete, forcing poweroff..."
            local force_resp
            force_resp=$(hetzner POST "/servers/$server_id/actions/poweroff")
            local force_action
            force_action=$(echo "$force_resp" | jq -r '.action.id // empty')
            if [ -n "$force_action" ]; then
                wait_for_action "$force_action" "force poweroff" 60 || true
            fi
        fi
    fi

    # Step 2: Create snapshot
    log "Creating snapshot..."
    local snap_resp
    snap_resp=$(hetzner POST "/servers/$server_id/actions/create_image" -d "{
        \"description\": \"$SNAPSHOT_DESC\",
        \"type\": \"snapshot\",
        \"labels\": {\"project\": \"vacademy\", \"service\": \"bbb\", \"auto\": \"true\"}
    }")

    local snap_action_id image_id
    snap_action_id=$(echo "$snap_resp" | jq -r '.action.id // empty')
    image_id=$(echo "$snap_resp" | jq -r '.image.id // empty')

    if [ -z "$snap_action_id" ] || [ -z "$image_id" ]; then
        log "ERROR: Failed to create snapshot! Server NOT deleted."
        return 1
    fi

    log "Snapshot ID: $image_id — waiting for completion..."

    # Wait for snapshot (15 min via action polling)
    wait_for_action "$snap_action_id" "snapshot" 900 || true

    # Verify snapshot is available (action polling can lag behind)
    local snap_status
    snap_status=$(hetzner GET "/images/$image_id" | jq -r '.image.status')

    if [ "$snap_status" != "available" ]; then
        # Give it one more minute
        log "Snapshot status: $snap_status — waiting 60s more..."
        sleep 60
        snap_status=$(hetzner GET "/images/$image_id" | jq -r '.image.status')
    fi

    if [ "$snap_status" != "available" ]; then
        log "ERROR: Snapshot status is '$snap_status', not 'available'. Server NOT deleted."
        return 1
    fi

    log "Snapshot verified: $image_id"

    # Step 3: Delete server
    log "Deleting server to stop billing..."
    hetzner DELETE "/servers/$server_id" > /dev/null

    sleep 3
    local error_code
    error_code=$(hetzner GET "/servers/$server_id" | jq -r '.error.code // empty')

    if [ "$error_code" = "not_found" ]; then
        log "Server deleted. Billing stopped."
    else
        log "WARNING: Server deletion may not have completed. Check Hetzner console."
    fi

    # Step 4: Cleanup old snapshots
    local old_ids
    old_ids=$(hetzner GET "/images?type=snapshot&sort=created:desc&per_page=50" | jq -r "
        [.images[] | select(
            (.description | contains(\"$SNAPSHOT_DESC\")) or
            (.created_from.name == \"$SERVER_NAME\")
        ) | select(.id != $image_id) | .id] | .[]")

    if [ -n "$old_ids" ]; then
        log "Cleaning up old snapshots..."
        for old_id in $old_ids; do
            hetzner DELETE "/images/$old_id" > /dev/null
            log "  Deleted: $old_id"
        done
    fi

    log "=== STOP complete ==="
}

# ── HEALTHCHECK ──────────────────────────────────────────────

cmd_healthcheck() {
    log "=== HEALTHCHECK: Verifying BBB server ==="

    local backend_url="${BACKEND_HEALTHCHECK_URL:-}"

    # Try backend API first (it checks BBB API + sends WhatsApp via notification service)
    if [ -n "$backend_url" ]; then
        log "Triggering health check via backend API: $backend_url"
        local api_response
        api_response=$(curl -s -X POST --connect-timeout 10 --max-time 30 "$backend_url" \
            -H "Content-Type: application/json" 2>&1)

        local api_status
        api_status=$(echo "$api_response" | jq -r '.status // empty' 2>/dev/null)

        if [ -n "$api_status" ]; then
            log "Backend API health check result: $api_status"
            log "Details: $(echo "$api_response" | jq -c '.' 2>/dev/null)"
            return 0
        else
            log "WARNING: Backend API health check failed, falling back to direct check"
        fi
    fi

    # Fallback: check via Hetzner API + BBB HTTP endpoint + WhatsApp
    local server
    server=$(find_server)

    local now
    now=$(TZ=Asia/Kolkata date '+%d %b %Y %I:%M %p IST')

    if [ -z "$server" ]; then
        log "HEALTHCHECK FAIL: No BBB server found"
        send_whatsapp "DOWN" "N/A" "Server not found (deleted or not started)" "$now"
        return 1
    fi

    local server_status server_ip
    server_status=$(echo "$server" | jq -r '.status')
    server_ip=$(echo "$server" | jq -r '.public_net.ipv4.ip')

    if [ "$server_status" != "running" ]; then
        log "HEALTHCHECK FAIL: Server status is '$server_status'"
        send_whatsapp "DOWN" "$server_ip" "Server status: $server_status" "$now"
        return 1
    fi

    # Check BBB API endpoint via HTTP (no SSH needed)
    local http_status
    http_status=$(curl -s -o /dev/null -w "%{http_code}" --connect-timeout 10 --max-time 15 \
        "https://$HOSTNAME_BBB/bigbluebutton/api" 2>/dev/null || echo "000")

    if [ "$http_status" = "200" ]; then
        log "HEALTHCHECK OK: Server running, API responding (HTTP $http_status)"
        send_whatsapp "HEALTHY" "$server_ip" "Server running, API OK (HTTP $http_status)" "$now"
    else
        log "HEALTHCHECK FAIL: API returned HTTP $http_status"
        send_whatsapp "ISSUES" "$server_ip" "API returned HTTP $http_status" "$now"
    fi

    return 0
}

# ── Main ─────────────────────────────────────────────────────
case "${1:-}" in
    start)       cmd_start ;;
    stop)        cmd_stop ;;
    healthcheck) cmd_healthcheck ;;
    *)
        echo "Usage: $0 {start|stop|healthcheck}"
        exit 1
        ;;
esac
