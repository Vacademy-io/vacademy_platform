#!/usr/bin/env bash
# =============================================================================
# setup-pgbackrest.sh
# -----------------------------------------------------------------------------
# Configure pgBackRest on db-primary (10.0.0.4 / 5.223.55.54) with an SFTP
# repository backed by a Hetzner Storage Box.
#
# RUN ON: db-primary, as root.
#
# Idempotent: re-running will not break existing state. Where a step has
# already been performed, the script logs and continues.
#
# Conventions (see CLAUDE.md / migration plan):
#   - Postgres 16.14, data dir /var/lib/postgresql/16/main
#   - Stanza name:           vacademy-prod
#   - Retention:             full=90d (time-based) / diff=28 / WAL pegged to diff
#                            (gives ~90 days of PITR while bounding WAL growth)
#   - Cipher:                aes-256-cbc (passphrase persisted in secrets file)
#   - Compression:           zstd level 3
#   - Schedules:             daily full @ 02:00 UTC, diff every 6h
#   - Repo path on storage:  /vacademy-prod
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
  log_err "Create it first (DB_PRIMARY_PRIVATE, STORAGE_BOX_HOST, STORAGE_BOX_USER, STORAGE_BOX_PASS, ...)"
  exit 1
fi

# shellcheck disable=SC1090
source "${TOPOLOGY_ENV}"

: "${STORAGE_BOX_HOST:?STORAGE_BOX_HOST must be set in topology.env}"
: "${STORAGE_BOX_USER:?STORAGE_BOX_USER must be set in topology.env}"
# STORAGE_BOX_PASS is not used by pgBackRest (we use SSH key auth) - leave optional.
STORAGE_BOX_PASS="${STORAGE_BOX_PASS:-}"

log_info "Topology loaded:"
log_info "  STORAGE_BOX_HOST = ${STORAGE_BOX_HOST}"
log_info "  STORAGE_BOX_USER = ${STORAGE_BOX_USER}"

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
POSTGRES_HOME="$(getent passwd postgres | cut -d: -f6)"
POSTGRES_SSH_DIR="${POSTGRES_HOME}/.ssh"
POSTGRES_SSH_KEY="${POSTGRES_SSH_DIR}/id_ed25519"

# ---------------------------------------------------------------------------
# Step 1: apt install pgbackrest
# ---------------------------------------------------------------------------
log_info "Step 1/11: Installing pgbackrest (and ssh-client utilities)."

export DEBIAN_FRONTEND=noninteractive
apt-get update -y >/dev/null
apt-get install -y pgbackrest openssh-client ca-certificates >/dev/null

PGBR_VERSION="$(pgbackrest version 2>/dev/null || echo 'unknown')"
log_ok "pgbackrest installed (${PGBR_VERSION})."

# pgBackRest log + lock dirs (the deb package usually creates these, but be safe).
mkdir -p "${PGBR_LOG_DIR}" /var/lib/pgbackrest /var/spool/pgbackrest
chown -R postgres:postgres "${PGBR_LOG_DIR}" /var/lib/pgbackrest /var/spool/pgbackrest
chmod 750 "${PGBR_LOG_DIR}" /var/lib/pgbackrest /var/spool/pgbackrest

# ---------------------------------------------------------------------------
# Step 2: postgres user SSH key (needed for SFTP auth to Storage Box)
# ---------------------------------------------------------------------------
log_info "Step 2/11: Ensuring SSH key exists for the postgres OS user."

install -d -m 700 -o postgres -g postgres "${POSTGRES_SSH_DIR}"

if [[ ! -f "${POSTGRES_SSH_KEY}" ]]; then
  log_info "  Generating new ed25519 keypair at ${POSTGRES_SSH_KEY}"
  sudo -u postgres ssh-keygen -t ed25519 -N "" -C "pgbackrest@db-primary" -f "${POSTGRES_SSH_KEY}" >/dev/null
  log_ok "  Generated."
else
  log_ok "  Existing key found at ${POSTGRES_SSH_KEY}, reusing."
fi

chown postgres:postgres "${POSTGRES_SSH_KEY}" "${POSTGRES_SSH_KEY}.pub"
chmod 600 "${POSTGRES_SSH_KEY}"
chmod 644 "${POSTGRES_SSH_KEY}.pub"

POSTGRES_PUBKEY_CONTENT="$(cat "${POSTGRES_SSH_KEY}.pub")"

# ---------------------------------------------------------------------------
# Step 3: ssh-keyscan the Storage Box and compute SHA256 fingerprint
# ---------------------------------------------------------------------------
log_info "Step 3/11: Capturing SSH host fingerprint for ${STORAGE_BOX_HOST}."

# Hetzner Storage Box listens for SFTP on port 23 as well as 22.
# Most accounts have 22 open. We try 22 first, then 23 as fallback.
KEYSCAN_TMP="$(mktemp)"
trap 'rm -f "${KEYSCAN_TMP}"' EXIT

