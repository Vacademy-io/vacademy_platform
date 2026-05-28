#!/usr/bin/env bash
#
# Back up the bundled Postgres databases of a standalone install.
# Runs pg_dump inside the postgres pod for each service DB and copies the dumps
# to ./backups/<timestamp>/ on this host. Schedule via cron for regular backups:
#   0 2 * * *  /path/to/vacademy_devops/backup.sh >> /var/log/vacademy-backup.log 2>&1
set -euo pipefail

HERE="$(cd "$(dirname "$0")" && pwd)"
export KUBECONFIG="${KUBECONFIG:-/etc/rancher/k3s/k3s.yaml}"
OUT="$HERE/backups/$(date -u +%Y%m%d-%H%M%S)"
DBS="auth_service admin_core_service assessment_service media_service notification_service"

POD=$(kubectl get pod -l app=postgres -o jsonpath='{.items[0].metadata.name}' 2>/dev/null) \
  || { echo "No bundled postgres pod found (managed DB? back it up at the provider)."; exit 1; }

mkdir -p "$OUT"
for db in $DBS; do
  echo "dumping $db ..."
  kubectl exec "$POD" -- sh -c "PGPASSWORD=\$POSTGRES_PASSWORD pg_dump -U \$POSTGRES_USER -d $db" \
    | gzip > "$OUT/$db.sql.gz"
done
echo "Backups written to $OUT"
# Retention: keep the 14 most recent backup dirs.
ls -1dt "$HERE"/backups/*/ 2>/dev/null | tail -n +15 | xargs -r rm -rf
