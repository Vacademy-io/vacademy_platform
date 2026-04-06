#!/bin/bash
# =============================================================
# BBB Post-Publish Hook — Upload Recording to S3
# =============================================================
# This script runs on the BBB server AFTER recording processing
# completes. It uploads TWO recordings when content is available:
#   A) Content recording (screen share OR camera-as-content + audio)
#   B) Webcams recording (all participants combined + audio)
#
# Content video source priority:
#   1. Deskshare (screen share) — published deskshare/
#   2. Camera-as-content (BBB 3.0) — identified via events.xml
#   3. Presenter webcam (individual stream from raw recordings)
#
# Audio: extracted from published webcams.webm (time-aligned with
# deskshare.webm — both span full recording from t=0).
#
# Steps per recording:
#   1. Find video source
#   2. Combine with mixed audio, convert to MP4
#   3. Get presigned S3 URL from Vacademy backend
#   4. Upload MP4 to S3
#   5. Register recording in Vacademy database (with type tag)
#
# BBB passes the meeting internal ID as the first argument.
#
# Install location:
#   /usr/local/bigbluebutton/core/scripts/post_publish/
#
# Configuration is loaded from:
#   /etc/bigbluebutton/vacademy-recording.conf
# =============================================================

set -uo pipefail
# NOTE: We intentionally do NOT use 'set -e' because we need to handle
# ffmpeg failures gracefully with fallback logic.

INTERNAL_MEETING_ID="$1"
LOG_FILE="/var/log/bigbluebutton/vacademy-recording-upload.log"

log() {
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] $*" >> "$LOG_FILE"
}

log "=========================================="
log "Post-publish started for internal meeting: $INTERNAL_MEETING_ID"

# ── Load configuration ──────────────────────────────────────
CONF_FILE="/etc/bigbluebutton/vacademy-recording.conf"
if [ ! -f "$CONF_FILE" ]; then
    log "ERROR: Config file not found: $CONF_FILE"
    exit 1
fi
source "$CONF_FILE"

BACKEND_URL="${VACADEMY_BACKEND_URL:?Set VACADEMY_BACKEND_URL in $CONF_FILE}"
BBB_SECRET="${VACADEMY_BBB_SECRET:?Set VACADEMY_BBB_SECRET in $CONF_FILE}"

# ── Locate directories ─────────────────────────────────────
PUBLISHED_DIR="/var/bigbluebutton/published/presentation/$INTERNAL_MEETING_ID"
RAW_DIR="/var/bigbluebutton/recording/raw/$INTERNAL_MEETING_ID"

if [ ! -d "$PUBLISHED_DIR" ]; then
    log "ERROR: Published directory not found: $PUBLISHED_DIR"
    exit 1
fi

log "Published dir: $PUBLISHED_DIR"
log "Raw dir: $RAW_DIR"