if ssh-keyscan -t ed25519,rsa -T 10 -p 22 "${STORAGE_BOX_HOST}" >"${KEYSCAN_TMP}" 2>/dev/null && [[ -s "${KEYSCAN_TMP}" ]]; then
  SFTP_PORT=22
elif ssh-keyscan -t ed25519,rsa -T 10 -p 23 "${STORAGE_BOX_HOST}" >"${KEYSCAN_TMP}" 2>/dev/null && [[ -s "${KEYSCAN_TMP}" ]]; then
  SFTP_PORT=23
else
  log_err "ssh-keyscan failed for ${STORAGE_BOX_HOST} on both port 22 and 23."
  exit 1
fi

log_ok "  Got host keys from ${STORAGE_BOX_HOST}:${SFTP_PORT}"

# Prefer ed25519, fallback to rsa.
HOST_KEY_LINE="$(grep -E ' ssh-ed25519 ' "${KEYSCAN_TMP}" | head -n1 || true)"
if [[ -z "${HOST_KEY_LINE}" ]]; then
  HOST_KEY_LINE="$(grep -E ' ssh-rsa ' "${KEYSCAN_TMP}" | head -n1 || true)"
fi
if [[ -z "${HOST_KEY_LINE}" ]]; then
  log_err "Could not extract a usable host key from ssh-keyscan output."
  exit 1
fi

# pgBackRest expects the base64 portion of the host key, hashed with sha256.
# ssh-keygen -lf <file> -E sha256 prints: "<bits> SHA256:<base64hash> <comment> (<type>)"
HOST_FINGERPRINT="$(printf '%s\n' "${HOST_KEY_LINE}" | ssh-keygen -E sha256 -lf /dev/stdin | awk '{print $2}' | sed 's/^SHA256://')"
if [[ -z "${HOST_FINGERPRINT}" ]]; then
  log_err "Failed to derive SHA256 fingerprint."
  exit 1
fi
log_ok "  Fingerprint (sha256): ${HOST_FINGERPRINT}"

# Pin the host key in postgres's known_hosts so non-pgbackrest sftp/ssh
# attempts (e.g. operator restore-tests) also succeed without prompting.
KNOWN_HOSTS="${POSTGRES_SSH_DIR}/known_hosts"
touch "${KNOWN_HOSTS}"
chown postgres:postgres "${KNOWN_HOSTS}"
chmod 600 "${KNOWN_HOSTS}"
# Remove any stale entries for this host, then add the fresh ones.
sudo -u postgres ssh-keygen -R "${STORAGE_BOX_HOST}" -f "${KNOWN_HOSTS}" >/dev/null 2>&1 || true
sudo -u postgres ssh-keygen -R "[${STORAGE_BOX_HOST}]:${SFTP_PORT}" -f "${KNOWN_HOSTS}" >/dev/null 2>&1 || true
cat "${KEYSCAN_TMP}" >> "${KNOWN_HOSTS}"
chown postgres:postgres "${KNOWN_HOSTS}"

# ---------------------------------------------------------------------------
# Step 4: cipher passphrase (persisted in secrets file)
# ---------------------------------------------------------------------------
log_info "Step 4/11: Resolving cipher passphrase."

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
# does not orphan an encrypted backup on the Storage Box.
PGBACKREST_CIPHER_PASS='${PGBACKREST_CIPHER_PASS}'
EOF
chmod 600 "${SECRETS_FILE}"
chown root:root "${SECRETS_FILE}"
umask 022
log_ok "  Cipher passphrase persisted to ${SECRETS_FILE}."

# ---------------------------------------------------------------------------
# Step 5: Write /etc/pgbackrest/pgbackrest.conf
# ---------------------------------------------------------------------------
log_info "Step 5/11: Writing ${PGBR_CONF}."

install -d -m 750 -o postgres -g postgres "${PGBR_CONF_DIR}"

# Backup existing config (once) so the operator can diff after re-runs.
if [[ -f "${PGBR_CONF}" && ! -f "${PGBR_CONF}.orig" ]]; then
  cp -a "${PGBR_CONF}" "${PGBR_CONF}.orig"
fi

cat >"${PGBR_CONF}" <<EOF
# Managed by setup-pgbackrest.sh - do not edit by hand.
# Re-run setup-pgbackrest.sh to regenerate.

[global]
repo1-type=sftp
repo1-sftp-host=${STORAGE_BOX_HOST}
repo1-sftp-host-port=${SFTP_PORT}
repo1-sftp-user=${STORAGE_BOX_USER}
repo1-sftp-host-key-hash-type=sha256
repo1-sftp-host-fingerprint=${HOST_FINGERPRINT}
repo1-sftp-private-key-file=${POSTGRES_SSH_KEY}
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

