#!/usr/bin/env bash
# =============================================================================
# setup-pgbackrest.sh
# -----------------------------------------------------------------------------
# Configure pgBackRest on db-primary (10.0.0.4 / 5.223.55.54) with an S3
# repository backed by Hetzner Object Storage.
#
# RUN ON: db-primary, as root.
#
# Idempotent: re-running will not break existing state. Where a step has
# already been performed, the script logs and continues.
#
# History note: this script previously generated an SFTP repo against a
# Hetzner Storage Box. That path was abandoned on 2026-06-03 because pgBackRest
# 2.58's P00 orchestrator keeps an SFTP session idle for the full duration of
# a backup upload (30-90 min) and Storage Box silently kills idle SFTP
# sessions around 30 min in, which deterministically broke backup_label.zst
# at the end of every full backup (libssh2 -43 / LIBSSH2_ERROR_SOCKET_RECV).
# Object Storage uses HTTPS with fresh connections per PUT/GET so there is no
# persistent session to die. See memory/pgbackrest-sftp-libssh2-43-bug.md if
# anyone is ever tempted to try SFTP again.
#
# Conventions (see CLAUDE.md / migration plan):
#   - Postgres 16.14, data dir /var/lib/postgresql/16/main
#   - Stanza name:           vacademy-prod
#   - Retention:             full=90d (time-based) / diff=28 / WAL pegged to diff
#                            (gives ~90 days of PITR while bounding WAL growth)
#   - Cipher:                aes-256-cbc (passphrase persisted in secrets file)
#   - Compression:           zstd level 3
#   - Schedules:             daily full @ 02:00 UTC, diff every 6h
#   - Repo path in bucket:   /vacademy-prod
# =============================================================================

set -euo pipefail

# ---------------------------------------------------------------------------
# Logging helpers
# ---------------------------------------------------------------------------
log_info() { printf '\033[36m[INFO]\033[0m  %s\n' "$*"; }
log_ok()   { printf '\033[32m[ OK ]\033[0m  %s\n' "$*"; }
log_warn() { printf '\033[33m[WARN]\033[0m  %s\n' "$*"; }
log_err()  { printf '\033[31m[ERR ]\033[0m  %s\n' "$*" >&2; }

trap 'log_err "Failed at line $LINENO. Aborting."' ERR

# ---------------------------------------------------------------------------
# Preconditions
# ---------------------------------------------------------------------------
if [[ $EUID -ne 0 ]]; then
  log_err "Must run as root."
  exit 1
fi

WORK_DIR="/root/vacademy-migration"
TOPOLOGY_ENV="${WORK_DIR}/topology.env"
SECRETS_FILE="${WORK_DIR}/pgbackrest-secrets.env"

mkdir -p "${WORK_DIR}"
chmod 700 "${WORK_DIR}"

if [[ ! -f "${TOPOLOGY_ENV}" ]]; then
  log_err "Missing topology env file at ${TOPOLOGY_ENV}"
  log_err "Create it first (DB_PRIMARY_PRIVATE, STORAGE_S3_BUCKET, STORAGE_S3_ENDPOINT, STORAGE_S3_REGION, STORAGE_S3_ACCESS_KEY, STORAGE_S3_SECRET_KEY, ...)"
  exit 1
fi

# shellcheck disable=SC1090
source "${TOPOLOGY_ENV}"

: "${STORAGE_S3_BUCKET:?STORAGE_S3_BUCKET must be set in topology.env (e.g. vacademy-prod)}"
: "${STORAGE_S3_ENDPOINT:?STORAGE_S3_ENDPOINT must be set in topology.env (e.g. fsn1.your-objectstorage.com)}"
: "${STORAGE_S3_REGION:?STORAGE_S3_REGION must be set in topology.env (e.g. fsn1)}"
: "${STORAGE_S3_ACCESS_KEY:?STORAGE_S3_ACCESS_KEY must be set in topology.env}"
: "${STORAGE_S3_SECRET_KEY:?STORAGE_S3_SECRET_KEY must be set in topology.env}"