# ── Extract external meeting ID from metadata ────────────────
METADATA_FILE="$PUBLISHED_DIR/metadata.xml"
MEETING_ID="$INTERNAL_MEETING_ID"
if [ -f "$METADATA_FILE" ]; then
    EID=$(MFILE="$METADATA_FILE" python3 -c "
import xml.etree.ElementTree as ET, os
tree = ET.parse(os.environ['MFILE'])
root = tree.getroot()
mid = root.find('.//meetingId')
if mid is not None and mid.text: print(mid.text)
" 2>/dev/null || echo "")
    if [ -n "$EID" ]; then
        MEETING_ID="$EID"
        log "Resolved external meeting ID: $MEETING_ID"
    else
        log "WARN: Could not extract external meeting ID from metadata, using internal ID"
    fi
else
    log "WARN: metadata.xml not found, using internal meeting ID"
fi

# ── Extract recording start time (used by all uploads) ─────
START_TIME=$(date -u +"%Y-%m-%dT%H:%M:%SZ")
if [ -f "$METADATA_FILE" ]; then
    START_EPOCH=$(MFILE="$METADATA_FILE" python3 -c "
import xml.etree.ElementTree as ET, datetime, os
tree = ET.parse(os.environ['MFILE'])
root = tree.getroot()
st = root.find('.//start_time')
if st is not None and st.text:
    print(datetime.datetime.utcfromtimestamp(int(st.text)/1000).strftime('%Y-%m-%dT%H:%M:%SZ'))
" 2>/dev/null || echo "")
    if [ -n "$START_EPOCH" ]; then
        START_TIME="$START_EPOCH"
    fi
fi

# ── Helper: find published webcams file (used as audio source) ─
# BBB's published webcams.webm and deskshare.webm are already
# time-aligned (both span full recording duration from t=0).
# Using webcams.webm as audio source avoids all sync issues
# vs raw FreeSWITCH audio which has different timestamps.
find_webcams_audio_source() {
    for candidate in \
        "$PUBLISHED_DIR/video/webcams.webm" \
        "$PUBLISHED_DIR/video/webcams.mp4"; do
        if [ -f "$candidate" ]; then
            echo "$candidate"
            return
        fi
    done
    echo ""
}

# ── Helper: build MP4 from video + optional audio source ──────
# Usage: build_mp4 <video_source> <audio_source> <output_mp4>
# audio_source: file to extract audio from (e.g. webcams.webm). Empty = use video's own audio.
# When audio_source is provided, both files must share the same timeline (published BBB files do).
build_mp4() {
    local video_src="$1"
    local audio_src="$2"
    local output="$3"

    if [ ! -f "$video_src" ]; then
        log "ERROR: Video source not found: $video_src"
        return 1
    fi

    if ! command -v ffmpeg &>/dev/null; then
        if [[ "$video_src" == *.mp4 ]]; then
            cp "$video_src" "$output"
            return 0
        fi
        log "WARN: ffmpeg not installed — cannot convert"
        return 1
    fi

    # Common encoding settings: 480p, ultrafast for speed, good enough quality
    local VFILTER="-vf scale=-2:480"
    local VCODEC="-c:v libx264 -preset ultrafast -crf 28 -pix_fmt yuv420p"
    local ACODEC="-c:a aac -b:a 128k"
    local FLAGS="-movflags +faststart"

    if [ -n "$audio_src" ] && [ -f "$audio_src" ]; then
        # Both published files (deskshare.webm + webcams.webm) share the same
        # timeline from t=0, so no offset/sync calculation is needed.
        log "Merging video from $video_src + audio from $audio_src"

        # shellcheck disable=SC2086
        ffmpeg -y \
            -i "$video_src" \
            -i "$audio_src" \
            $VFILTER $VCODEC $ACODEC \
            -map 0:v:0 -map 1:a:0 \
            -shortest \
            $FLAGS \
            "$output" >> "$LOG_FILE" 2>&1

        if [ $? -ne 0 ]; then
            log "WARN: ffmpeg merge failed — trying video-only"
            # shellcheck disable=SC2086
            ffmpeg -y \
                -i "$video_src" \
                $VFILTER $VCODEC $ACODEC \
                $FLAGS \
                "$output" >> "$LOG_FILE" 2>&1
        fi
    else
        # No separate audio source — convert video with its own audio track
        # shellcheck disable=SC2086
        ffmpeg -y \
            -i "$video_src" \
            $VFILTER $VCODEC $ACODEC \
            $FLAGS \
            "$output" >> "$LOG_FILE" 2>&1
    fi

    [ -f "$output" ]
}

# ── Helper: upload a recording to S3 and register in backend ──
# Usage: upload_recording <mp4_file> <file_name> <recording_type>
# recording_type: "content", "webcams", or "full"
upload_recording() {
    local mp4_file="$1"
    local file_name="$2"
    local rec_type="$3"

    if [ ! -f "$mp4_file" ]; then
        log "ERROR: Cannot upload — file not found: $mp4_file"
        return 1
    fi

    local file_type="video/mp4"
    if [[ "$mp4_file" == *.webm ]]; then
        file_type="video/webm"
    fi
    local file_size
    file_size=$(stat -c%s "$mp4_file" 2>/dev/null || stat -f%z "$mp4_file")

    local duration_seconds=0
    if command -v ffprobe &>/dev/null; then
        duration_seconds=$(ffprobe -v error -show_entries format=duration \
            -of default=noprint_wrappers=1:nokey=1 "$mp4_file" 2>/dev/null | cut -d. -f1 || echo "0")
    fi

    local recording_id="${MEETING_ID}-${rec_type}"

    log "[$rec_type] File: $file_name, Size: $file_size bytes, Duration: ${duration_seconds}s"

    # Step 1: Get presigned upload URL
    log "[$rec_type] Requesting presigned upload URL..."
    local init_response http_code init_body
    init_response=$(curl -s -w "\n%{http_code}" -X POST \
        "${BACKEND_URL}/admin-core-service/live-sessions/provider/meeting/recording/init-upload?meetingId=${MEETING_ID}&fileName=${file_name}&fileType=${file_type}" \
        -H "X-BBB-Secret: ${BBB_SECRET}" \
        -H "Content-Type: application/json")

    http_code=$(echo "$init_response" | tail -1)
    init_body=$(echo "$init_response" | sed '$d')

    if [ "$http_code" != "200" ]; then
        log "[$rec_type] ERROR: init-upload failed (HTTP $http_code): $init_body"
        return 1
    fi

    local upload_url file_id
    upload_url=$(echo "$init_body" | python3 -c "import sys,json; print(json.load(sys.stdin)['uploadUrl'])" 2>/dev/null)
    file_id=$(echo "$init_body" | python3 -c "import sys,json; print(json.load(sys.stdin)['fileId'])" 2>/dev/null)

    if [ -z "$upload_url" ] || [ -z "$file_id" ]; then
        log "[$rec_type] ERROR: Failed to parse presigned URL response: $init_body"
        return 1
    fi

    log "[$rec_type] Got presigned URL. FileId: $file_id"

    # Step 2: Upload to S3
    log "[$rec_type] Uploading to S3 ($(du -h "$mp4_file" | cut -f1))..."
    local upload_http_code
    upload_http_code=$(curl -s -o /dev/null -w "%{http_code}" -X PUT \
        -H "Content-Type: ${file_type}" \
        --data-binary "@${mp4_file}" \
        "$upload_url")

    if [ "$upload_http_code" != "200" ] && [ "$upload_http_code" != "204" ]; then
        log "[$rec_type] ERROR: S3 upload failed (HTTP $upload_http_code)"
        return 1
    fi

    log "[$rec_type] S3 upload complete (HTTP $upload_http_code)"

    # Step 3: Register in backend
    log "[$rec_type] Registering recording in backend..."
    local complete_response complete_code complete_body
    complete_response=$(curl -s -w "\n%{http_code}" -X POST \
        "${BACKEND_URL}/admin-core-service/live-sessions/provider/meeting/recording/complete" \
        -H "X-BBB-Secret: ${BBB_SECRET}" \
        -H "Content-Type: application/json" \
        -d "{
            \"meetingId\": \"${MEETING_ID}\",
            \"fileId\": \"${file_id}\",
            \"recordingId\": \"${recording_id}\",
            \"type\": \"${rec_type}\",
            \"durationSeconds\": ${duration_seconds},
            \"startTime\": \"${START_TIME}\"
        }")

    complete_code=$(echo "$complete_response" | tail -1)
    complete_body=$(echo "$complete_response" | sed '$d')

    if [ "$complete_code" != "200" ]; then
        log "[$rec_type] WARN: Registration returned HTTP $complete_code: $complete_body"
    else
        log "[$rec_type] Recording registered successfully"
    fi

    return 0
}

# ══════════════════════════════════════════════════════════════
# PHASE 1: Find the CONTENT video source
# ══════════════════════════════════════════════════════════════
# Priority:
#   1. Published/raw deskshare (screen share)
#   2. Camera-as-content (BBB 3.0 — identified via events.xml)
#   3. Presenter webcam from raw recordings
# ══════════════════════════════════════════════════════════════

CONTENT_VIDEO=""
CONTENT_IS_PUBLISHED=false   # true = time-aligned with webcams.webm, safe to merge audio

# ── Priority 1: Check for published deskshare (screen share) ──
for candidate in \
    "$PUBLISHED_DIR/deskshare/deskshare.webm" \
    "$PUBLISHED_DIR/deskshare/deskshare.mp4"; do
    if [ -f "$candidate" ]; then
        FSIZE=$(stat -c%s "$candidate" 2>/dev/null || stat -f%z "$candidate")
        if [ "$FSIZE" -gt 50000 ] 2>/dev/null; then
            CONTENT_VIDEO="$candidate"
            CONTENT_IS_PUBLISHED=true
            log "Found published deskshare: $candidate ($(du -h "$candidate" | cut -f1))"
            break
        else
            log "Skipping tiny deskshare file: $candidate (${FSIZE} bytes)"
        fi
    fi
done

# ── Priority 2: Camera-as-content (BBB 3.0) ─────────────────
# "Share camera as content" stores the stream in video/<meetingId>/
# alongside regular webcams. We identify it via screenshare-related
# events in events.xml that reference a stream/filename.
if [ -z "$CONTENT_VIDEO" ] && [ -d "$RAW_DIR" ] && [ -f "$RAW_DIR/events.xml" ]; then
    log "No deskshare found — checking for camera-as-content in events.xml"

    CAC_INFO=$(EVENTS_FILE="$RAW_DIR/events.xml" RAW_DIR="$RAW_DIR" INTERNAL_ID="$INTERNAL_MEETING_ID" python3 << 'PYEOF'
import xml.etree.ElementTree as ET
import os, glob

events_file = os.environ['EVENTS_FILE']
raw_dir = os.environ['RAW_DIR']
internal_id = os.environ['INTERNAL_ID']
tree = ET.parse(events_file)
root = tree.getroot()

# Collect all screenshare/camera-as-content related streams
# BBB 3.0 uses various event names — check all known variants
cac_events = [
    'ScreenshareRtcStartedEvent',
    'DeskShareStartedEvent',
    'DeskshareStartedEvent',
    'StartDeskShareEvent',
    'SetScreenshareAsContentEvent',
    'StartScreenshareAsContentEvent',
    'ShareCameraAsContentEvent',
]

cac_streams = []
for event in root.findall(".//event"):
    ename = event.get('eventname', '')
    if ename not in cac_events:
        continue

    # Try to extract stream/filename from the event
    for field in ['stream', 'filename', 'file', 'streamPath']:
        el = event.find(field)
        if el is not None and el.text and el.text.strip():
            cac_streams.append(el.text.strip())

# Also check for StartWebRTCShareEvent with contentType indicating screenshare
for event in root.findall(".//event[@eventname='StartWebRTCShareEvent']"):
    ct = event.find('contentType')
    if ct is not None and ct.text and 'screen' in ct.text.lower():
        fname = event.find('filename')
        if fname is not None and fname.text:
            cac_streams.append(fname.text.strip())

# Check for ShareStartedEvent with screenshare indication
for event in root.findall(".//event"):
    ename = event.get('eventname', '')
    if 'share' in ename.lower() and 'screen' in ename.lower():
        for field in ['stream', 'filename', 'file']:
            el = event.find(field)
            if el is not None and el.text and el.text.strip():
                cac_streams.append(el.text.strip())

if not cac_streams:
    # Fallback: check if there's a video file in deskshare-like directories
    # BBB 3.0 might store camera-as-content in video/<meetingId>/
    video_mid_dir = os.path.join(raw_dir, 'video', internal_id)
    if os.path.isdir(video_mid_dir):
        # If there are video files here, they might be camera-as-content
        # We can't distinguish without events, so report them for logging
        files = [f for f in os.listdir(video_mid_dir) if f.endswith(('.webm', '.mp4'))]
        if files:
            print(f"VIDEO_DIR_FILES|{video_mid_dir}|{','.join(files)}")
            exit(0)
    print("NO_CAC")
    exit(0)

# Resolve streams to actual files
search_dirs = [
    os.path.join(raw_dir, 'video', internal_id),
    os.path.join(raw_dir, 'video'),
    os.path.join(raw_dir, 'deskshare'),
    raw_dir,
]

found = set()
for stream in cac_streams:
    for d in search_dirs:
        if not os.path.isdir(d):
            continue
        # Try exact path
        if os.path.isfile(stream):
            if os.path.getsize(stream) > 50000:
                found.add(stream)
            continue
        # Try basename in directory
        basename = os.path.basename(stream)
        for ext in ['', '.webm', '.mp4']:
            candidate = os.path.join(d, basename + ext)
            if os.path.isfile(candidate) and os.path.getsize(candidate) > 50000:
                found.add(candidate)
        # Glob match
        for match in glob.glob(os.path.join(d, f'*{basename}*')):
            if os.path.isfile(match) and os.path.getsize(match) > 50000:
                found.add(match)

if found:
    best = max(found, key=os.path.getsize)
    print(f"CAC|{best}")
else:
    print(f"NO_CAC_FILE|streams={','.join(cac_streams)}")
PYEOF
    )

    log "Camera-as-content detection result: $CAC_INFO"

    if [[ "$CAC_INFO" == CAC\|* ]]; then
        CONTENT_VIDEO="${CAC_INFO#CAC|}"
        log "Found camera-as-content video: $CONTENT_VIDEO ($(du -h "$CONTENT_VIDEO" | cut -f1))"
    elif [[ "$CAC_INFO" == VIDEO_DIR_FILES\|* ]]; then
        # Found files in video/<meetingId>/ but no events to confirm camera-as-content
        # Log for debugging, don't use as content (could be regular webcams)
        log "Found video files in raw/video/$INTERNAL_MEETING_ID/ but no CAC events — will check presenter webcam next"
    elif [[ "$CAC_INFO" == NO_CAC_FILE\|* ]]; then
        log "WARN: Found CAC events in events.xml but could not locate files on disk"
    fi
fi

# ── Priority 3: Presenter webcam from raw recordings ─────────
if [ -z "$CONTENT_VIDEO" ] && [ -d "$RAW_DIR" ] && [ -f "$RAW_DIR/events.xml" ]; then
    log "No deskshare or CAC found — trying presenter webcam extraction from raw"

    PRESENTER_INFO=$(EVENTS_FILE="$RAW_DIR/events.xml" python3 << 'PYEOF'
import xml.etree.ElementTree as ET
import os

events_file = os.environ['EVENTS_FILE']
raw_dir = os.path.dirname(events_file)
tree = ET.parse(events_file)
root = tree.getroot()

# 1. Find all presenter assignments (ordered by timestamp)
presenters = []
for event in root.findall(".//event[@eventname='AssignPresenterEvent']"):
    userid = event.find('userid')
    if userid is None:
        userid = event.find('userId')
    name = event.find('name')
    ts = event.get('timestamp', '0')
    if userid is not None and userid.text:
        presenters.append({
            'timestamp': int(ts),
            'userId': userid.text,
            'name': name.text if name is not None else 'unknown'
        })

if not presenters:
    print("NO_PRESENTER")
    exit(0)

presenters.sort(key=lambda p: p['timestamp'])

# Deduplicate
seen = set()
unique_presenters = []
for p in presenters:
    if p['userId'] not in seen:
        seen.add(p['userId'])
        unique_presenters.append(p)

# 2. Build userId -> webcam filename mapping from events
webcam_by_user = {}
for event in root.findall(".//event"):
    ename = event.get('eventname', '')
    if ename in ('StartWebRTCShareEvent', 'StartWebcamShareEvent'):
        # Skip screenshare streams (camera-as-content)
        ct = event.find('contentType')
        if ct is not None and ct.text and 'screen' in ct.text.lower():
            continue
        uid_el = event.find('userId')
        if uid_el is None:
            uid_el = event.find('userid')
        fname_el = event.find('filename')
        if uid_el is not None and uid_el.text and fname_el is not None and fname_el.text:
            webcam_by_user.setdefault(uid_el.text, []).append(fname_el.text)

# 3. Also scan raw/video/ directory for userId-matching files as fallback
video_dir = os.path.join(raw_dir, 'video')
if os.path.isdir(video_dir):
    for f in sorted(os.listdir(video_dir)):
        if f.endswith('.webm'):
            for p in unique_presenters:
                if p['userId'] in f:
                    webcam_by_user.setdefault(p['userId'], []).append(
                        os.path.join(video_dir, f))

# 4. Resolve actual file paths
def resolve_file(wf):
    if os.path.isfile(wf):
        return wf
    basename = os.path.basename(wf)
    archived = os.path.join(raw_dir, 'video', basename)
    if os.path.isfile(archived):
        return archived
    return None

found_names = []
found_files = []
seen_files = set()

for p in unique_presenters:
    files = webcam_by_user.get(p['userId'], [])
    for wf in files:
        resolved = resolve_file(wf)
        if resolved and resolved not in seen_files:
            seen_files.add(resolved)
            found_files.append(resolved)
            if p['name'] not in found_names:
                found_names.append(p['name'])

if not found_files:
    print("NO_WEBCAM")
    exit(0)

print(f"PRESENTER|{','.join(found_names)}|{','.join(found_files)}")
PYEOF
    )

    log "Presenter extraction result: $PRESENTER_INFO"

    if [[ "$PRESENTER_INFO" == PRESENTER\|* ]]; then
        IFS='|' read -r _ PRESENTER_NAMES PRESENTER_FILES <<< "$PRESENTER_INFO"
        log "Found presenter(s): $PRESENTER_NAMES"
        log "Presenter webcam file(s): $PRESENTER_FILES"

        IFS=',' read -ra PRESENTER_VIDEO_ARRAY <<< "$PRESENTER_FILES"
        CONTENT_VIDEO="${PRESENTER_VIDEO_ARRAY[0]}"

        # Pick longest segment if multiple
        if [ ${#PRESENTER_VIDEO_ARRAY[@]} -gt 1 ] && command -v ffprobe &>/dev/null; then
            log "Multiple presenter segments (${#PRESENTER_VIDEO_ARRAY[@]}) — picking longest..."
            BEST_FILE=""
            BEST_DUR=0
            for seg in "${PRESENTER_VIDEO_ARRAY[@]}"; do
                if [ -f "$seg" ]; then
                    SEG_DUR=$(ffprobe -v error -show_entries format=duration \
                        -of default=noprint_wrappers=1:nokey=1 "$seg" 2>/dev/null || echo "0")
                    SEG_DUR_INT=$(echo "$SEG_DUR" | cut -d. -f1)
                    SEG_DUR_INT=${SEG_DUR_INT:-0}
                    log "  segment: $seg (${SEG_DUR}s)"
                    if [ "$SEG_DUR_INT" -gt "$BEST_DUR" ] 2>/dev/null; then
                        BEST_DUR=$SEG_DUR_INT
                        BEST_FILE="$seg"
                    fi
                fi
            done
            if [ -n "$BEST_FILE" ]; then
                CONTENT_VIDEO="$BEST_FILE"
                log "Selected longest segment: $CONTENT_VIDEO (${BEST_DUR}s)"
            fi
        fi
    elif [[ "$PRESENTER_INFO" == "NO_PRESENTER" ]]; then
        log "WARN: No presenter assignment found in events.xml"
    elif [[ "$PRESENTER_INFO" == "NO_WEBCAM" ]]; then
        log "WARN: Presenter found but no webcam file"
    fi
elif [ -z "$CONTENT_VIDEO" ]; then
    log "WARN: Raw recording directory not found — no content video available"
fi

# ── Find audio source for content recording ──────────────────
# Only use webcams.webm as audio when content is from published dir
# (published deskshare.webm and webcams.webm are time-aligned from t=0).
# Raw files have different timelines — merging would cause sync issues.
WEBCAMS_AUDIO=""
if [ "$CONTENT_IS_PUBLISHED" = true ]; then
    WEBCAMS_AUDIO=$(find_webcams_audio_source)
    if [ -n "$WEBCAMS_AUDIO" ]; then
        log "Audio source for content: $WEBCAMS_AUDIO (time-aligned, no offset needed)"
    else
        log "WARN: No published webcams file found for audio"
    fi
else
    log "Content is from raw recording — skipping audio merge (would cause sync issues)"
fi

# ══════════════════════════════════════════════════════════════
# PHASE 2: Build MP4 files and upload
# ══════════════════════════════════════════════════════════════

UPLOAD_COUNT=0

# ── Recording A: Content (screen share / camera-as-content / presenter) ──
if [ -n "$CONTENT_VIDEO" ]; then
    MP4_CONTENT="/tmp/vacademy-recording-${MEETING_ID}-content.mp4"
    log "Building content recording from: $CONTENT_VIDEO"

    if build_mp4 "$CONTENT_VIDEO" "$WEBCAMS_AUDIO" "$MP4_CONTENT"; then
        log "Content MP4 created: $(du -h "$MP4_CONTENT" | cut -f1)"

        FILE_NAME_CONTENT="recording-${MEETING_ID}-content.mp4"
        if upload_recording "$MP4_CONTENT" "$FILE_NAME_CONTENT" "content"; then
            UPLOAD_COUNT=$((UPLOAD_COUNT + 1))
        fi

        # Cleanup
        if [[ "$MP4_CONTENT" == /tmp/* ]] && [ -f "$MP4_CONTENT" ]; then
            rm -f "$MP4_CONTENT"
            log "Cleaned up: $MP4_CONTENT"
        fi
    else
        log "ERROR: Failed to build content MP4"
    fi
else
    log "No content video source found — skipping content recording"
fi

# ── Recording B: Webcams (all participants combined) ─────────
WEBCAMS_SOURCE=""
for candidate in \
    "$PUBLISHED_DIR/video/webcams.webm" \
    "$PUBLISHED_DIR/video/webcams.mp4"; do
    if [ -f "$candidate" ]; then
        WEBCAMS_SOURCE="$candidate"
        break
    fi
done

if [ -n "$WEBCAMS_SOURCE" ]; then
    MP4_WEBCAMS="/tmp/vacademy-recording-${MEETING_ID}-webcams.mp4"
    log "Building webcams recording from: $WEBCAMS_SOURCE"

    # webcams.webm already has audio mixed in, so no need for separate audio
    if build_mp4 "$WEBCAMS_SOURCE" "" "$MP4_WEBCAMS"; then
        log "Webcams MP4 created: $(du -h "$MP4_WEBCAMS" | cut -f1)"

        # If this is the only recording, tag it as "full" for backward compatibility
        local_type="webcams"
        if [ $UPLOAD_COUNT -eq 0 ]; then
            local_type="full"
            log "No content recording — tagging webcams as 'full'"
        fi

        FILE_NAME_WEBCAMS="recording-${MEETING_ID}-webcams.mp4"
        if upload_recording "$MP4_WEBCAMS" "$FILE_NAME_WEBCAMS" "$local_type"; then
            UPLOAD_COUNT=$((UPLOAD_COUNT + 1))
        fi

        # Cleanup
        if [[ "$MP4_WEBCAMS" == /tmp/* ]] && [ -f "$MP4_WEBCAMS" ]; then
            rm -f "$MP4_WEBCAMS"
            log "Cleaned up: $MP4_WEBCAMS"
        fi
    else
        log "ERROR: Failed to build webcams MP4"
    fi
else
    log "WARN: No published webcams video found"
fi

# ── Fallback: if nothing was uploaded, try any available video ──
if [ $UPLOAD_COUNT -eq 0 ]; then
    log "No recordings uploaded yet — trying any available video as fallback"

    FALLBACK_VIDEO=""
    for candidate in \
        "$PUBLISHED_DIR/deskshare/deskshare.webm" \
        "$PUBLISHED_DIR/deskshare/deskshare.mp4" \
        "$PUBLISHED_DIR/video/webcams.webm" \
        "$PUBLISHED_DIR/video/webcams.mp4"; do
        if [ -f "$candidate" ]; then
            FALLBACK_VIDEO="$candidate"
            break
        fi
    done

    if [ -n "$FALLBACK_VIDEO" ]; then
        MP4_FALLBACK="/tmp/vacademy-recording-${MEETING_ID}-full.mp4"
        log "Using fallback: $FALLBACK_VIDEO"

        if build_mp4 "$FALLBACK_VIDEO" "" "$MP4_FALLBACK"; then
            FILE_NAME_FALLBACK="recording-${MEETING_ID}.mp4"
            upload_recording "$MP4_FALLBACK" "$FILE_NAME_FALLBACK" "full"

            if [[ "$MP4_FALLBACK" == /tmp/* ]] && [ -f "$MP4_FALLBACK" ]; then
                rm -f "$MP4_FALLBACK"
            fi
        fi
    else
        log "WARN: No video file found at all for meeting $MEETING_ID — nothing to upload"
    fi
fi

# ── Run analytics callback (piggyback on post_publish) ──
ANALYTICS_SCRIPT="/usr/local/bigbluebutton/core/scripts/post_events/post_events_analytics_callback.rb"
if [ -f "$ANALYTICS_SCRIPT" ]; then
    log "Running analytics callback..."
    cd /usr/local/bigbluebutton/core/scripts
    ruby "$ANALYTICS_SCRIPT" -m "$MEETING_ID" 2>&1 | while read line; do log "[analytics] $line"; done
    log "Analytics callback complete"
else
    log "Analytics script not found, skipping"
fi

log "Post-publish complete for meeting: $MEETING_ID (uploaded $UPLOAD_COUNT recording(s))"
log "=========================================="
