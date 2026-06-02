#!/usr/bin/env bash
# ──────────────────────────────────────────────────────────────
# Deploy render worker to the k3s cluster — thin wrapper around
# the GitHub Actions workflow .github/workflows/docker-publish-render-worker.yml
#
# The actual build + push + rollout happens on a GitHub-hosted runner. This
# script just triggers it (and tails it so you can see live logs).
#
# Why a GH Action instead of a local script:
#   - There is no longer a dedicated build host (157.90.162.154 was removed).
#   - GH runners are linux/amd64 with docker preinstalled (fast, free).
#   - Audit trail of every deploy in Actions UI.
#   - No PATs / secrets sitting on engineers' laptops.
#
# Usage:
#   cd vacademy_platform/ai_service && bash render_worker/deploy.sh
#
# Prereqs (one-time):
#   - `gh` CLI installed and authenticated (`gh auth status` should be green)
#   - You must be on a branch that is pushed to origin so workflow_dispatch can
#     find it; or just deploy from main (recommended for production).
#
# What it does:
#   1. Confirms you have `gh` and you're authenticated.
#   2. Triggers .github/workflows/docker-publish-render-worker.yml on the
#      current branch (or main if you pass --main).
#   3. Watches the latest run until it succeeds or fails.
#
# To trigger without watching:
#   gh workflow run docker-publish-render-worker.yml --ref main
#
# To roll back (any laptop with kubectl access to k3s):
#   kubectl -n default rollout undo deployment/render-worker         # one step back
#   kubectl -n default set image deployment/render-worker \
#     render-worker=ghcr.io/vacademy-io/render-worker:<OLD_TAG>      # specific tag
#   kubectl -n default rollout history deployment/render-worker     # see prior tags
# ──────────────────────────────────────────────────────────────
set -euo pipefail

WORKFLOW_FILE="docker-publish-render-worker.yml"
USE_MAIN=0

for arg in "$@"; do
    case "$arg" in
        --main) USE_MAIN=1 ;;
        -h|--help)
            sed -n '1,40p' "$0"
            exit 0
            ;;
        *) echo "unknown flag: $arg" >&2; exit 2 ;;
    esac
done

if ! command -v gh >/dev/null 2>&1; then
    echo "✗ gh CLI not installed. Install: brew install gh   (or visit https://cli.github.com/)"
    exit 1
fi

if ! gh auth status >/dev/null 2>&1; then
    echo "✗ gh not authenticated. Run: gh auth login"
    exit 1
fi

if [ "$USE_MAIN" = "1" ]; then
    REF="main"
else
    REF="$(git rev-parse --abbrev-ref HEAD)"
fi

echo "════════════════════════════════════════════════════════════"
echo "  Triggering: $WORKFLOW_FILE"
echo "  Ref:        $REF"
echo "════════════════════════════════════════════════════════════"

gh workflow run "$WORKFLOW_FILE" --ref "$REF"

# Brief pause for the run to be registered, then attach to it.
sleep 3
RUN_ID="$(gh run list --workflow="$WORKFLOW_FILE" --limit=1 --json databaseId -q '.[0].databaseId')"

echo ""
echo "▶ Watching run $RUN_ID — Ctrl-C to detach (the run keeps going)."
echo ""

gh run watch "$RUN_ID" --exit-status

echo ""
echo "════════════════════════════════════════════════════════════"
echo "  ✓ Deploy complete. See Actions UI for full logs:"
echo "    https://github.com/Vacademy-io/vacademy_platform/actions/runs/$RUN_ID"
echo "════════════════════════════════════════════════════════════"
