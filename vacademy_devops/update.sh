#!/usr/bin/env bash
#
# Upgrade a standalone Vacademy install to a new release.
#
# Pulls the chart's pinned image tags (set per release) and re-applies. The
# baseline-load Job is idempotent and only loads schema into EMPTY databases, so
# existing data is never touched; new Flyway migrations in the images apply on boot.
#
# Usage:  sudo ./update.sh [image-tag]
#   image-tag  optional — override every service/frontend image tag (default: the
#              tag pinned in values.yaml). Use a release tag, never "latest", for
#              determinism.
set -euo pipefail

HERE="$(cd "$(dirname "$0")" && pwd)"
CHART="$HERE/vacademy-services"
SECRET_FILE="$CHART/values.secret.yaml"
RELEASE="vacademy"
export KUBECONFIG="${KUBECONFIG:-/etc/rancher/k3s/k3s.yaml}"
TAG="${1:-}"

[ -f "$SECRET_FILE" ] || { echo "No values.secret.yaml found — run install.sh first." >&2; exit 1; }

EXTRA=()
if [ -n "$TAG" ]; then
  echo "Pinning all images to tag: $TAG"
  for s in auth_service admin_core_service media_service assessment_service community_service notification_service ai_service; do
    EXTRA+=(--set "services.${s}.image.tag=${TAG}")
  done
  EXTRA+=(--set "frontends.admin.image.tag=${TAG}" --set "frontends.learner.image.tag=${TAG}")
fi

echo "Backing up databases before upgrade..."
"$HERE/backup.sh" || echo "(backup script not found or failed — continuing)"

helm upgrade "$RELEASE" "$CHART" \
  -f "$CHART/values.yaml" \
  -f "$CHART/values-standalone.yaml" \
  -f "$SECRET_FILE" \
  "${EXTRA[@]}" \
  --wait --timeout 15m

echo "Upgrade complete. Watch rollout: kubectl get pods -w"
