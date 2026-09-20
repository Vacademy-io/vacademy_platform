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
#   recording pipeline HELD — no recording is processed or uploaded while
#     a class is live. Every resque worker (the stock one AND the
#     bbb-rap-resque-worker@N instances) finishes the job in hand and takes
#     no new one; the S3 drainer's timer runs are skipped. Released the
#     minute the last meeting ends.
# LATE   (1+ live meetings, but the clock is past LATE_START_IST):
#   the evening tail is small (typically one class with one student), so
#   holding the whole pipeline for it would waste the only processing hours
#   of the day. Instead the pipeline is RELEASED but pinned to the upper
#   half of the CPUs (AllowedCPUs) — a hard cap: recording work can never
#   touch the other half no matter how many ffmpegs run — while CPUWeight=10
#   and -threads 2 still apply on the half it shares with the class.
#
# The CPUWeight knob only matters under CPU contention. The threads knob
# matters always — it's a hard cap on per-encode parallelism. The hold knob
# is the blunt one: it means the CPU/IO knobs only ever apply to the tail of
# a job that started before the class did. The cpuset knob sits in between:
# processing runs, but on a fixed share of the box.
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
# From this wall-clock time (IST) a live meeting no longer holds the pipeline,
# only caps it (LATE mode). The window wraps midnight and closes at
# LATE_END_IST; the box is shut down at 00:30 IST anyway, so the end only
# matters if it is ever left running into the morning.
LATE_START_IST="21:30"
LATE_END_IST="06:00"

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

# Hold/release the whole recording pipeline.
#
# Workers: resque checks the key `pause-all-workers` (in its `resque:`
# namespace) before EVERY reserve (Resque::Worker#paused?). Setting it to
# "true" stops every worker — the stock bbb-rap-resque-worker and each
# bbb-rap-resque-worker@N — from taking a new job; the job in hand always
# runs to completion. Nothing is signalled or killed, so no in-flight job is
# lost (a SIGTERM would land it in resque:failed, which is never requeued).
# Deleting the key resumes them on their next 5-second poll.
#
# Drainer: bbb-recording-drain.sh --watch (the every-minute timer run)
# exits without touching the queue while the hold file exists. Manual runs
# and the pre-snapshot final drain call it without --watch and ignore the
# hold on purpose.
#
# Both are idempotent and the state IS the key/file — no bookkeeping — so a
# missed tick or a restarted worker is corrected on the next run.
RESQUE_PAUSE_KEY="resque:pause-all-workers"
RESQUE_PAUSE_TTL=180          # seconds; refreshed every 60 s tick while ACTIVE
DRAIN_HOLD_FILE="/run/bbb-recording-hold"

hold_recording_pipeline() {
    local mode="$1" cur
    cur=$(redis-cli GET "$RESQUE_PAUSE_KEY" 2>/dev/null)
    if [ "$mode" = "ACTIVE" ]; then
        # Always (re)set WITH A TTL, not just on the transition: the key must
        # never outlive the script that maintains it. If this timer stops, or
        # a boot re-installs an older autotune that knows nothing about the
        # key, the hold evaporates on its own within 3 minutes instead of
        # freezing recording processing until someone finds the key by hand.
        if redis-cli SET "$RESQUE_PAUSE_KEY" true EX "$RESQUE_PAUSE_TTL" >/dev/null 2>&1; then
            [ "$cur" = "true" ] || log "HOLD recording pipeline — live meetings=${count}: workers finish the job in hand and take no new ones; S3 drain skipped"
        else
            log "ERROR: could not set $RESQUE_PAUSE_KEY in redis — workers NOT held"
        fi
        [ -e "$DRAIN_HOLD_FILE" ] || : > "$DRAIN_HOLD_FILE"
    else
        if [ "$cur" = "true" ]; then
            if redis-cli DEL "$RESQUE_PAUSE_KEY" >/dev/null 2>&1; then
                if [ "$mode" = "LATE" ]; then
                    log "RELEASE recording pipeline — LATE window (${LATE_START_IST} IST reached, live meetings=${count}): processing on CPUs $(late_cpuset) only"
                else
                    log "RELEASE recording pipeline — no live meetings"
                fi
            else
                log "ERROR: could not delete $RESQUE_PAUSE_KEY in redis — workers still held"
            fi
        fi
        rm -f "$DRAIN_HOLD_FILE"
    fi
}

