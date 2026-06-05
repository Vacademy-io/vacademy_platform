#!/bin/bash
# =============================================================
# BBB rap-worker auto-tune — adjusts CPU/IO priority AND ffmpeg
# thread count based on live meeting count.
# =============================================================
# IDLE   (0 live meetings):
#   CPUWeight=200  — rap-worker can sprint under contention
#   ffmpeg -threads 0  — use ALL cores per encode (4× faster on 8-core box)
# ACTIVE (1+ live meetings):
#   CPUWeight=10   — live meetings always win contention
#   ffmpeg -threads 2  — capped so each encode can't starve live audio/video
#
# The CPUWeight knob only matters under CPU contention. The threads knob
# matters always — it's a hard cap on per-encode parallelism. Together they
# give a healthy split: full power off-class, strict isolation during class.
#
# Runs every minute via bbb-rap-autotune.timer.
# =============================================================

set -uo pipefail

LOG_FILE="/var/log/bigbluebutton/vacademy-rap-autotune.log"
# BBB API base — we'll resolve the right host dynamically inside the script
# since the localhost endpoint can differ by version (http vs https, vhost,
# etc). Read BBB_DOMAIN from the recording config when available.
BBB_DOMAIN=$(grep '^BBB_DOMAIN=' /etc/bigbluebutton/vacademy-recording.conf 2>/dev/null | cut -d= -f2-)
[ -z "$BBB_DOMAIN" ] && BBB_DOMAIN=$(hostname -f 2>/dev/null)
# BBB encodes ffmpeg flags as a Ruby array; '-threads' is on line ~33 of
# this file as the literal sequence:
#     '-codec', FFMPEG_WF_CODEC.to_s, '-threads', '2',
# We swap between '2' and '0' depending on live-meeting state.
VIDEO_RB="/usr/local/bigbluebutton/core/lib/recordandplayback/edl/video.rb"
THREADS_RE_PATTERN="'-threads', '"

log() {
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] $*" >> "$LOG_FILE"
}

# Flip ffmpeg -threads N in BBB's video.rb between 2 and 0.
# Idempotent — only writes if the desired value isn't already in the file.
# Targets ONLY the line that already contains "'-threads', '2'" or "'-threads', '0'",
# never any other ffmpeg call that may exist with a different parameter.
set_ffmpeg_threads() {
    local target="$1"
    [ -f "$VIDEO_RB" ] || return 0
    local other
    if [ "$target" = "0" ]; then other=2; else other=0; fi

    # Already at target?
    if grep -q "${THREADS_RE_PATTERN}${target}'" "$VIDEO_RB" \
       && ! grep -q "${THREADS_RE_PATTERN}${other}'" "$VIDEO_RB"; then
        return 0
    fi

    # Take a one-time backup the first time we ever touch this file. Survives
    # BBB upgrades — if BBB ever overwrites the file, we keep the original
    # for manual recovery.
    if [ ! -f "${VIDEO_RB}.autotune-original" ]; then
        cp "$VIDEO_RB" "${VIDEO_RB}.autotune-original"
        log "Saved original to ${VIDEO_RB}.autotune-original"
    fi

    # Match the exact Ruby literal form so we don't touch unrelated lines
    # (the file has 'threads' in other contexts — `threads = 2` on line 251,
    # a comment on line 319, etc).
    sed -i "s/${THREADS_RE_PATTERN}${other}'/${THREADS_RE_PATTERN}${target}'/g" "$VIDEO_RB"
    log "Set ffmpeg -threads to $target in $VIDEO_RB"
}