log_info "Topology loaded:"
log_info "  STORAGE_S3_BUCKET   = ${STORAGE_S3_BUCKET}"
log_info "  STORAGE_S3_ENDPOINT = ${STORAGE_S3_ENDPOINT}"
log_info "  STORAGE_S3_REGION   = ${STORAGE_S3_REGION}"
log_info "  STORAGE_S3_ACCESS_KEY = ${STORAGE_S3_ACCESS_KEY:0:4}... (redacted)"

# ---------------------------------------------------------------------------
# Constants
# ---------------------------------------------------------------------------
PG_VERSION="16"
PG_DATA_DIR="/var/lib/postgresql/${PG_VERSION}/main"
PG_CONF="/etc/postgresql/${PG_VERSION}/main/postgresql.conf"
STANZA="vacademy-prod"
REPO_PATH="/vacademy-prod"
PGBR_CONF_DIR="/etc/pgbackrest"
PGBR_CONF="${PGBR_CONF_DIR}/pgbackrest.conf"
PGBR_LOG_DIR="/var/log/pgbackrest"

# ---------------------------------------------------------------------------
# Step 1: apt install pgbackrest
# ---------------------------------------------------------------------------
log_info "Step 1/10: Installing pgbackrest."

export DEBIAN_FRONTEND=noninteractive
apt-get update -y >/dev/null
apt-get install -y pgbackrest ca-certificates >/dev/null

PGBR_VERSION="$(pgbackrest version 2>/dev/null || echo 'unknown')"
log_ok "pgbackrest installed (${PGBR_VERSION})."

# pgBackRest log + lock dirs (the deb package usually creates these, but be safe).
mkdir -p "${PGBR_LOG_DIR}" /var/lib/pgbackrest /var/spool/pgbackrest
chown -R postgres:postgres "${PGBR_LOG_DIR}" /var/lib/pgbackrest /var/spool/pgbackrest
chmod 750 "${PGBR_LOG_DIR}" /var/lib/pgbackrest /var/spool/pgbackrest

# ---------------------------------------------------------------------------
# Step 2: cipher passphrase (persisted in secrets file)
# ---------------------------------------------------------------------------
log_info "Step 2/10: Resolving cipher passphrase."

if [[ -f "${SECRETS_FILE}" ]]; then
  # shellcheck disable=SC1090
  source "${SECRETS_FILE}"
fi

if [[ -z "${PGBACKREST_CIPHER_PASS:-}" ]]; then
  log_info "  No existing cipher pass found, generating a new one (64 bytes, hex)."
  PGBACKREST_CIPHER_PASS="$(openssl rand -hex 48)"
fi
log_ok "  Cipher passphrase ready (length: ${#PGBACKREST_CIPHER_PASS})."

# CRITICAL: persist the cipher pass to disk IMMEDIATELY, before any operation
# that could fail (stanza-create, first backup, etc.). If we delay this until
# the end of the script and any intermediate step fails, a re-run would
# generate a NEW pass and the original encrypted backup becomes unrecoverable.
umask 077
cat >"${SECRETS_FILE}" <<EOF
# Managed by setup-pgbackrest.sh - DO NOT COMMIT THIS FILE.
# This file is rewritten on every run; the cipher pass is persisted here
# FIRST (before stanza-create / first backup) so that a partial failure
# does not orphan an encrypted backup in Object Storage.
PGBACKREST_CIPHER_PASS='${PGBACKREST_CIPHER_PASS}'
EOF
chmod 600 "${SECRETS_FILE}"
chown root:root "${SECRETS_FILE}"
umask 022
log_ok "  Cipher passphrase persisted to ${SECRETS_FILE}."

# ---------------------------------------------------------------------------
# Step 3: Write /etc/pgbackrest/pgbackrest.conf
# ---------------------------------------------------------------------------
log_info "Step 3/10: Writing ${PGBR_CONF}."

install -d -m 750 -o postgres -g postgres "${PGBR_CONF_DIR}"

