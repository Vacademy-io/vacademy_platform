#!/usr/bin/env bash
#
# bring-up-postgres.sh
#
# Provisions PostgreSQL 16.14 on db-primary (Hetzner CCX13, 2vCPU/8GB).
# Installs from the official PGDG apt repo, tunes for the box size,
# configures pg_hba for the 10.0.0.0/16 private network, creates the
# vacademy + replicator users (auto-generated passwords saved to
# /root/vacademy-migration/postgres-passwords.env), and creates the 6
# per-service databases with pgvector / pgcrypto extensions.
#
# Runs on db-primary (10.0.0.4) as root. Idempotent — safe to re-run.
#
# NEXT STEP after this completes: setup-streaming-replication.sh
# (run from db-standby, 10.0.0.5)
#
set -euo pipefail

# ---------------------------------------------------------------------------
# logging helpers
# ---------------------------------------------------------------------------
log_info() { printf '\033[0;36m[INFO]\033[0m  %s\n' "$*"; }
log_ok()   { printf '\033[0;32m[ OK ]\033[0m  %s\n' "$*"; }
log_warn() { printf '\033[0;33m[WARN]\033[0m  %s\n' "$*" >&2; }
log_err()  { printf '\033[0;31m[ERR ]\033[0m  %s\n' "$*" >&2; }

die() { log_err "$*"; exit 1; }

# ---------------------------------------------------------------------------
# constants
# ---------------------------------------------------------------------------
PG_MAJOR="16"
PG_TARGET_VERSION="16.14"
MIGRATION_DIR="/root/vacademy-migration"
PASSWORDS_FILE="${MIGRATION_DIR}/postgres-passwords.env"
TOPOLOGY_FILE="${MIGRATION_DIR}/topology.env"

PG_CONF="/etc/postgresql/${PG_MAJOR}/main/postgresql.conf"
PG_HBA="/etc/postgresql/${PG_MAJOR}/main/pg_hba.conf"

# Per-service databases (all owned by vacademy)
SERVICE_DBS=(
  auth_service
  admin_core_service
  assessment_service
  media_service
  notification_service
  community_service
)

# Private network the app pods reach us on
APP_CIDR="10.0.0.0/16"
# Single-host replication source IP (db-standby private)
STANDBY_IP="10.0.0.5/32"

# ---------------------------------------------------------------------------
# preflight
# ---------------------------------------------------------------------------
[[ "$(id -u)" -eq 0 ]] || die "must run as root"

if [[ ! -f /etc/os-release ]] || ! grep -q '^ID=ubuntu' /etc/os-release; then
  die "this script targets Ubuntu (24.04 expected)"
fi

log_info "preparing migration dir: ${MIGRATION_DIR}"
mkdir -p "${MIGRATION_DIR}"
chmod 700 "${MIGRATION_DIR}"

# Source topology.env if present (informational — script does not strictly
# need vars here, since this box's own role is fixed, but we surface it
# so the operator sees a consistent setup).
if [[ -f "${TOPOLOGY_FILE}" ]]; then
  # shellcheck disable=SC1090
  source "${TOPOLOGY_FILE}"
  log_info "sourced topology.env (DB_PRIMARY_PRIVATE=${DB_PRIMARY_PRIVATE:-unset})"
else
  log_warn "topology.env not found at ${TOPOLOGY_FILE} — continuing with hard-coded values"
fi

# Physical replication slot consumed by db-standby. MUST match the
# REPL_SLOT_NAME used in setup-streaming-replication.sh (which also accepts
# a topology.env override). Both scripts agree by reference rather than by
# string-matching a hard-coded literal.
REPL_SLOT_NAME="${REPL_SLOT_NAME:-vacademy_standby_1}"
log_info "replication slot name: ${REPL_SLOT_NAME}"

# ---------------------------------------------------------------------------
# 1. PGDG apt repo + install
# ---------------------------------------------------------------------------
log_info "ensuring PGDG apt repository is configured"

export DEBIAN_FRONTEND=noninteractive

apt-get update -qq
apt-get install -y -qq curl ca-certificates gnupg lsb-release sudo >/dev/null