# Resolve the BBB shared secret. Try several sources in order of reliability:
#   1. Vacademy recording config (always present when the install hook ran)
#   2. bbb-conf --secret (canonical BBB CLI; format: "URL: ... \n Secret: <value>")
#   3. bbb-web.properties (older BBB versions; new ones use /etc/bigbluebutton/bbb-web/)
resolve_bbb_secret() {
    local s=""
    if [ -f /etc/bigbluebutton/vacademy-recording.conf ]; then
        s=$(grep '^VACADEMY_BBB_SECRET=' /etc/bigbluebutton/vacademy-recording.conf 2>/dev/null | cut -d= -f2-)
        [ -n "$s" ] && echo "$s" && return 0
    fi
    if command -v bbb-conf >/dev/null 2>&1; then
        s=$(bbb-conf --secret 2>/dev/null | awk '/^[[:space:]]*Secret:/ {print $2}' | head -1)
        [ -n "$s" ] && echo "$s" && return 0
    fi
    for f in /etc/bigbluebutton/bbb-web.properties /etc/bigbluebutton/bbb-web/bbb-web.properties; do
        if [ -f "$f" ]; then
            s=$(grep -E '^(securitySalt|sharedSecret)=' "$f" 2>/dev/null | cut -d= -f2- | head -1)
            [ -n "$s" ] && echo "$s" && return 0
        fi
    done
    return 1
}
BBB_SECRET=$(resolve_bbb_secret)
if [ -z "$BBB_SECRET" ]; then
    log "ERROR: could not resolve BBB shared secret from any known location — skipping"
    exit 0
fi

# Get current count of running meetings. We try several endpoints in order
# because the BBB API binding varies by version:
#   1. http://localhost          — works on most installs, bbb-web listens here
#   2. https://localhost (-k)    — nginx-fronted only, needs Host header
#   3. https://<BBB_DOMAIN>      — public route, last resort
# Failures default to "active" mode (safer: keeps throttle in place if we
# can't tell whether classes are running).
checksum=$(echo -n "getMeetings${BBB_SECRET}" | sha1sum | awk '{print $1}')
get_meetings_xml() {
    local out
    out=$(curl -sS --max-time 5 \
        "http://localhost/bigbluebutton/api/getMeetings?checksum=${checksum}" 2>/dev/null)
    if echo "$out" | grep -q '<returncode>SUCCESS</returncode>'; then
        echo "$out"; return 0
    fi
    if [ -n "$BBB_DOMAIN" ]; then
        out=$(curl -sS -k --max-time 5 \
            -H "Host: $BBB_DOMAIN" \
            "https://localhost/bigbluebutton/api/getMeetings?checksum=${checksum}" 2>/dev/null)
        if echo "$out" | grep -q '<returncode>SUCCESS</returncode>'; then
            echo "$out"; return 0
        fi
        out=$(curl -sS --max-time 5 \
            "https://${BBB_DOMAIN}/bigbluebutton/api/getMeetings?checksum=${checksum}" 2>/dev/null)
        if echo "$out" | grep -q '<returncode>SUCCESS</returncode>'; then
            echo "$out"; return 0
        fi
    fi
    return 1
}

if ! xml=$(get_meetings_xml); then
    log "WARN: getMeetings API call failed on all endpoints — defaulting to ACTIVE (safe)"
    count=1
else
    count=$(echo "$xml" | grep -oc '<running>true</running>')
fi

# Decide target.
if [ "$count" -eq 0 ]; then
    MODE="IDLE"
    CPU_TARGET=200
    THREADS_TARGET=0
else
    MODE="ACTIVE"
    CPU_TARGET=10
    THREADS_TARGET=2
fi

# Apply ffmpeg threads change first — this affects future process.rb runs
# whether or not the cgroup weights change.
set_ffmpeg_threads "$THREADS_TARGET"

# Skip the systemctl call if we're already at target — most of the time
# nothing changes, so this should be quiet.
current=$(systemctl show bbb-rap-resque-worker -p CPUWeight --value 2>/dev/null)
if [ "$current" = "$CPU_TARGET" ]; then
    exit 0
fi

log "Switching rap-worker to ${MODE} (live meetings=${count}): CPUWeight ${current} → ${CPU_TARGET}, ffmpeg-threads → ${THREADS_TARGET}"

# Apply via cgroup — takes effect within ms. IOWeight tracks CPUWeight 1:1.
systemctl set-property bbb-rap-resque-worker \
    CPUWeight="$CPU_TARGET" \
    IOWeight="$CPU_TARGET" 2>&1 | head -3 >> "$LOG_FILE" || true

# Apply same logic to the S3 drainer so its ffmpeg also speeds up when idle.
if systemctl list-unit-files bbb-recording-drain.service &>/dev/null; then
    systemctl set-property bbb-recording-drain.service \
        CPUWeight="$CPU_TARGET" \
        IOWeight="$CPU_TARGET" 2>&1 | head -3 >> "$LOG_FILE" || true
fi