# Backup existing config (once) so the operator can diff after re-runs.
if [[ -f "${PGBR_CONF}" && ! -f "${PGBR_CONF}.orig" ]]; then
  cp -a "${PGBR_CONF}" "${PGBR_CONF}.orig"
fi

cat >"${PGBR_CONF}" <<EOF
# Managed by setup-pgbackrest.sh - do not edit by hand.
# Re-run setup-pgbackrest.sh to regenerate.

[global]
repo1-type=s3
repo1-s3-bucket=${STORAGE_S3_BUCKET}
repo1-s3-endpoint=${STORAGE_S3_ENDPOINT}
repo1-s3-region=${STORAGE_S3_REGION}
repo1-s3-key=${STORAGE_S3_ACCESS_KEY}
repo1-s3-key-secret=${STORAGE_S3_SECRET_KEY}
repo1-s3-uri-style=path
repo1-storage-verify-tls=y
repo1-path=${REPO_PATH}
# Retention policy (must match the convention documented in CLAUDE.md):
#   - Keep all full backups taken in the last 90 days (time-based, NOT count-based).
#     With time-based full retention, WAL needed to restore any full in that
#     window is kept, giving genuine 90-day PITR.
#   - Keep 28 diff backups (covers ~7 days at 4 diffs/day).
#   - WAL archive retention pegged to diff backups so PITR works between fulls.
repo1-retention-full=90
repo1-retention-full-type=time
repo1-retention-diff=28
repo1-retention-archive=28
repo1-retention-archive-type=diff
repo1-cipher-type=aes-256-cbc
repo1-cipher-pass=${PGBACKREST_CIPHER_PASS}

log-level-console=info
log-level-file=detail
log-path=${PGBR_LOG_DIR}

# process-max=4: S3 uses fresh HTTPS connections per object, so we can safely
# parallelise uploads. (Under the old SFTP repo we'd tried process-max=1 to
# work around the idle-session bug — irrelevant here.)
process-max=4
compress-type=zstd
compress-level=3

start-fast=y
delta=y

[${STANZA}]
pg1-path=${PG_DATA_DIR}
pg1-port=5432
pg1-user=postgres
EOF

chown postgres:postgres "${PGBR_CONF}"
chmod 640 "${PGBR_CONF}"
log_ok "  Wrote ${PGBR_CONF}."

# ---------------------------------------------------------------------------
# Step 4: Update postgresql.conf for WAL archiving
# ---------------------------------------------------------------------------
log_info "Step 4/10: Configuring archive_mode / archive_command in postgresql.conf."

if [[ ! -f "${PG_CONF}" ]]; then
  log_err "Postgres config not found at ${PG_CONF}. Is Postgres ${PG_VERSION} installed?"
  exit 1
fi

# Backup once
if [[ ! -f "${PG_CONF}.pre-pgbackrest" ]]; then
  cp -a "${PG_CONF}" "${PG_CONF}.pre-pgbackrest"
fi

# Helper to set or replace a key=value in postgresql.conf.
# Only rewrites the line if the *active* setting differs from the desired
# value, so a re-run with no real changes leaves the file (and Postgres) alone.
pg_set_conf() {
  local key="$1"
  local val="$2"
  local current=""
  # Read currently active (uncommented) value, if any. Strip surrounding
  # whitespace, inline '#' comments, and any single-quotes used for strings.
  current="$(grep -E "^[[:space:]]*${key}[[:space:]]*=" "${PG_CONF}" 2>/dev/null \
              | tail -n1 \
              | sed -E "s/^[[:space:]]*${key}[[:space:]]*=[[:space:]]*//" \
              | sed -E 's/[[:space:]]*#.*$//' \
              | sed -E "s/^'(.*)'$/\1/" \
              || true)"
  local desired
  desired="$(printf '%s' "${val}" | sed -E "s/^'(.*)'$/\1/")"
  if [[ "${current}" == "${desired}" ]]; then
    return 0
  fi
  # Strip any existing (commented or active) lines for the key, then append.
  sed -i -E "/^[[:space:]]*#?[[:space:]]*${key}[[:space:]]*=.*$/d" "${PG_CONF}"
  printf '%s = %s\n' "${key}" "${val}" >> "${PG_CONF}"
  PG_CONF_CHANGED=1
}