UBUNTU_CODENAME="$(lsb_release -cs)"
PGDG_LIST="/etc/apt/sources.list.d/pgdg.list"
PGDG_KEY="/usr/share/keyrings/postgresql.gpg"

if [[ ! -f "${PGDG_KEY}" ]]; then
  log_info "installing PGDG signing key"
  curl -fsSL https://www.postgresql.org/media/keys/ACCC4CF8.asc \
    | gpg --dearmor -o "${PGDG_KEY}"
  chmod 644 "${PGDG_KEY}"
else
  log_ok "PGDG signing key already present"
fi

DESIRED_REPO="deb [signed-by=${PGDG_KEY}] http://apt.postgresql.org/pub/repos/apt ${UBUNTU_CODENAME}-pgdg main"
if [[ ! -f "${PGDG_LIST}" ]] || ! grep -qxF "${DESIRED_REPO}" "${PGDG_LIST}"; then
  log_info "writing ${PGDG_LIST}"
  echo "${DESIRED_REPO}" > "${PGDG_LIST}"
else
  log_ok "PGDG repo entry already correct"
fi

apt-get update -qq

# We want 16.14 specifically (matches Linode source). Pin the apt package
# to the 16.14 build if available, otherwise install whatever 16.x is
# current and warn — pg_restore wire format is compatible inside a major.
PG_PKG_CANDIDATE="$(apt-cache madison postgresql-16 | awk '{print $3}' | grep -E "^${PG_TARGET_VERSION}-" | head -n1 || true)"

if [[ -n "${PG_PKG_CANDIDATE}" ]]; then
  log_info "installing postgresql-16=${PG_PKG_CANDIDATE} (pinned to ${PG_TARGET_VERSION})"
  apt-get install -y -qq \
    "postgresql-16=${PG_PKG_CANDIDATE}" \
    "postgresql-client-16=${PG_PKG_CANDIDATE}" \
    "postgresql-16-pgvector" >/dev/null
else
  log_warn "exact ${PG_TARGET_VERSION} build not in apt cache — installing latest 16.x"
  apt-get install -y -qq postgresql-16 postgresql-client-16 postgresql-16-pgvector >/dev/null
fi

INSTALLED_VERSION="$(/usr/lib/postgresql/${PG_MAJOR}/bin/postgres --version | awk '{print $3}')"
log_ok "postgres installed: ${INSTALLED_VERSION}"
if [[ "${INSTALLED_VERSION}" != "${PG_TARGET_VERSION}"* ]]; then
  log_warn "installed ${INSTALLED_VERSION} != target ${PG_TARGET_VERSION} — pg_restore inside 16.x is still safe"
fi

# ---------------------------------------------------------------------------
# 2. Tune postgresql.conf for 8GB / 2vCPU
# ---------------------------------------------------------------------------
log_info "tuning ${PG_CONF}"

[[ -f "${PG_CONF}" ]] || die "expected config file not found: ${PG_CONF}"

# Back up original once.
if [[ ! -f "${PG_CONF}.orig" ]]; then
  cp -a "${PG_CONF}" "${PG_CONF}.orig"
  log_ok "backed up original config to ${PG_CONF}.orig"
fi

# Write all tuning into a single managed include file. This is cleaner
# than editing the upstream-shipped file: we just append an "include"
# line once and own the whole tuning block in our file.
TUNING_FILE="/etc/postgresql/${PG_MAJOR}/main/conf.d/99-vacademy.conf"
mkdir -p "$(dirname "${TUNING_FILE}")"

cat > "${TUNING_FILE}" <<'EOF'
# Managed by bring-up-postgres.sh — do not edit by hand.
# Vacademy prod tuning for Hetzner CCX13 (2 vCPU / 8 GB RAM / NVMe).

# --- connections / listening ---
listen_addresses = '*'
max_connections = 200

# --- memory ---
shared_buffers = 2GB
effective_cache_size = 6GB
maintenance_work_mem = 512MB
work_mem = 16MB

# --- WAL / replication ---
wal_level = replica
max_wal_senders = 10
max_replication_slots = 10
wal_compression = on
hot_standby = on

# --- planner (NVMe) ---
random_page_cost = 1.1
effective_io_concurrency = 200

# --- checkpoints ---
checkpoint_completion_target = 0.9

