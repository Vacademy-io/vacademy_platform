#!/usr/bin/env bash
# =============================================================================
# setup-streaming-replication.sh
# -----------------------------------------------------------------------------
# Attach the Hetzner db-standby host (CPX22, 10.0.0.5) to db-primary (CCX13,
# 10.0.0.4) via PostgreSQL 16 ASYNC streaming replication.
#
# RUN ON: db-standby (5.223.53.24 / 10.0.0.5) as root.
# Idempotent: re-running on a healthy standby is a no-op.
#
# -----------------------------------------------------------------------------
# PREREQUISITES (must be done BEFORE running this script)
# -----------------------------------------------------------------------------
# 1. Run bring-up-postgres.sh on db-primary first (creates the
#    'replicator' role and writes /root/vacademy-migration/postgres-passwords.env).
#
# 2. Copy the passwords file from db-primary to db-standby:
#       # FROM YOUR LAPTOP (or from db-primary directly):
#       scp root@5.223.55.54:/root/vacademy-migration/postgres-passwords.env \
#           root@5.223.53.24:/root/vacademy-migration/postgres-passwords.env
#       # (or, on db-primary: rsync over the private network 10.0.0.5)
#
# 3. The physical replication slot ('vacademy_standby_1' by default) is now
#    created automatically by bring-up-postgres.sh on the primary, so no
#    manual psql is required before running this script.
#
#    Verify on db-primary with:
#       sudo -u postgres psql -c \
#         "SELECT slot_name, slot_type, active FROM pg_replication_slots;"
#
#    NOTE: The slot lives on the PRIMARY, not on the standby.
#    If you re-bootstrap the standby, drop+recreate the slot so the primary
#    stops retaining WAL for the stale standby:
#       sudo -u postgres psql -c \
#         "SELECT pg_drop_replication_slot('vacademy_standby_1');"
#    Then re-run bring-up-postgres.sh (idempotent) to recreate it.
#
# 4. Confirm db-primary's pg_hba.conf allows the standby's private IP for
#    'replication' (bring-up-postgres.sh does this).
# =============================================================================

set -euo pipefail

# -----------------------------------------------------------------------------
# Pretty logging
# -----------------------------------------------------------------------------
info()  { printf '\033[0;36m[INFO]\033[0m  %s\n' "$*"; }
ok()    { printf '\033[0;32m[ OK ]\033[0m  %s\n' "$*"; }
warn()  { printf '\033[0;33m[WARN]\033[0m  %s\n' "$*" >&2; }
err()   { printf '\033[0;31m[ERR ]\033[0m  %s\n' "$*" >&2; }
die()   { err "$*"; exit 1; }

# -----------------------------------------------------------------------------
# Sanity: must be root, must be on db-standby
# -----------------------------------------------------------------------------
[[ $EUID -eq 0 ]] || die "This script must be run as root."

WORKDIR="/root/vacademy-migration"
TOPOLOGY_FILE="${WORKDIR}/topology.env"
PASSWORDS_FILE="${WORKDIR}/postgres-passwords.env"

mkdir -p "${WORKDIR}"

if [[ ! -f "${TOPOLOGY_FILE}" ]]; then
    die "Missing ${TOPOLOGY_FILE}. scp it from your laptop with: scp ./topology.env root@<this host>:${TOPOLOGY_FILE}"
fi

# shellcheck disable=SC1090
source "${TOPOLOGY_FILE}"

: "${DB_PRIMARY_PRIVATE:?DB_PRIMARY_PRIVATE must be defined in topology.env}"
: "${DB_STANDBY_PRIVATE:?DB_STANDBY_PRIVATE must be defined in topology.env}"

# Verify this host actually owns the standby private IP (loose check, warn only).
if ! ip -4 -o addr show | awk '{print $4}' | cut -d/ -f1 | grep -qx "${DB_STANDBY_PRIVATE}"; then
    warn "${DB_STANDBY_PRIVATE} (DB_STANDBY_PRIVATE) is not bound on this host."
    warn "Are you running this on the right machine? Continuing anyway."
fi