PG_CONF_CHANGED=0

# wal_level must be replica or higher; archive_mode for archiving.
# IMPORTANT: archive_command is intentionally left as '/bin/true' here.
# The stanza does not exist in Object Storage yet (Step 5 creates it).
# If we set the real pgbackrest archive_command now, every WAL archive
# attempt would fail until Step 5 succeeds, pinning WAL in pg_wal and
# polluting the postgres log. We promote archive_command to the real
# command after Step 5 (a SIGHUP reload, not a restart).
# max_wal_senders left untouched here (the replication setup script owns it).
pg_set_conf "archive_mode" "on"
pg_set_conf "archive_command" "'/bin/true'"
pg_set_conf "archive_timeout" "60"

# Ensure wal_level >= replica (idempotent: only set if currently lower / unset).
CURRENT_WAL_LEVEL="$(sudo -u postgres psql -tAc 'SHOW wal_level' 2>/dev/null || echo '')"
if [[ "${CURRENT_WAL_LEVEL}" != "replica" && "${CURRENT_WAL_LEVEL}" != "logical" ]]; then
  pg_set_conf "wal_level" "replica"
  WAL_LEVEL_CHANGED=1
else
  WAL_LEVEL_CHANGED=0
fi

log_ok "  postgresql.conf updated."

# Decide whether we actually need a full restart. archive_mode and wal_level
# are PGC_POSTMASTER (restart-only); archive_command and archive_timeout are
# SIGHUP-reloadable. A re-run with no postmaster-level changes must NOT
# restart Postgres — that would drop every client + replica connection.
NEEDS_RESTART=0
CURRENT_ARCHIVE_MODE="$(sudo -u postgres psql -tAc 'SHOW archive_mode' 2>/dev/null || echo '')"
if [[ "${CURRENT_ARCHIVE_MODE}" != "on" ]]; then
  NEEDS_RESTART=1
fi
if [[ "${WAL_LEVEL_CHANGED}" == "1" ]]; then
  NEEDS_RESTART=1
fi

if [[ "${NEEDS_RESTART}" == "1" ]]; then
  log_warn "  Restarting postgresql@${PG_VERSION}-main (archive_mode/wal_level changed)."
  log_warn "  This will drop all client and replica connections."
  systemctl restart "postgresql@${PG_VERSION}-main"

  # Wait for postgres to come back.
  for i in 1 2 3 4 5 6 7 8 9 10; do
    if sudo -u postgres psql -tAc 'SELECT 1' >/dev/null 2>&1; then
      break
    fi
    sleep 1
    if [[ $i -eq 10 ]]; then
      log_err "Postgres did not come back online after restart."
      exit 1
    fi
  done
  log_ok "  Postgres is up."
elif [[ "${PG_CONF_CHANGED}" == "1" ]]; then
  log_info "  archive_mode/wal_level unchanged; reloading postgres (no restart needed)."
  systemctl reload "postgresql@${PG_VERSION}-main"
  log_ok "  Postgres config reloaded."
else
  log_ok "  postgresql.conf already in desired state; no reload/restart needed."
fi

# ---------------------------------------------------------------------------
# Step 5: stanza-create
# ---------------------------------------------------------------------------
log_info "Step 5/10: Creating stanza ${STANZA} (idempotent)."

# stanza-create is safe to re-run; pgBackRest will detect an existing stanza
# and exit zero. We still tee output for the operator.
if sudo -u postgres pgbackrest --stanza="${STANZA}" stanza-create 2>&1 | tee -a "${WORK_DIR}/pgbackrest-setup.log"; then
  log_ok "  Stanza ready."