# --- observability ---
log_min_duration_statement = 1000
shared_preload_libraries = 'pg_stat_statements'
EOF

chown postgres:postgres "${TUNING_FILE}"
chmod 644 "${TUNING_FILE}"

# Ensure the main config actually pulls in conf.d/*.conf. The Debian
# packaging ships an `include_dir = 'conf.d'` line by default, but
# verify and add if missing.
if ! grep -Eq "^[[:space:]]*include_dir[[:space:]]*=[[:space:]]*'conf.d'" "${PG_CONF}"; then
  log_info "adding 'include_dir = conf.d' to ${PG_CONF}"
  echo "include_dir = 'conf.d'" >> "${PG_CONF}"
else
  log_ok "include_dir = 'conf.d' already set in main config"
fi

log_ok "tuning written to ${TUNING_FILE}"

# ---------------------------------------------------------------------------
# 3. pg_hba.conf — peer for local postgres, scram for app + replication
# ---------------------------------------------------------------------------
log_info "writing ${PG_HBA}"

if [[ ! -f "${PG_HBA}.orig" ]]; then
  cp -a "${PG_HBA}" "${PG_HBA}.orig"
  log_ok "backed up original pg_hba to ${PG_HBA}.orig"
fi

# Force scram for password connections everywhere.
cat > "${PG_HBA}" <<EOF
# Managed by bring-up-postgres.sh — do not edit by hand.
# TYPE   DATABASE        USER         ADDRESS            METHOD

# Local superuser via Unix socket only.
local    all             postgres                        peer

# Local Unix-socket connections from app users still use scram.
local    all             all                             scram-sha-256

# App traffic from the 10.0.0.0/16 private network (k3s nodes, pgbouncer).
host     all             vacademy     ${APP_CIDR}        scram-sha-256

# Physical replication — only the db-standby private IP may connect.
host     replication     replicator   ${STANDBY_IP}      scram-sha-256
EOF

chown postgres:postgres "${PG_HBA}"
chmod 640 "${PG_HBA}"

log_ok "pg_hba.conf written"

# ---------------------------------------------------------------------------
# 4. start / restart postgres and wait for it to be ready
# ---------------------------------------------------------------------------
log_info "enabling + restarting postgresql@${PG_MAJOR}-main"

systemctl enable "postgresql@${PG_MAJOR}-main" >/dev/null 2>&1 || true

# Restart (not just reload) so listen_addresses + shared_preload_libraries
# definitely take effect.
systemctl restart "postgresql@${PG_MAJOR}-main"

# Wait for the cluster to accept connections (up to 60s).
log_info "waiting for postgres to accept connections..."
for i in {1..30}; do
  if sudo -u postgres pg_isready -q; then
    log_ok "postgres is accepting connections"
    break
  fi
  sleep 2
  if [[ "$i" -eq 30 ]]; then
    die "postgres did not become ready within 60s — check 'journalctl -u postgresql@${PG_MAJOR}-main'"
  fi
done

# ---------------------------------------------------------------------------
# 5. password generation / persistence
# ---------------------------------------------------------------------------
log_info "managing passwords file: ${PASSWORDS_FILE}"

# If the passwords file already exists from a previous run, reuse it so
# this script is idempotent and re-runs don't lock the app out.
if [[ -f "${PASSWORDS_FILE}" ]]; then
  log_ok "reusing existing passwords file"
  # shellcheck disable=SC1090
  source "${PASSWORDS_FILE}"
else
  log_info "generating new passwords"
  # Read a bounded chunk first so `tr` never gets SIGPIPE'd by `head` closing
  # its stdin — under `set -o pipefail` that would otherwise exit 141 and
  # abort the whole script on a fresh box.
  gen_pw() { head -c 4096 /dev/urandom | LC_ALL=C tr -dc 'A-Za-z0-9' | head -c 32; }
  VACADEMY_PASSWORD="$(gen_pw)"
  REPLICATOR_PASSWORD="$(gen_pw)"
  umask 077
  cat > "${PASSWORDS_FILE}" <<EOF
