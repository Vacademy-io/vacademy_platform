#!/usr/bin/env bash
# ==============================================================================
# snapshot-row-counts.sh
# ------------------------------------------------------------------------------
# Captures a baseline row-count snapshot from the Linode (source) Postgres for
# every critical (db, table) pair we restore on Hetzner. The output is a stable,
# tab-separated file that the cutover playbook diffs at T+30 against the
# Hetzner-side counts produced by ./dump-restore.sh verify.
#
# WHY THIS EXISTS
#   * dump-restore.sh's `verify` subcommand compares Linode-vs-Hetzner LIVE,
#     which only works while Linode is still reachable and frozen. If the dump
#     was taken before the freeze completed, both sides can be "consistent with
#     each other" but stale vs reality. A baseline captured BEFORE the window
#     gives us an anchor of known-good production state.
#   * The CUTOVER_PLAYBOOK.md (T+30 data-verification gate) explicitly asks for
#     `expected-counts.txt` produced by this script.
#
# WHEN TO RUN
#   1. Saturday workstream — 24h before the cutover window.
#        ./snapshot-row-counts.sh > /tmp/cutover/expected-counts.txt
#   2. T-30 minute pre-flight, immediately before freezing Linode writes.
#        ./snapshot-row-counts.sh > /tmp/cutover/expected-counts.preflight.txt
#   3. T+30 verification gate, against post-restore Hetzner counts captured by
#      ./dump-restore.sh verify (its verify-report.txt).
#        diff <(awk '{print $1,$2}' /tmp/cutover/expected-counts.preflight.txt) \
#             <(awk '{print $1,$2}' /tmp/cutover/hetzner-counts.txt)
#
# USAGE
#   LINODE_DB_HOST=... LINODE_DB_USER=... LINODE_DB_PASS=... \
#     ./snapshot-row-counts.sh > /tmp/cutover/expected-counts.txt
#
#   Or with a cutover.env file alongside this script (same format used by
#   dump-restore.sh). The script will source it automatically.
#
# OUTPUT FORMAT (tab-separated, deterministic order)
#   db.table<TAB>count<TAB>captured_at_utc
#
# CONVENTIONS
#   * bash strict mode; idempotent (read-only against Linode).
#   * Same CRITICAL_TABLES list as dump-restore.sh — KEEP IN SYNC.
#   * Postgres 16.14 on both ends; TLS required to Linode.
# ==============================================================================

set -euo pipefail

# ------------------------------------------------------------------------------
# Logging helpers (stderr only — stdout is the baseline data)
# ------------------------------------------------------------------------------
ts()   { date -u '+%Y-%m-%dT%H:%M:%SZ'; }
info() { printf '[%s] [INFO] %s\n'  "$(ts)" "$*" >&2; }
ok()   { printf '[%s] [ OK ] %s\n'  "$(ts)" "$*" >&2; }
warn() { printf '[%s] [WARN] %s\n'  "$(ts)" "$*" >&2; }
err()  { printf '[%s] [ERR ] %s\n'  "$(ts)" "$*" >&2; }

# ------------------------------------------------------------------------------
# Configuration (env-driven, optional cutover.env file)
# ------------------------------------------------------------------------------
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

if [[ -f "${SCRIPT_DIR}/cutover.env" ]]; then
  info "Sourcing config from ${SCRIPT_DIR}/cutover.env"
  # shellcheck disable=SC1091
  source "${SCRIPT_DIR}/cutover.env"
elif [[ -f "./cutover.env" ]]; then
  info "Sourcing config from ./cutover.env"
  # shellcheck disable=SC1091
  source "./cutover.env"
fi

# Linode (source) Postgres - read-only credentials needed
LINODE_DB_HOST="${LINODE_DB_HOST:-}"
LINODE_DB_PORT="${LINODE_DB_PORT:-5432}"
LINODE_DB_USER="${LINODE_DB_USER:-}"
LINODE_DB_PASS="${LINODE_DB_PASS:-}"

# 6 service DBs in conventional order (kept in sync with dump-restore.sh)
LINODE_DBS="${LINODE_DBS:-auth_service admin_core_service assessment_service media_service notification_service community_service}"