if [[ ! -f "${PASSWORDS_FILE}" ]]; then
    err "Missing ${PASSWORDS_FILE}."
    err "Copy it from db-primary first:"
    err "    scp root@${DB_PRIMARY_PUBLIC:-5.223.55.54}:${PASSWORDS_FILE} ${PASSWORDS_FILE}"
    exit 1
fi

chmod 600 "${PASSWORDS_FILE}"
# shellcheck disable=SC1090
source "${PASSWORDS_FILE}"

: "${REPLICATOR_DB_PASSWORD:?REPLICATOR_DB_PASSWORD must be defined in postgres-passwords.env}"

# -----------------------------------------------------------------------------
# Constants
# -----------------------------------------------------------------------------
PG_MAJOR="16"
PG_EXPECTED_VERSION="16.14"          # must match primary exactly for pg_basebackup
PG_CONF_DIR="/etc/postgresql/${PG_MAJOR}/main"
PG_DATA_DIR="/var/lib/postgresql/${PG_MAJOR}/main"
PG_SERVICE="postgresql@${PG_MAJOR}-main.service"
# Physical replication slot. MUST match the slot created by
# bring-up-postgres.sh on the primary. Either both scripts use the built-in
# default, or topology.env sets REPL_SLOT_NAME=... and both scripts pick it
# up — they agree by reference rather than by matching a hard-coded literal.
REPL_SLOT_NAME="${REPL_SLOT_NAME:-vacademy_standby_1}"
APP_NAME="db-standby"
PGPASS_FILE="/var/lib/postgresql/.pgpass"

info "============================================================"
info "Streaming replication bootstrap for db-standby"
info "  Primary  (private): ${DB_PRIMARY_PRIVATE}"
info "  Standby  (private): ${DB_STANDBY_PRIVATE}"
info "  PG version target : ${PG_EXPECTED_VERSION}"
info "  Replication slot  : ${REPL_SLOT_NAME}"
info "============================================================"

# -----------------------------------------------------------------------------
# 1. Install postgresql-16 from the PGDG apt repo (same source as primary)
# -----------------------------------------------------------------------------
info "[1/10] Ensuring PGDG apt repo + postgresql-${PG_MAJOR} is installed..."

export DEBIAN_FRONTEND=noninteractive

if ! command -v psql >/dev/null 2>&1 || ! dpkg -s "postgresql-${PG_MAJOR}" >/dev/null 2>&1; then
    apt-get update -qq
    apt-get install -y -qq curl ca-certificates gnupg lsb-release

    # PGDG signing key
    install -d -m 0755 /etc/apt/keyrings
    if [[ ! -f /etc/apt/keyrings/postgresql.gpg ]]; then
        curl -fsSL https://www.postgresql.org/media/keys/ACCC4CF8.asc \
            | gpg --dearmor -o /etc/apt/keyrings/postgresql.gpg
    fi

    CODENAME="$(lsb_release -cs)"
    echo "deb [signed-by=/etc/apt/keyrings/postgresql.gpg] http://apt.postgresql.org/pub/repos/apt ${CODENAME}-pgdg main" \
        > /etc/apt/sources.list.d/pgdg.list

    apt-get update -qq
    PG_PKG_CANDIDATE="$(apt-cache madison postgresql-${PG_MAJOR} | awk '{print $3}' | grep -E "^${PG_EXPECTED_VERSION}-" | head -n1 || true)"
    if [[ -n "${PG_PKG_CANDIDATE}" ]]; then
        apt-get install -y -qq \
            "postgresql-${PG_MAJOR}=${PG_PKG_CANDIDATE}" \
            "postgresql-client-${PG_MAJOR}=${PG_PKG_CANDIDATE}" \
            "postgresql-${PG_MAJOR}-pgvector"
    else
        warn "exact ${PG_EXPECTED_VERSION} build not in apt cache — installing latest 16.x"
        apt-get install -y -qq \
            "postgresql-${PG_MAJOR}" \
            "postgresql-client-${PG_MAJOR}" \
            "postgresql-${PG_MAJOR}-pgvector"
    fi
    ok "Installed postgresql-${PG_MAJOR} from PGDG."
else
    ok "postgresql-${PG_MAJOR} already installed."
fi