# Generated by bring-up-postgres.sh on $(date -u +%Y-%m-%dT%H:%M:%SZ)
# Mode 600. Do NOT commit. Required by app helm values and replication setup.
VACADEMY_PASSWORD='${VACADEMY_PASSWORD}'
REPLICATOR_PASSWORD='${REPLICATOR_PASSWORD}'
# Transitional aliases — older scripts referenced these names.
VACADEMY_DB_PASSWORD='${VACADEMY_PASSWORD}'
REPLICATOR_DB_PASSWORD='${REPLICATOR_PASSWORD}'
EOF
  chmod 600 "${PASSWORDS_FILE}"
  log_ok "passwords written to ${PASSWORDS_FILE} (mode 600)"
fi

# Defensive: both vars must now be set (under either name, for back-compat
# with any previously-generated passwords file).
VACADEMY_PASSWORD="${VACADEMY_PASSWORD:-${VACADEMY_DB_PASSWORD:-}}"
REPLICATOR_PASSWORD="${REPLICATOR_PASSWORD:-${REPLICATOR_DB_PASSWORD:-}}"
[[ -n "${VACADEMY_PASSWORD}" ]]   || die "VACADEMY_PASSWORD missing"
[[ -n "${REPLICATOR_PASSWORD}" ]] || die "REPLICATOR_PASSWORD missing"

# ---------------------------------------------------------------------------
# 6. create roles (vacademy, replicator) — idempotent
# ---------------------------------------------------------------------------
log_info "creating / updating roles"

# Helper that runs SQL as the postgres superuser. Uses psql -v ON_ERROR_STOP
# and parameter substitution via psql variables to avoid quoting bugs.
run_sql() {
  sudo -u postgres psql -v ON_ERROR_STOP=1 -X -q "$@"
}

# Use DO blocks so CREATE ROLE is a no-op if the role already exists; we
# then ALTER ROLE unconditionally so the password is always synced to the
# value we just persisted.
run_sql <<SQL
DO \$\$
BEGIN
   IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'vacademy') THEN
      CREATE ROLE vacademy LOGIN;
   END IF;
   IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'replicator') THEN
      CREATE ROLE replicator LOGIN REPLICATION;
   END IF;
END
\$\$;

ALTER ROLE vacademy   WITH LOGIN PASSWORD '${VACADEMY_PASSWORD}';
ALTER ROLE replicator WITH LOGIN REPLICATION PASSWORD '${REPLICATOR_PASSWORD}';
SQL

log_ok "roles vacademy + replicator are present with correct passwords"

# ---------------------------------------------------------------------------
# 6b. create physical replication slot for db-standby (idempotent)
# ---------------------------------------------------------------------------
# setup-streaming-replication.sh (run from db-standby) expects this slot to
# already exist on the primary. Without it, the standby still attaches but
# the primary won't retain WAL during standby downtime, defeating HA.
log_info "ensuring physical replication slot '${REPL_SLOT_NAME}' exists"
run_sql <<SQL
DO \$\$
BEGIN
   IF NOT EXISTS (
      SELECT 1 FROM pg_replication_slots WHERE slot_name = '${REPL_SLOT_NAME}'
   ) THEN
      PERFORM pg_create_physical_replication_slot('${REPL_SLOT_NAME}');
   END IF;
END
\$\$;
SQL

SLOT_PRESENT="$(sudo -u postgres psql -tAc \
  "SELECT count(*) FROM pg_replication_slots WHERE slot_name='${REPL_SLOT_NAME}';")"
if [[ "${SLOT_PRESENT}" != "1" ]]; then
  die "replication slot '${REPL_SLOT_NAME}' was not created — aborting"
fi
log_ok "replication slot '${REPL_SLOT_NAME}' present"

# ---------------------------------------------------------------------------
# 7. create per-service databases (owned by vacademy)
# ---------------------------------------------------------------------------
log_info "ensuring per-service databases exist"

for db in "${SERVICE_DBS[@]}"; do
  exists="$(sudo -u postgres psql -tAc "SELECT 1 FROM pg_database WHERE datname = '${db}'")"
  if [[ "${exists}" == "1" ]]; then
    log_ok "database '${db}' already exists — ensuring owner is vacademy"
    run_sql -c "ALTER DATABASE ${db} OWNER TO vacademy;"
  else
    log_info "creating database '${db}' owned by vacademy"
    run_sql -c "CREATE DATABASE ${db} OWNER vacademy;"
    log_ok "created '${db}'"
  fi
