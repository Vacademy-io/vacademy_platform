#!/usr/bin/env bash
# =============================================================
# BBB load-test metrics capture — run ON THE BBB SERVER during a test.
# =============================================================
# Samples system + per-process CPU/mem and live BBB meeting/user/stream counts
# to a CSV, prints a live line, and flags whenever CPU crosses the 70% line
# (above which BBB audio starts to degrade).
#
# Usage (on the BBB box, as root):
#   bash capture-metrics.sh [INTERVAL_SECONDS] [OUTPUT_CSV]
#   bash capture-metrics.sh 5
#
# Stop with Ctrl-C. The CSV is the artifact to compare across runs / server sizes.
# =============================================================
set -uo pipefail

INTERVAL="${1:-5}"
OUT="${2:-/var/log/bigbluebutton/loadtest-metrics-$(date +%Y%m%d-%H%M%S).csv}"
CORES="$(nproc)"

# Resolve secret + domain from the box itself (so this is copy-paste portable).
SECRET="$(bbb-conf --secret 2>/dev/null | grep -oP 'Secret:\s+\K\S+' | head -1 || true)"
DOMAIN="$(bbb-conf --secret 2>/dev/null | grep -oP 'URL:\s+https://\K[^/]+' | head -1)"
[ -z "${DOMAIN:-}" ] && DOMAIN="$(hostname -f 2>/dev/null || echo localhost)"

# getMeetings uses sha1 here (matches the known-good bbb-rap-autotune.sh path).
gm_checksum() { printf '%s' "getMeetings${SECRET}" | sha1sum | awk '{print $1}'; }

sum_cpu() { ps -C "$1" -o %cpu= 2>/dev/null | awk '{s+=$1} END{printf "%.0f", s+0}'; }

echo "ts,cores,load1,cpu_used_pct,mem_used_mb,mem_total_mb,freeswitch_cpu,sfu_cpu,jvm_cpu,meetings,users,videos,voice" > "$OUT"
echo "Logging -> $OUT  every ${INTERVAL}s  (cores=$CORES, 70% line = $(awk "BEGIN{printf \"%.0f\",$CORES*70}")% of one core-sum). Ctrl-C to stop."
[ -z "$SECRET" ] && echo "WARN: no BBB secret resolved — meeting/user counts will be 0."

while true; do
    ts="$(date +%FT%T)"
    load1="$(cut -d' ' -f1 /proc/loadavg)"
    cpu_idle="$(top -bn1 2>/dev/null | awk '/^%Cpu|Cpu\(s\)/{for(i=1;i<=NF;i++) if($i ~ /id,?$/){gsub(/[^0-9.]/,"",$(i-1)); print $(i-1); exit}}')"
    cpu_used="$(awk "BEGIN{printf \"%.1f\", 100-(${cpu_idle:-0})}")"
    mem_total="$(awk '/MemTotal/{printf "%.0f",$2/1024}' /proc/meminfo)"
    mem_avail="$(awk '/MemAvailable/{printf "%.0f",$2/1024}' /proc/meminfo)"
    mem_used="$(( mem_total - mem_avail ))"
    fs="$(sum_cpu freeswitch)"
    sfu="$(sum_cpu node)"      # bbb-webrtc-sfu + mediasoup workers run under node
    jvm="$(sum_cpu java)"      # bbb-apps-akka / bbb-web / fsesl-akka

    meetings=0; users=0; videos=0; voice=0
    if [ -n "$SECRET" ]; then
        xml="$(curl -s --max-time 5 "https://${DOMAIN}/bigbluebutton/api/getMeetings?checksum=$(gm_checksum)" 2>/dev/null)"
        meetings="$(grep -oc '<meetingID>' <<<"$xml" 2>/dev/null || echo 0)"
        users="$(grep -oP '<participantCount>\K[0-9]+' <<<"$xml" | awk '{s+=$1} END{print s+0}')"
        videos="$(grep -oP '<videoCount>\K[0-9]+' <<<"$xml" | awk '{s+=$1} END{print s+0}')"
        voice="$(grep -oP '<voiceParticipantCount>\K[0-9]+' <<<"$xml" | awk '{s+=$1} END{print s+0}')"
    fi

    echo "$ts,$CORES,$load1,$cpu_used,$mem_used,$mem_total,$fs,$sfu,$jvm,$meetings,$users,$videos,$voice" >> "$OUT"

    warn=""
    awk "BEGIN{exit !((${cpu_used:-0}) > 70)}" && warn="   ** CPU > 70% **"
    printf "%s load=%-5s cpu=%5s%% mem=%s/%sMB | fs=%s sfu=%s jvm=%s | meetings=%s users=%s vid=%s voice=%s%s\n" \
        "$ts" "$load1" "$cpu_used" "$mem_used" "$mem_total" "$fs" "$sfu" "$jvm" "$meetings" "$users" "$videos" "$voice" "$warn"

    sleep "$INTERVAL"
done