# Verify the exact patch version matches the primary's 16.14
INSTALLED_VERSION="$(psql --version | awk '{print $3}')"
if [[ "${INSTALLED_VERSION}" != "${PG_EXPECTED_VERSION}"* ]]; then
    warn "Installed psql version is ${INSTALLED_VERSION}, expected ${PG_EXPECTED_VERSION}."
    warn "pg_basebackup tolerates same-major mismatches, but you should keep both"
    warn "hosts pinned to the same patch level for clean failover."
fi

# -----------------------------------------------------------------------------
# 2. Stop the default service and blow away the empty data dir
# -----------------------------------------------------------------------------
info "[2/10] Stopping postgres + clearing data dir..."

# Detect: already-running standby? If pg_is_in_recovery() == t, treat as no-op.
if systemctl is-active --quiet "${PG_SERVICE}" 2>/dev/null; then
    if sudo -u postgres psql -tAc "SELECT pg_is_in_recovery();" 2>/dev/null | grep -qx 't'; then
        ok "Standby is already running and in recovery mode."
        info "Skipping basebackup. Will re-verify status at the end."
        ALREADY_STREAMING=1
    else
        info "PostgreSQL is running but NOT in recovery. Stopping for re-init."
        systemctl stop "${PG_SERVICE}"
        ALREADY_STREAMING=0
    fi
else
    systemctl stop "${PG_SERVICE}" 2>/dev/null || true
    ALREADY_STREAMING=0
fi

if [[ "${ALREADY_STREAMING}" -eq 0 ]]; then
    if [[ -d "${PG_DATA_DIR}" ]]; then
        info "Removing existing data dir ${PG_DATA_DIR}..."
        rm -rf "${PG_DATA_DIR}"
    fi
    install -d -m 0700 -o postgres -g postgres "${PG_DATA_DIR}"
    ok "Data dir cleared: ${PG_DATA_DIR}"
fi

# -----------------------------------------------------------------------------
# 3. Stage credentials so pg_basebackup can auth non-interactively
# -----------------------------------------------------------------------------
if [[ "${ALREADY_STREAMING}" -eq 0 ]]; then
    info "[3/10] Staging ~postgres/.pgpass for replicator auth..."
    # Format: hostname:port:database:username:password    (db=replication for repl conns)
    cat > "${PGPASS_FILE}" <<EOF
${DB_PRIMARY_PRIVATE}:5432:replication:replicator:${REPLICATOR_DB_PASSWORD}
${DB_PRIMARY_PRIVATE}:5432:*:replicator:${REPLICATOR_DB_PASSWORD}
EOF
    chown postgres:postgres "${PGPASS_FILE}"
    chmod 600 "${PGPASS_FILE}"
    ok "Wrote ${PGPASS_FILE}"
fi

# -----------------------------------------------------------------------------
# 4. pg_basebackup: clone the primary's data dir over the private network
# -----------------------------------------------------------------------------
if [[ "${ALREADY_STREAMING}" -eq 0 ]]; then
    info "[4/10] Running pg_basebackup from ${DB_PRIMARY_PRIVATE}..."
    info "       (this can take a while depending on the primary's data size)"

    # --wal-method=stream   -> open a second connection to stream WAL during the backup
    # --checkpoint=fast     -> kick a checkpoint NOW on the primary instead of waiting
    # --progress --verbose  -> readable progress output for the operator
    # -R is intentionally NOT used; we write our own standby config + standby.signal
    #    below so we have a single, well-commented source of truth.
    sudo -u postgres pg_basebackup \
        --pgdata="${PG_DATA_DIR}" \
        --host="${DB_PRIMARY_PRIVATE}" \
        --port=5432 \
        --username=replicator \
        --no-password \
        --wal-method=stream \
        --checkpoint=fast \
        --progress \
        --verbose

    ok "pg_basebackup completed."
fi

# -----------------------------------------------------------------------------
# Steps 5-9 rewrite configs and bounce postgres — skip them when the standby
# is already streaming so a re-run is a true no-op (does not lose streaming
# connection, does not overwrite operator hotfixes).
# -----------------------------------------------------------------------------
if [[ "${ALREADY_STREAMING}" -eq 1 ]]; then
    ok "Standby already streaming — skipping config rewrites and restart (steps 5-9)."