# True inside [LATE_START_IST, LATE_END_IST) India time, wrapping midnight.
is_late_window() {
    local now start end
    now=$(TZ=Asia/Kolkata date +%H%M)   || return 1
    start=${LATE_START_IST/:/}; end=${LATE_END_IST/:/}
    if [ "$start" -le "$end" ]; then
        [ "$now" -ge "$start" ] && [ "$now" -lt "$end" ]
    else
        [ "$now" -ge "$start" ] || [ "$now" -lt "$end" ]
    fi
}

# Every unit that runs recording work: the stock worker, each @N instance
# that exists right now, and the S3 drainer.
recording_units() {
    echo bbb-rap-resque-worker.service
    systemctl list-units --all --plain --no-legend 'bbb-rap-resque-worker@*.service' 2>/dev/null | awk '{print $1}'
    systemctl list-unit-files bbb-recording-drain.service &>/dev/null && echo bbb-recording-drain.service
}

# Upper half of the CPU ids, e.g. "8-15" on 16 vCPUs. CPUs 0..N/2-1 never
# see recording work while the cap is on.
late_cpuset() {
    local n; n=$(nproc)
    echo "$((n / 2))-$((n - 1))"
}
# Every CPU, e.g. "0-15". Used as the explicit "uncapped" mask — see below.
all_cpuset() {
    echo "0-$(( $(nproc) - 1 ))"
}

# Pin the recording units to late_cpuset (LATE) or all_cpuset (any other
# mode). ALWAYS an explicit mask, never the empty `AllowedCPUs=` reset: on an
# empty value systemd drops cpuset from the unit's controller mask and skips
# writing cpuset.cpus, so a unit sitting directly under system.slice (where
# the controller stays enabled) keeps the old "8-15" in the kernel while
# `systemctl show` reports ''. Seen on the stock worker 2026-09-15.
# --runtime on purpose: the setting lives in /run and dies with the boot, so
# if this script is ever replaced by one that does not know about it, the
# box is back to all CPUs the next day instead of being half-capped forever.
# Applying AllowedCPUs to a running unit takes effect immediately and does
# not restart it; on the inactive oneshot drainer it applies at its next run.
cap_recording_cpus() {
    local mode="$1" want u cur
    if [ "$mode" = "LATE" ]; then want=$(late_cpuset); else want=$(all_cpuset); fi
    for u in $(recording_units); do
        cur=$(systemctl show "$u" -p AllowedCPUs --value 2>/dev/null)
        [ "$cur" = "$want" ] && continue
        if systemctl set-property --runtime "$u" AllowedCPUs="$want" 2>&1 | head -3 >> "$LOG_FILE"; then
            log "AllowedCPUs ${u}: '${cur:-unset}' → '${want}'"
        fi
    done
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

# Decide target. LATE shares ACTIVE's weight/threads; what differs is the
# hold (off) and the cpuset cap (on) — both applied below.
if [ "$count" -eq 0 ]; then
    MODE="IDLE"
    CPU_TARGET=200
    THREADS_TARGET=0
elif is_late_window; then
    MODE="LATE"
    CPU_TARGET=10
    THREADS_TARGET=2
else
    MODE="ACTIVE"
    CPU_TARGET=10
    THREADS_TARGET=2
fi

# Apply ffmpeg threads change first — this affects future process.rb runs
# whether or not the cgroup weights change.
set_ffmpeg_threads "$THREADS_TARGET"

# Hold/release the pipeline. Runs every tick (not only on a CPUWeight flip)
# so a lost key or a stale hold file is corrected within a minute.
hold_recording_pipeline "$MODE"

# Cap/uncap the CPUs. Also every tick, for the same reason.
cap_recording_cpus "$MODE"

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
