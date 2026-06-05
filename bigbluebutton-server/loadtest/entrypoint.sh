#!/usr/bin/env bash
# Render bbb-stress-test's .env from container env vars, then run the stress test.
# Each pod simulates (LISTEN_ONLY + MIC + WEBCAM) clients against ONE meeting.
# Scale total users by running this as a k8s Job with parallelism=N pods.
set -euo pipefail

cat > .env <<EOF
BBB_URL=${BBB_URL:?set BBB_URL (e.g. https://meet-test.vacademy.io/bigbluebutton/)}
BBB_SECRET=${BBB_SECRET:?set BBB_SECRET}
BBB_MEETING_ID=${BBB_MEETING_ID:?set BBB_MEETING_ID (create it first with join_storm.py create)}
BBB_CLIENTS_LISTEN_ONLY=${BBB_CLIENTS_LISTEN_ONLY:-0}
BBB_CLIENTS_MIC=${BBB_CLIENTS_MIC:-0}
BBB_CLIENTS_WEBCAM=${BBB_CLIENTS_WEBCAM:-0}
BBB_TEST_DURATION=${BBB_TEST_DURATION:-600}
EOF

echo "[entrypoint] pod config (secret masked):"
sed 's/BBB_SECRET=.*/BBB_SECRET=***masked***/' .env

# Chrome in containers needs a roomy /dev/shm or --disable-dev-shm-usage; the
# k8s manifest mounts an emptyDir at /dev/shm. `make stress` is the upstream
# entry target — adjust if the repo renames it.
exec make stress