done

# ---------------------------------------------------------------------------
# 8. create required extensions in every per-service DB
# ---------------------------------------------------------------------------
log_info "creating extensions (pgvector + pgcrypto) in every service DB"

for db in "${SERVICE_DBS[@]}"; do
  sudo -u postgres psql -v ON_ERROR_STOP=1 -X -q -d "${db}" <<'SQL'
CREATE EXTENSION IF NOT EXISTS vector;
CREATE EXTENSION IF NOT EXISTS pgcrypto;
SQL
  log_ok "  ${db}: vector + pgcrypto ready"
done

# ---------------------------------------------------------------------------
# 9. pg_stat_statements in admin_core_service only
# ---------------------------------------------------------------------------
log_info "creating pg_stat_statements in admin_core_service"
sudo -u postgres psql -v ON_ERROR_STOP=1 -X -q -d admin_core_service <<'SQL'
CREATE EXTENSION IF NOT EXISTS pg_stat_statements;
SQL
log_ok "pg_stat_statements ready in admin_core_service"

# ---------------------------------------------------------------------------
# 10. final verification
# ---------------------------------------------------------------------------
log_info "verification: \\l (database list)"
sudo -u postgres psql -c '\l'

log_info "verification: pg_stat_replication (should be empty pre-standby)"
REPL_ROWS="$(sudo -u postgres psql -tAc 'SELECT count(*) FROM pg_stat_replication;')"
log_ok "pg_stat_replication row count = ${REPL_ROWS}"
if [[ "${REPL_ROWS}" != "0" ]]; then
  log_warn "expected 0 replication connections at this stage (got ${REPL_ROWS}) — fine if you're re-running after the standby is already up"
fi

log_info "verification: pg_stat_statements visible"
sudo -u postgres psql -d admin_core_service -c \
  "SELECT count(*) AS pg_stat_statements_rows FROM pg_stat_statements;" || \
  log_warn "pg_stat_statements query failed — extension may need a restart cycle to populate"

# ---------------------------------------------------------------------------
# 11. local firewall (defense in depth — the Hetzner Cloud Firewall fw-db
#     attached in the UI is the primary gate; this is a belt-and-braces
#     local ufw ruleset in case the operator forgets to attach it).
# ---------------------------------------------------------------------------
log_info "configuring local ufw firewall (defense in depth)"

if ! command -v ufw >/dev/null 2>&1; then
  apt-get install -y -qq ufw >/dev/null
fi

# Default deny inbound, allow outbound. Allow SSH from anywhere (operator
# access is gated by Hetzner Cloud Firewall + SSH key auth), and 5432 only
# from the private network.
ufw --force reset >/dev/null
ufw default deny incoming >/dev/null
ufw default allow outgoing >/dev/null
ufw allow 22/tcp >/dev/null
ufw allow from "${APP_CIDR}" to any port 5432 proto tcp >/dev/null
ufw --force enable >/dev/null
log_ok "ufw active: 22/tcp open, 5432/tcp restricted to ${APP_CIDR}"

# The operator MUST also attach the Hetzner Cloud Firewall 'fw-db' in the
# Hetzner UI. We surface this loudly so a missed step is hard to overlook.
log_warn "OPERATOR ACTION REQUIRED: confirm Hetzner Cloud Firewall 'fw-db'"
log_warn "is attached to this node in the Hetzner UI, then verify from your"
log_warn "laptop that 'nc -z -w3 <db-primary public IP> 5432' TIMES OUT."

# ---------------------------------------------------------------------------
# done
# ---------------------------------------------------------------------------
cat <<EOF

============================================================
  db-primary postgres bring-up COMPLETE
============================================================
  cluster version : ${INSTALLED_VERSION}
  listen          : * : 5432
  app user        : vacademy (password in ${PASSWORDS_FILE})
  repl user       : replicator (password in ${PASSWORDS_FILE})
  databases       : ${SERVICE_DBS[*]}
  tuning file     : ${TUNING_FILE}
  pg_hba          : ${PG_HBA}
============================================================

NEXT STEP: setup-streaming-replication.sh (run from db-standby).

EOF

exit 0