else

# -----------------------------------------------------------------------------
# 5. Create standby.signal — tells postgres on startup to enter recovery
# -----------------------------------------------------------------------------
info "[5/10] Writing standby.signal..."
sudo -u postgres touch "${PG_DATA_DIR}/standby.signal"
ok "${PG_DATA_DIR}/standby.signal present."

# -----------------------------------------------------------------------------
# 6. Write postgresql.auto.conf with primary_conninfo + slot
# -----------------------------------------------------------------------------
info "[6/10] Configuring primary_conninfo in postgresql.auto.conf..."

# We use hostaddr= (skip DNS), sslmode=disable (private 10.0.0.0/24 only),
# application_name=db-standby (visible in pg_stat_replication on primary),
# and primary_slot_name= so the primary retains WAL we haven't applied yet.
AUTO_CONF="${PG_DATA_DIR}/postgresql.auto.conf"

# Backup any prior content (basebackup may have copied primary's auto.conf).
if [[ -f "${AUTO_CONF}" ]]; then
    cp -a "${AUTO_CONF}" "${AUTO_CONF}.bak.$(date +%s)" 2>/dev/null || true
fi

cat > "${AUTO_CONF}" <<EOF
# Do not edit this file manually except for replication bootstrap.
# Managed by setup-streaming-replication.sh on db-standby.

primary_conninfo = 'host=${DB_PRIMARY_PRIVATE} hostaddr=${DB_PRIMARY_PRIVATE} port=5432 user=replicator password=${REPLICATOR_DB_PASSWORD} application_name=${APP_NAME} sslmode=disable'
primary_slot_name = '${REPL_SLOT_NAME}'
EOF

chown postgres:postgres "${AUTO_CONF}"
chmod 600 "${AUTO_CONF}"
ok "Wrote ${AUTO_CONF}"

# -----------------------------------------------------------------------------
# 7. Tune postgresql.conf for CPX22 (4GB RAM, 3 vCPU shared)
# -----------------------------------------------------------------------------
info "[7/10] Tuning postgresql.conf for CPX22 (4GB RAM)..."

PG_CONF="${PG_CONF_DIR}/postgresql.conf"

# Helper: idempotently set/override a setting in postgresql.conf
set_pg_conf() {
    local key="$1" value="$2" file="${PG_CONF}"
    # Strip any existing (possibly commented) line for this key
    sed -i -E "/^[[:space:]]*#?[[:space:]]*${key}[[:space:]]*=/d" "${file}"
    echo "${key} = ${value}" >> "${file}"
}

# Smaller box => smaller memory grants. hot_standby_feedback prevents the
# standby's long-running queries from being killed by primary vacuum (it tells
# the primary to defer cleanup of tuples this standby still has open).
set_pg_conf "listen_addresses"        "'*'"
set_pg_conf "port"                    "5432"
set_pg_conf "max_connections"         "200"
set_pg_conf "shared_buffers"          "'1GB'"
set_pg_conf "effective_cache_size"    "'3GB'"
set_pg_conf "work_mem"                "'8MB'"
set_pg_conf "maintenance_work_mem"    "'256MB'"
set_pg_conf "wal_level"               "replica"
set_pg_conf "hot_standby"             "on"
set_pg_conf "hot_standby_feedback"    "on"
set_pg_conf "max_wal_senders"         "10"
set_pg_conf "max_replication_slots"   "10"
set_pg_conf "log_line_prefix"         "'%m [%p] %q%u@%d '"
set_pg_conf "log_min_duration_statement" "1000"

chown postgres:postgres "${PG_CONF}"
ok "postgresql.conf tuned for CPX22."

# -----------------------------------------------------------------------------
# 8. Re-chown the data dir (paranoia after copies/edits)
# -----------------------------------------------------------------------------
info "[8/10] Ensuring ${PG_DATA_DIR} is owned by postgres:postgres..."
chown -R postgres:postgres "${PG_DATA_DIR}"
chmod 700 "${PG_DATA_DIR}"
ok "Ownership/permissions set."

