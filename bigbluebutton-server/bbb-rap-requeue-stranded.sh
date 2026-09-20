#!/bin/bash
# Re-enqueue recordings the nightly poweroff killed mid-pipeline.
#
# At 18:25 UTC the Hetzner shutdown SIGTERMs the rap workers. Resque does NOT
# requeue a job it was working — it lands in resque:failed and the recording
# is stranded forever at "Awaiting Process" with no queue entry. Historically
# ~4 recordings/day were lost this way (252 Resque::TermException entries in
# resque:failed as of 2026-09-10). With N parallel workers, N are at risk each
# night, so this runs at boot and puts them back in line.
#
# Deliberately conservative: only touches recordings that have archived.done
# or sanity.done (i.e. BBB really started on them) and are NOT already queued
# or published. Raw-only dirs (empty rooms that were never recorded) are
# skipped — there are ~93 of those on disk and they are not real recordings.
set -uo pipefail
LOG=/var/log/bigbluebutton/vacademy-rap-requeue.log
ST=/var/bigbluebutton/recording/status
log() { echo "[$(date '+%F %T')] $*" >> "$LOG"; }

# Wait for redis to be answering before we read the queues.
for i in $(seq 1 30); do redis-cli PING >/dev/null 2>&1 && break; sleep 2; done
if ! redis-cli PING >/dev/null 2>&1; then log "redis not reachable — skipping"; exit 0; fi

queued=$(mktemp)
for q in archive sanity captions process publish post_publish events; do
  redis-cli --raw LRANGE "resque:queue:rap:$q" 0 -1
done | grep -oE '"meeting_id":"[^"]+"' | cut -d'"' -f4 > "$queued"
for w in $(redis-cli --raw SMEMBERS resque:workers); do
  redis-cli --raw GET "resque:worker:$w" 2>/dev/null
done | grep -oE '"meeting_id":"[^"]+"' | cut -d'"' -f4 >> "$queued"

n=0
for f in "$ST"/archived/*.done "$ST"/sanity/*.done; do
  [ -e "$f" ] || continue
  id=$(basename "$f" .done); id=${id%%-presentation}
  # already finished?
  ls "$ST"/published/"$id"*.done >/dev/null 2>&1 && continue
  [ -f /var/spool/bbb-recording-uploaded/"$id" ] && continue
  # hard-failed? leave it alone — a rebuild would just fail again
  ls "$ST"/*/"$id"*.fail >/dev/null 2>&1 && continue
  # already in a queue or being worked?
  grep -qxF "$id" "$queued" && continue
  log "requeueing stranded $id"
  bbb-record --rebuild "$id" >>"$LOG" 2>&1 && n=$((n+1))
  echo "$id" >> "$queued"
done
rm -f "$queued"
log "requeued $n stranded recording(s)"