process-max=2
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
# Step 6: Update postgresql.conf for WAL archiving
# ---------------------------------------------------------------------------
log_info "Step 6/11: Configuring archive_mode / archive_command in postgresql.conf."

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
# The stanza does not exist on the Storage Box yet (Step 7 creates it).
# If we set the real pgbackrest archive_command now, every WAL archive
# attempt would fail until Step 7 succeeds, pinning WAL in pg_wal and
# polluting the postgres log. We promote archive_command to the real
# command after Step 7 (a SIGHUP reload, not a restart).
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
# Step 7: stanza-create
# ---------------------------------------------------------------------------
log_info "Step 7/11: Creating stanza ${STANZA} (idempotent)."

# stanza-create is safe to re-run; pgBackRest will detect an existing stanza
# and exit zero. We still tee output for the operator.
if sudo -u postgres pgbackrest --stanza="${STANZA}" stanza-create 2>&1 | tee -a "${WORK_DIR}/pgbackrest-setup.log"; then
  log_ok "  Stanza ready."
else
  log_err "stanza-create failed. Most common causes:"
  log_err "  - postgres SSH key has not been uploaded to the Storage Box yet."
  log_err "  - repo1-cipher-pass changed across runs (use the same one!)."
  log_err "  - Storage Box SFTP is not reachable on port ${SFTP_PORT}."
  log_err ""
  log_err "Upload this public key to https://robot.hetzner.com -> Storage Box -> SSH keys:"
  log_err ""
  log_err "  ${POSTGRES_PUBKEY_CONTENT}"
  log_err ""
  log_err "Then re-run this script."
  exit 1
fi

# Now that the stanza exists on the Storage Box, promote archive_command from
# the temporary '/bin/true' (set in Step 6) to the real pgbackrest archive
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
# Step 8: check
# ---------------------------------------------------------------------------
log_info "Step 8/11: Running pgbackrest check."

sudo -u postgres pgbackrest --stanza="${STANZA}" check 2>&1 | tee -a "${WORK_DIR}/pgbackrest-setup.log"
log_ok "  Check passed - WAL archiving is wired up correctly."

# ---------------------------------------------------------------------------
# Step 9: First full backup
# ---------------------------------------------------------------------------
log_info "Step 9/11: Taking initial full backup (this can take a while)."

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
# Step 10: systemd timers (daily full @ 02:00 UTC, diff every 6h)
# ---------------------------------------------------------------------------
log_info "Step 10/11: Installing systemd units for scheduled backups."

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
# Step 11: Append non-critical metadata to the secrets file.
# The cipher pass was already persisted in Step 4 (BEFORE any operation that
# could fail). Here we only append the additional metadata fields. We use
# '>>' to avoid clobbering the cipher pass written early.
# STORAGE_BOX_PASS is intentionally NOT persisted - pgBackRest uses SSH key
# auth (repo1-sftp-private-key-file), so the password is never required and
# storing it would be an unnecessary secret-on-disk.
# ---------------------------------------------------------------------------
log_info "Step 11/11: Appending metadata to ${SECRETS_FILE} (mode 600)."

# Strip any previously-appended metadata block so this step is idempotent:
# remove everything after the marker line, then re-append fresh metadata.
METADATA_MARKER="# --- metadata (appended by Step 11) ---"
if grep -qF "${METADATA_MARKER}" "${SECRETS_FILE}" 2>/dev/null; then
  # Keep only the lines BEFORE the marker.
  sed -i "/^${METADATA_MARKER}$/,\$d" "${SECRETS_FILE}"
fi

umask 077
cat >>"${SECRETS_FILE}" <<EOF
${METADATA_MARKER}
STORAGE_BOX_HOST='${STORAGE_BOX_HOST}'
STORAGE_BOX_USER='${STORAGE_BOX_USER}'
STORAGE_BOX_SFTP_PORT='${SFTP_PORT}'
STORAGE_BOX_HOST_FINGERPRINT_SHA256='${HOST_FINGERPRINT}'
PGBACKREST_STANZA='${STANZA}'
PGBACKREST_REPO_PATH='${REPO_PATH}'
EOF
chmod 600 "${SECRETS_FILE}"
chown root:root "${SECRETS_FILE}"
umask 022

log_ok "  Secrets saved."

# ---------------------------------------------------------------------------
# Summary
# ---------------------------------------------------------------------------
echo
log_ok "============================================================"
log_ok "  pgBackRest is configured on db-primary."
log_ok "  Stanza:      ${STANZA}"
log_ok "  Repo:        sftp://${STORAGE_BOX_USER}@${STORAGE_BOX_HOST}:${SFTP_PORT}${REPO_PATH}"
log_ok "  Compression: zstd-3   Cipher: aes-256-cbc"
log_ok "  Retention:   fulls kept 90 days (time-based) / 28 diffs / WAL pegged to diffs"
log_ok "  Timers:      pgbackrest-full.timer (02:00 UTC daily)"
log_ok "               pgbackrest-diff.timer (06, 12, 18 UTC)"
log_ok "============================================================"
echo
log_info "If you have not already done so, upload this public key"
log_info "to Hetzner Storage Box -> SSH keys (Robot console):"
echo
echo "  ${POSTGRES_PUBKEY_CONTENT}"
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