# Make sure Debian's wrapper points at the right data dir (basebackup copies
# primary's pg_ident/pg_hba into the data dir; Debian keeps configs in /etc).
# Re-link pg_hba.conf and pg_ident.conf to the Debian-managed ones so
# 'systemctl start postgresql@16-main' uses the conf in /etc/postgresql/...
for f in pg_hba.conf pg_ident.conf; do
    if [[ -f "${PG_DATA_DIR}/${f}" && ! -L "${PG_DATA_DIR}/${f}" ]]; then
        # Keep a copy of what basebackup gave us, then symlink to Debian's.
        if [[ -f "${PG_CONF_DIR}/${f}" ]]; then
            mv "${PG_DATA_DIR}/${f}" "${PG_DATA_DIR}/${f}.from-primary"
            ln -sf "${PG_CONF_DIR}/${f}" "${PG_DATA_DIR}/${f}"
            chown -h postgres:postgres "${PG_DATA_DIR}/${f}"
        fi
    fi
done

# -----------------------------------------------------------------------------
# 9. Start postgres and wait for recovery mode
# -----------------------------------------------------------------------------
info "[9/10] Starting ${PG_SERVICE}..."
systemctl enable "${PG_SERVICE}" >/dev/null 2>&1 || true
systemctl restart "${PG_SERVICE}"

# Wait for the socket to accept connections (up to 60s)
info "       Waiting for postgres to accept connections..."
for i in $(seq 1 60); do
    if sudo -u postgres pg_isready -q; then
        ok "postgres is accepting connections (after ${i}s)."
        break
    fi
    sleep 1
    if [[ "${i}" -eq 60 ]]; then
        err "Timed out waiting for postgres to start. journalctl -u ${PG_SERVICE}:"
        journalctl -u "${PG_SERVICE}" -n 50 --no-pager >&2 || true
        die "postgres failed to start"
    fi
done

fi  # end: if [[ "${ALREADY_STREAMING}" -eq 1 ]] / else (steps 5-9)

# -----------------------------------------------------------------------------
# 10. Verification
# -----------------------------------------------------------------------------
info "[10/10] Verifying replication state..."

IN_RECOVERY="$(sudo -u postgres psql -tAc 'SELECT pg_is_in_recovery();' 2>/dev/null || echo '?')"
if [[ "${IN_RECOVERY}" != "t" ]]; then
    err "pg_is_in_recovery() returned '${IN_RECOVERY}', expected 't'."
    err "This standby is NOT in recovery. Inspect logs:"
    err "    journalctl -u ${PG_SERVICE} -n 100 --no-pager"
    err "    tail -200 /var/log/postgresql/postgresql-${PG_MAJOR}-main.log"
    exit 1
fi
ok "pg_is_in_recovery() = t  (this host is a standby)"

LAST_REPLAY="$(sudo -u postgres psql -tAc 'SELECT pg_last_wal_replay_lsn();' 2>/dev/null || echo 'NULL')"
LAST_RECEIVE="$(sudo -u postgres psql -tAc 'SELECT pg_last_wal_receive_lsn();' 2>/dev/null || echo 'NULL')"
ok "pg_last_wal_receive_lsn() = ${LAST_RECEIVE}"
ok "pg_last_wal_replay_lsn()  = ${LAST_REPLAY}"

# Show the WAL receiver status so the operator can eyeball "streaming"
info "wal receiver status:"
sudo -u postgres psql -x -c "SELECT status, sender_host, sender_port, slot_name, conninfo FROM pg_stat_wal_receiver;" \
    || warn "pg_stat_wal_receiver returned no rows (WAL receiver not yet up?)"

cat <<EOF

============================================================
db-standby (${DB_STANDBY_PRIVATE}) is now streaming from
db-primary (${DB_PRIMARY_PRIVATE}) using slot '${REPL_SLOT_NAME}'.

To monitor lag from the PRIMARY:
    sudo -u postgres psql -x -c \\
      "SELECT application_name, client_addr, state, sync_state, \\
              pg_wal_lsn_diff(pg_current_wal_lsn(), replay_lsn) AS replay_lag_bytes \\
       FROM pg_stat_replication;"

NEXT STEP: setup-pgbackrest.sh
============================================================
EOF

exit 0
