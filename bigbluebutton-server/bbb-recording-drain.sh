#!/bin/bash
# =============================================================
# BBB Recording Drain — processes the deferred-upload queue
# =============================================================
# Reads /var/spool/bbb-recording-queue.txt and runs the post-publish
# upload for each recordId, ONE AT A TIME, with the lowest priority
# the kernel allows. This keeps ffmpeg/curl out of the live-meeting
# CPU window — meetings end, hook queues, drain runs later off-peak
# (and is forced to completion before bbb-stop snapshots the box).
#
# Invocation modes:
#   bbb-recording-drain.sh           — drain whatever is queued, exit when empty
#   bbb-recording-drain.sh --watch   — same, but log a no-op line if empty (for timer use)
#
# Concurrency: a single flock guarantees only one drainer runs at a time
# even if the systemd timer overlaps with the bbb-stop final-drain.
# =============================================================

set -uo pipefail

QUEUE_FILE="/var/spool/bbb-recording-queue.txt"
LOCK_FILE="/var/lock/bbb-recording-drain.lock"
LOG_FILE="/var/log/bigbluebutton/vacademy-recording-upload.log"
HOOK="/usr/local/bigbluebutton/core/scripts/post_publish/post-publish-s3-upload.sh"

log() {
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] [drain] $*" >> "$LOG_FILE"
}

# Acquire global lock — fail fast if another drainer is running
exec 9>"$LOCK_FILE"
if ! flock -n 9; then
    [ "${1:-}" = "--watch" ] && log "drain already running — skipping"
    exit 0
fi

if [ ! -s "$QUEUE_FILE" ]; then
    [ "${1:-}" = "--watch" ] && log "queue empty — nothing to drain"
    exit 0
fi

# Atomically claim the current queue contents and truncate the file so new
# enqueues during this drain don't get lost (they go into the freshly-empty
# queue and will be picked up by the next run).
WORK_FILE=$(mktemp /tmp/bbb-drain-XXXXXX.txt)
# (Combined cleanup trap is installed further down once we know CURRENT_FILE.)

(
    flock 8
    cp "$QUEUE_FILE" "$WORK_FILE"
    : > "$QUEUE_FILE"
) 8>>"$QUEUE_FILE.lock"

count=$(wc -l < "$WORK_FILE")
log "draining $count recordId(s)"

# Sort + dedupe so an accidental double-enqueue runs the hook only once
sort -u "$WORK_FILE" -o "$WORK_FILE"

processed=0
failed=0
CURRENT_FILE="/var/spool/bbb-recording-uploading"
recid=""

# Cleanup trap: runs on every exit (normal, error, or SIGTERM from systemctl stop).
# Two responsibilities:
#   1. Remove the "currently processing" marker so the dashboard reflects truth.
#   2. If we were mid-hook for a recid when killed, re-enqueue it so the next
#      drain run retries. Without this, sigterm during ffmpeg silently loses
#      the recording — exactly what the queue model was meant to prevent.
cleanup() {
    rm -f "$CURRENT_FILE" 2>/dev/null
    if [ -n "${recid:-}" ]; then
        log "interrupted while processing $recid — re-queuing"
        (flock 8; echo "$recid" >> "$QUEUE_FILE") 8>>"$QUEUE_FILE.lock" 2>/dev/null
    fi
    rm -f "$WORK_FILE" 2>/dev/null
}
trap cleanup EXIT
trap 'exit 143' TERM  # so EXIT trap fires on SIGTERM

while IFS= read -r recid; do
    [ -z "$recid" ] && continue
    log "processing $recid"
    # Publish the active recordId so the dashboard can show "Uploading"
    # status. Atomic write via mv from a tmp file so readers never see
    # a partial value.
    echo "$recid" > "${CURRENT_FILE}.tmp" 2>/dev/null
    mv "${CURRENT_FILE}.tmp" "$CURRENT_FILE" 2>/dev/null
    # Lowest priority for both CPU (Nice 19) and IO (idle class) — guarantees
    # this drain yields to anything realtime even if cgroup limits aren't set.
    rc=0
    nice -n 19 ionice -c idle "$HOOK" --drain "$recid" || rc=$?
    if [ "$rc" -eq 0 ]; then
        log "done $recid"
        processed=$((processed + 1))
    else
        log "FAILED $recid (rc=$rc) — re-queuing for next run"
        (flock 8; echo "$recid" >> "$QUEUE_FILE") 8>>"$QUEUE_FILE.lock"
        failed=$((failed + 1))
    fi
    rm -f "$CURRENT_FILE" 2>/dev/null
    # Clear recid so the EXIT trap does NOT think we were interrupted mid-run.
    recid=""
done < "$WORK_FILE"

log "drain complete — processed=$processed failed=$failed"