else
  log_err "stanza-create failed. Most common causes:"
  log_err "  - STORAGE_S3_ACCESS_KEY / STORAGE_S3_SECRET_KEY are wrong or lack write perms on s3://${STORAGE_S3_BUCKET}."
  log_err "  - STORAGE_S3_ENDPOINT / STORAGE_S3_REGION mismatch for the bucket's location."
  log_err "  - repo1-cipher-pass changed across runs (use the same one!)."
  log_err "  - The bucket s3://${STORAGE_S3_BUCKET} does not exist yet — create it in the Hetzner Object Storage console."
  exit 1
fi

# Now that the stanza exists in Object Storage, promote archive_command from
# the temporary '/bin/true' (set in Step 4) to the real pgbackrest archive
# pusher. archive_command is SIGHUP-reloadable, so this does NOT require a
# Postgres restart.
DESIRED_ARCHIVE_CMD="'pgbackrest --stanza=${STANZA} archive-push %p'"
PG_CONF_CHANGED=0
pg_set_conf "archive_command" "${DESIRED_ARCHIVE_CMD}"
if [[ "${PG_CONF_CHANGED}" == "1" ]]; then
  log_info "  Promoting archive_command to pgbackrest archive-push (reload, not restart)."
  systemctl reload "postgresql@${PG_VERSION}-main"
  log_ok "  Postgres reloaded; WAL archiving is now active."
else
  log_ok "  archive_command already points at pgbackrest archive-push."
fi

# ---------------------------------------------------------------------------
# Step 6: check
# ---------------------------------------------------------------------------
log_info "Step 6/10: Running pgbackrest check."

sudo -u postgres pgbackrest --stanza="${STANZA}" check 2>&1 | tee -a "${WORK_DIR}/pgbackrest-setup.log"
log_ok "  Check passed - WAL archiving is wired up correctly."

# ---------------------------------------------------------------------------
# Step 7: First full backup
# ---------------------------------------------------------------------------
log_info "Step 7/10: Taking initial full backup (this can take a while)."

# Only force-take a full backup if we don't already have one.
EXISTING_FULL="$(sudo -u postgres pgbackrest --stanza="${STANZA}" --output=json info 2>/dev/null \
  | grep -oE '"type":"full"' | head -n1 || true)"

if [[ -z "${EXISTING_FULL}" ]]; then
  sudo -u postgres pgbackrest --stanza="${STANZA}" --type=full backup 2>&1 | tee -a "${WORK_DIR}/pgbackrest-setup.log"
  log_ok "  Initial full backup complete."
else
  log_ok "  A full backup already exists - skipping initial backup."
fi

# ---------------------------------------------------------------------------
# Step 8: systemd timers (daily full @ 02:00 UTC, diff every 6h)
# ---------------------------------------------------------------------------
log_info "Step 8/10: Installing systemd units for scheduled backups."

cat >/etc/systemd/system/pgbackrest-full.service <<EOF
[Unit]
Description=pgBackRest full backup (stanza=${STANZA})
After=network-online.target postgresql.service
Wants=network-online.target

[Service]
Type=oneshot
User=postgres
Group=postgres
ExecStart=/usr/bin/pgbackrest --stanza=${STANZA} --type=full backup
Nice=10
IOSchedulingClass=best-effort
IOSchedulingPriority=7
EOF

cat >/etc/systemd/system/pgbackrest-full.timer <<EOF
[Unit]
Description=Daily pgBackRest full backup at 02:00 UTC

[Timer]
OnCalendar=*-*-* 02:00:00 UTC
Persistent=true
RandomizedDelaySec=300
Unit=pgbackrest-full.service

[Install]
WantedBy=timers.target
EOF

cat >/etc/systemd/system/pgbackrest-diff.service <<EOF
[Unit]
Description=pgBackRest differential backup (stanza=${STANZA})
After=network-online.target postgresql.service
Wants=network-online.target

[Service]
Type=oneshot
User=postgres
Group=postgres
ExecStart=/usr/bin/pgbackrest --stanza=${STANZA} --type=diff backup
Nice=10
IOSchedulingClass=best-effort
IOSchedulingPriority=7
EOF

cat >/etc/systemd/system/pgbackrest-diff.timer <<EOF
[Unit]
Description=pgBackRest differential backup every 6h