# Tables we sanity-check. db:table form. KEEP IN SYNC with dump-restore.sh
# CRITICAL_TABLES — diverging here would silently mask drift at T+30.
CRITICAL_TABLES=(
  "auth_service:users"
  "auth_service:roles"
  "auth_service:client_secret_key"
  "admin_core_service:course"
  "admin_core_service:level"
  "admin_core_service:session"
  "admin_core_service:package_session"
  "admin_core_service:groups"
)

# ------------------------------------------------------------------------------
# Utility helpers
# ------------------------------------------------------------------------------
require_env() {
  local name="$1"
  local val="${!name:-}"
  if [[ -z "$val" ]]; then
    err "Required variable ${name} is not set. Export it or add to cutover.env."
    exit 2
  fi
}

# Export PG* env vars for libpq. We pass via env rather than a URI so the
# password never lands in process listings or shell history.
linode_psql_env() {
  export PGHOST="$LINODE_DB_HOST"
  export PGPORT="$LINODE_DB_PORT"
  export PGUSER="$LINODE_DB_USER"
  export PGPASSWORD="$LINODE_DB_PASS"
  export PGSSLMODE="require"
}

linode_psql_env_unset() {
  unset PGHOST PGPORT PGUSER PGPASSWORD PGSSLMODE
}

# Run a tuples-only query against the Linode source.
# $1=db, $2=sql. Returns just the value.
linode_psql_value() {
  local db="$1" sql="$2"
  PGDATABASE="$db" psql -tAX -c "$sql"
}

# ------------------------------------------------------------------------------
# Preflight
# ------------------------------------------------------------------------------
if ! command -v psql >/dev/null 2>&1; then
  err "psql not found. Install Postgres 16 client tools."
  err "  macOS:  brew install libpq && brew link --force libpq"
  err "  Linux:  apt-get install -y postgresql-client-16"
  exit 2
fi

require_env LINODE_DB_HOST
require_env LINODE_DB_USER
require_env LINODE_DB_PASS

info "Probing Linode connectivity (${LINODE_DB_USER}@${LINODE_DB_HOST}:${LINODE_DB_PORT})..."
linode_psql_env
if ! psql -d postgres -tAX -c "select 1;" >/dev/null 2>&1; then
  err "Cannot connect to Linode Postgres. Check host/credentials/firewall."
  linode_psql_env_unset
  exit 2
fi
LIN_VER="$(psql -d postgres -tAX -c "show server_version;")"
ok "Linode reachable. server_version=${LIN_VER}"

# ------------------------------------------------------------------------------
# Capture
# ------------------------------------------------------------------------------
CAPTURED_AT="$(ts)"
info "Capturing baseline counts at ${CAPTURED_AT}"
info "Tables: ${CRITICAL_TABLES[*]}"

# Header row goes to stderr so the captured file (stdout) is pure data and can
# be diffed line-for-line by the playbook.
printf '# baseline captured_at=%s host=%s server_version=%s\n' \
  "$CAPTURED_AT" "$LINODE_DB_HOST" "$LIN_VER" >&2

ERRORS=0
for entry in "${CRITICAL_TABLES[@]}"; do
  db="${entry%%:*}"
  tbl="${entry##*:}"
  label="${db}.${tbl}"

  # Defensive: if the table doesn't exist (renamed/dropped), record -1 and
  # warn but keep going. Operator decides whether to abort.
  sql="SELECT CASE WHEN to_regclass('public.${tbl}') IS NULL THEN -1 ELSE (SELECT count(*) FROM public.${tbl}) END;"

  if ! count="$(linode_psql_value "$db" "$sql" 2>/dev/null)"; then
    warn "Failed to read ${label}; recording ERR"
    printf '%s\tERR\t%s\n' "$label" "$CAPTURED_AT"
    ERRORS=$(( ERRORS + 1 ))
    continue
  fi

  if [[ "$count" == "-1" ]]; then
    warn "Table missing on Linode: ${label}"
  fi

  printf '%s\t%s\t%s\n' "$label" "$count" "$CAPTURED_AT"
  info "  ${label} = ${count}"
done

linode_psql_env_unset

if (( ERRORS > 0 )); then
  err "Captured baseline with ${ERRORS} error(s). Investigate before relying on this snapshot."
  exit 3
fi

ok "Baseline snapshot complete. Redirect stdout to a file, e.g.:"
ok "  ./snapshot-row-counts.sh > /tmp/cutover/expected-counts.txt"