[Timer]
# 00:00, 06:00, 12:00, 18:00 UTC. Skip the 00:00 slot because the full
# backup at 02:00 UTC covers the early-morning window.
OnCalendar=*-*-* 06,12,18:00:00 UTC
Persistent=true
RandomizedDelaySec=300
Unit=pgbackrest-diff.service

[Install]
WantedBy=timers.target
EOF

systemctl daemon-reload
systemctl enable --now pgbackrest-full.timer >/dev/null
systemctl enable --now pgbackrest-diff.timer >/dev/null

log_ok "  Timers enabled:"
systemctl list-timers --all --no-pager | grep -E 'pgbackrest-(full|diff)' || true

# ---------------------------------------------------------------------------
# Step 9: Append non-critical metadata to the secrets file.
# The cipher pass was already persisted in Step 2 (BEFORE any operation that
# could fail). Here we only append the additional metadata fields. We use
# '>>' to avoid clobbering the cipher pass written early. S3 access/secret
# keys are deliberately NOT persisted here — they live in topology.env which
# is already mode 600 on this host. Duplicating them would just multiply
# blast radius.
# ---------------------------------------------------------------------------
log_info "Step 9/10: Appending metadata to ${SECRETS_FILE} (mode 600)."

# Strip any previously-appended metadata block so this step is idempotent:
# remove everything after the marker line, then re-append fresh metadata.
METADATA_MARKER="# --- metadata (appended by Step 9) ---"
if grep -qF "${METADATA_MARKER}" "${SECRETS_FILE}" 2>/dev/null; then
  # Keep only the lines BEFORE the marker.
  sed -i "/^${METADATA_MARKER}$/,\$d" "${SECRETS_FILE}"
fi

umask 077
cat >>"${SECRETS_FILE}" <<EOF
${METADATA_MARKER}
STORAGE_S3_BUCKET='${STORAGE_S3_BUCKET}'
STORAGE_S3_ENDPOINT='${STORAGE_S3_ENDPOINT}'
STORAGE_S3_REGION='${STORAGE_S3_REGION}'
PGBACKREST_STANZA='${STANZA}'
PGBACKREST_REPO_PATH='${REPO_PATH}'
EOF
chmod 600 "${SECRETS_FILE}"
chown root:root "${SECRETS_FILE}"
umask 022

log_ok "  Secrets saved."

# ---------------------------------------------------------------------------
# Step 10: Summary
# ---------------------------------------------------------------------------
echo
log_ok "============================================================"
log_ok "  pgBackRest is configured on db-primary."
log_ok "  Stanza:      ${STANZA}"
log_ok "  Repo:        s3://${STORAGE_S3_BUCKET}${REPO_PATH} (${STORAGE_S3_ENDPOINT}, region=${STORAGE_S3_REGION})"
log_ok "  Compression: zstd-3   Cipher: aes-256-cbc   process-max: 4"
log_ok "  Retention:   fulls kept 90 days (time-based) / 28 diffs / WAL pegged to diffs"
log_ok "  Timers:      pgbackrest-full.timer (02:00 UTC daily)"
log_ok "               pgbackrest-diff.timer (06, 12, 18 UTC)"
log_ok "============================================================"
echo
log_info "Quick health check commands:"
echo "  sudo -u postgres pgbackrest --stanza=${STANZA} info"
echo "  sudo -u postgres pgbackrest --stanza=${STANZA} check"
echo
log_info "Restore-test command (DO NOT run against the live data dir):"
echo "  sudo -u postgres pgbackrest --stanza=${STANZA} \\"
echo "      --pg1-path=/var/lib/postgresql/${PG_VERSION}/restore-test \\"
echo "      --delta restore"
echo "  # then start a throwaway postgres against /var/lib/postgresql/${PG_VERSION}/restore-test"
echo "  # and verify pg_isready + a SELECT count(*) on a known table."
echo
log_ok "NEXT STEP: deploy the chart with values-prod-hetzner.yaml."
