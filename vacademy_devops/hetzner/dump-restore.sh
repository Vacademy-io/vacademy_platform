#!/usr/bin/env bash
# ==============================================================================
# dump-restore.sh
# ------------------------------------------------------------------------------
# Cutover-window orchestration for Linode -> Hetzner Postgres migration.
#
# Runs from the operator's laptop. Drives:
#   * pg_dump from Linode managed Postgres (over public TLS)
#   * scp/rsync of dump files to the Hetzner primary
#   * pg_restore on Hetzner primary (via ssh, local UNIX socket)
#   * row-count verification between source and target
#
# Conventions:
#   - bash strict mode
#   - Idempotent: every subcommand can be re-run safely
#   - Subcommands run individually OR via `./dump-restore.sh all`
#   - Every step logs timestamp + elapsed time
#   - Reads config from env, or sources ./cutover.env if present
#
# Topology recap (from migration plan):
#   db-primary public IP : 5.223.55.54   (HETZNER_DB_PRIMARY_IP default)
#   Postgres version     : 16.14 on both ends
#   Per-service DBs      : auth_service, admin_core_service, assessment_service,
#                          media_service, notification_service, community_service
#   App user             : vacademy
# ==============================================================================

set -euo pipefail

# ------------------------------------------------------------------------------
# Logging helpers
# ------------------------------------------------------------------------------
ts()   { date '+%Y-%m-%d %H:%M:%S'; }
info() { printf '[%s] [INFO] %s\n'  "$(ts)" "$*"; }
ok()   { printf '[%s] [ OK ] %s\n'  "$(ts)" "$*"; }
warn() { printf '[%s] [WARN] %s\n'  "$(ts)" "$*" >&2; }
err()  { printf '[%s] [ERR ] %s\n'  "$(ts)" "$*" >&2; }
step() { printf '\n========== [%s] %s ==========\n' "$(ts)" "$*"; }

# Time a function (wraps a callable, prints elapsed)
timed() {
  local label="$1"; shift
  local start end elapsed
  start=$(date +%s)
  step "BEGIN: $label"
  "$@"
  end=$(date +%s)
  elapsed=$(( end - start ))
  ok "END:   $label  (elapsed: ${elapsed}s)"
}

# Print helpful resume / cleanup hints when any step errors out
on_error() {
  local exit_code=$?
  err "Script failed (exit ${exit_code})."
  err "Resume hints:"
  err "  - Re-run a single phase, e.g.:  $0 dump   /  $0 restore   /  $0 verify"
  err "  - Dumps live in: ${DUMP_DIR:-<unset>}"
  err "  - On Hetzner primary: ls -lh /var/lib/postgresql/cutover/"
  err "  - To wipe Hetzner DBs and restart restore from scratch:"
  err "      ssh root@${HETZNER_DB_PRIMARY_IP:-<ip>} \\"
  err "        'for d in ${LINODE_DBS:-auth_service admin_core_service assessment_service media_service notification_service community_service}; do sudo -u postgres dropdb --if-exists \"\$d\"; sudo -u postgres createdb -O vacademy \"\$d\"; done'"
  err "  - Verify ssh connectivity:  ssh root@${HETZNER_DB_PRIMARY_IP:-<ip>} 'sudo -u postgres psql -c \"select version();\"'"
  exit "$exit_code"
}
trap on_error ERR

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

# 6 service DBs in conventional order
LINODE_DBS="${LINODE_DBS:-auth_service admin_core_service assessment_service media_service notification_service community_service}"

# Hetzner (target) primary — public IP because we drive from the laptop
HETZNER_DB_PRIMARY_IP="${HETZNER_DB_PRIMARY_IP:-5.223.55.54}"
HETZNER_SSH_USER="${HETZNER_SSH_USER:-root}"

# Password for the 'vacademy' app role on Hetzner (used only inside verify queries
# that need to authenticate as vacademy; restore runs via local peer as postgres)
VACADEMY_USER_PASS="${VACADEMY_USER_PASS:-}"

# Where dumps live locally
DUMP_DIR="${DUMP_DIR:-${HOME}/vacademy-cutover/$(date +%Y%m%d-%H%M)}"

# Where dumps live on the Hetzner primary
REMOTE_DUMP_DIR="/var/lib/postgresql/cutover"

# Tolerance for row-count drift between Linode and Hetzner (per critical table).
# Critical tables are checked AFTER apps are frozen, so 0 is the right target.
ROW_COUNT_TOLERANCE="${ROW_COUNT_TOLERANCE:-0}"

# Tables we sanity-check on both sides post-restore. (db:table form.)
# These cover auth, course catalog and integration secrets — if any of these
# disagree we abort hard.
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

# Parallelism for dump/restore
DUMP_PARALLEL="${DUMP_PARALLEL:-3}"     # concurrent pg_dumps
RESTORE_JOBS="${RESTORE_JOBS:-4}"       # --jobs for pg_restore

# Min required disk free for dump dir (in MB)
MIN_FREE_MB="${MIN_FREE_MB:-20480}"     # 20 GB

# ------------------------------------------------------------------------------
# Utility helpers
# ------------------------------------------------------------------------------

# Require an env var; abort with a friendly message if empty.
require_env() {
  local name="$1"
  local val="${!name:-}"
  if [[ -z "$val" ]]; then
    err "Required variable ${name} is not set. Export it or add to cutover.env."
    exit 2
  fi
}

# Build a libpq URI for the Linode source. We pass via env vars rather than the
# URI so the password never lands in process listings.
linode_psql_env() {
  export PGHOST="$LINODE_DB_HOST"
  export PGPORT="$LINODE_DB_PORT"
  export PGUSER="$LINODE_DB_USER"
  export PGPASSWORD="$LINODE_DB_PASS"
  export PGSSLMODE="require"
}

# Clean those PG* vars from the environment.
linode_psql_env_unset() {
  unset PGHOST PGPORT PGUSER PGPASSWORD PGSSLMODE
}

# Run a remote command on the Hetzner primary. We rely on the operator's ssh
# agent / key. Quoting is preserved by using bash -lc on the far side.
hetz_ssh() {
  ssh -o ServerAliveInterval=30 -o ServerAliveCountMax=4 \
      "${HETZNER_SSH_USER}@${HETZNER_DB_PRIMARY_IP}" "$@"
}

# Run a psql query on the Hetzner primary as the postgres OS/role (peer auth).
# $1=db, $2=sql. Returns just the value (tuples-only).
hetz_psql_value() {
  local db="$1" sql="$2"
  hetz_ssh "sudo -u postgres psql -tAX -d '${db}' -c \"${sql}\""
}

# Run a psql query against the Linode source. $1=db, $2=sql. Tuples-only.
linode_psql_value() {
  local db="$1" sql="$2"
  PGDATABASE="$db" psql -tAX -c "$sql"
}

# ------------------------------------------------------------------------------
# Subcommand: preflight
# ------------------------------------------------------------------------------
preflight() {
  info "Required tools: pg_dump, pg_restore, psql, ssh, rsync"
  for bin in pg_dump pg_restore psql ssh rsync; do
    if ! command -v "$bin" >/dev/null 2>&1; then
      err "Missing required tool: ${bin}"
      exit 2
    fi
  done
  ok "All required tools present"

  # pg_dump / pg_restore version >= 16 (must match server major to be safe)
  local pgd_ver
  pgd_ver="$(pg_dump --version | awk '{print $3}')"
  info "pg_dump version: ${pgd_ver}"
  local pgd_major="${pgd_ver%%.*}"
  if (( pgd_major < 16 )); then
    err "pg_dump major version ${pgd_major} < 16. Install Postgres 16 client tools."
    err "  macOS:  brew install libpq && brew link --force libpq"
    err "  Linux:  apt-get install -y postgresql-client-16"
    exit 2
  fi
  ok "pg_dump >= 16"

  # Env vars
  require_env LINODE_DB_HOST
  require_env LINODE_DB_USER
  require_env LINODE_DB_PASS
  require_env HETZNER_DB_PRIMARY_IP
  ok "Required env vars present"

  # Connectivity: Linode (TLS-required)
  info "Probing Linode connectivity (${LINODE_DB_USER}@${LINODE_DB_HOST}:${LINODE_DB_PORT})..."
  linode_psql_env
  if ! psql -d postgres -tAX -c "select 1;" >/dev/null 2>&1; then
    err "Cannot connect to Linode Postgres. Check host/credentials/firewall."
    linode_psql_env_unset
    exit 2
  fi
  local lin_ver
  lin_ver="$(psql -d postgres -tAX -c "show server_version;")"
  ok "Linode reachable. server_version=${lin_ver}"
  linode_psql_env_unset

  # Connectivity: Hetzner primary (ssh + local postgres)
  info "Probing Hetzner primary ssh (${HETZNER_SSH_USER}@${HETZNER_DB_PRIMARY_IP})..."
  if ! hetz_ssh "true" >/dev/null 2>&1; then
    err "SSH to ${HETZNER_DB_PRIMARY_IP} failed. Check key/agent."
    exit 2
  fi
  ok "SSH OK"

  local het_ver
  het_ver="$(hetz_ssh "sudo -u postgres psql -tAX -c 'show server_version;'" 2>/dev/null || true)"
  if [[ -z "$het_ver" ]]; then
    err "Cannot run psql as postgres on Hetzner primary. Is Postgres running?"
    exit 2
  fi
  ok "Hetzner Postgres reachable. server_version=${het_ver}"

  # Major version match check (warn-only; pg_dump targets the source, so the
  # actual restore-time mismatch is what matters — we still flag it).
  local lin_major="${lin_ver%%.*}"
  local het_major="${het_ver%%.*}"
  if [[ "$lin_major" != "$het_major" ]]; then
    warn "Major version mismatch: Linode=${lin_major}, Hetzner=${het_major}. pg_restore may fail."
  else
    ok "Postgres major versions match (${lin_major})"
  fi

  # Disk space for dump dir
  mkdir -p "$DUMP_DIR"
  local free_mb
  # df -Pm: portable, megabytes. Column 4 = available.
  free_mb="$(df -Pm "$DUMP_DIR" | awk 'NR==2 {print $4}')"
  info "Free space at ${DUMP_DIR}: ${free_mb} MB (min required: ${MIN_FREE_MB} MB)"
  if (( free_mb < MIN_FREE_MB )); then
    err "Not enough free space at ${DUMP_DIR}. Need >= ${MIN_FREE_MB} MB."
    exit 2
  fi
  ok "Disk space OK"

  ok "Preflight checks passed."
}

# ------------------------------------------------------------------------------
# Subcommand: scale_down_linode
# ------------------------------------------------------------------------------
scale_down_linode() {
  cat <<'EOF'

============================================================
  MANUAL STEP REQUIRED — FREEZE LINODE WRITES
============================================================
This script CANNOT scale Linode workloads on its own (it would
need Linode kubectl context). Switch terminals and run the
commands below. Use the explicit deployment-name list (matches
CUTOVER_PLAYBOOK.md); a label-selector scale silently no-ops
if the chart did not render the expected instance label.

  # point kubectl at Linode prod
  kubectl --context=linode-prod -n default scale deploy \
    auth-service admin-core-service media-service \
    assessment-service community-service notification-service \
    ai-service \
    --replicas=0

  # wait for pods to terminate (do not just check replica count)
  kubectl --context=linode-prod -n default wait --for=delete pod \
    -l 'app.kubernetes.io/instance=vac' --timeout=120s

  # confirm zero pods are left
  kubectl --context=linode-prod -n default get pods \
    -l 'app.kubernetes.io/instance=vac'

  # confirm no app clients are connected to Linode Postgres
  # (only your psql session should be present)
  PGPASSWORD="$LINODE_DB_PASS" psql \
    "host=$LINODE_DB_HOST port=$LINODE_DB_PORT user=$LINODE_DB_USER \
     dbname=postgres sslmode=require" \
    -c "select usename, application_name, client_addr, state \
        from pg_stat_activity where datname is not null;"

Also pause any cron/scheduler that writes to the DB.
Wait ~30s for in-flight transactions to drain.

When all pods are gone, only your psql is connected, and you
are certain no writes are happening, type the word:  frozen
============================================================

EOF

  local answer=""
  while [[ "$answer" != "frozen" ]]; do
    read -r -p "Type 'frozen' to confirm Linode writes are stopped: " answer
    if [[ "$answer" != "frozen" ]]; then
      warn "Did not get 'frozen'. (Type Ctrl-C to abort.)"
    fi
  done
  ok "Operator confirmed Linode is frozen. Proceeding."
}

# ------------------------------------------------------------------------------
# Subcommand: dump
# ------------------------------------------------------------------------------
# Parallel pg_dump per DB. Custom format (-Fc), no owners/privileges (we recreate
# grants on Hetzner side), compression level 6 (good ratio, decent speed).
dump() {
  mkdir -p "$DUMP_DIR"
  info "Dump destination: ${DUMP_DIR}"
  info "Databases:       ${LINODE_DBS}"
  info "Parallelism:     ${DUMP_PARALLEL} concurrent dumps"

  linode_psql_env

  # Build list, then dump in batches of DUMP_PARALLEL.
  local pids=()
  local running=0

  # If anything fails, make sure we kill any still-running pg_dump children so
  # they don't keep holding connection slots / write-locks on Linode while the
  # operator inspects the failure.
  cleanup_dumps() {
    local p
    for p in "${pids[@]:-}"; do
      kill "$p" 2>/dev/null || true
    done
  }
  trap cleanup_dumps EXIT

  for db in $LINODE_DBS; do
    local out="${DUMP_DIR}/${db}.dump"
    local log="${DUMP_DIR}/${db}.dump.log"

    if [[ -f "$out" && -s "$out" ]]; then
      # Quick custom-format header sanity check ("PGDMP" magic). If valid,
      # skip — keeps the step idempotent across re-runs.
      if head -c5 "$out" | grep -q "PGDMP"; then
        ok "Skip ${db}: existing valid dump at ${out} ($(du -h "$out" | awk '{print $1}'))"
        continue
      else
        warn "Found ${out} but it is not a valid PGDMP archive; will re-dump."
        rm -f "$out"
      fi
    fi

    info "Starting pg_dump for ${db} -> ${out}"
    (
      set +e
      pg_dump -Fc --no-owner --no-privileges -Z 6 \
              --verbose --dbname="$db" --file="$out" >"$log" 2>&1
      rc=$?
      if [[ $rc -ne 0 ]]; then
        echo "FAIL ${db} rc=${rc} (see ${log})"
        exit $rc
      fi
      echo "DONE ${db}"
    ) &
    pids+=("$!")
    running=$(( running + 1 ))

    if (( running >= DUMP_PARALLEL )); then
      # Wait for any one to finish; if it failed, kill siblings and abort
      # cleanly so we don't leave zombies hammering Linode.
      if ! wait -n; then
        err "A pg_dump failed; killing sibling pg_dump processes."
        cleanup_dumps
        linode_psql_env_unset
        trap - EXIT
        exit 3
      fi
      running=$(( running - 1 ))
    fi
  done

  # Wait for the rest. Track failures explicitly so we can clean siblings up.
  local failures=0
  for pid in "${pids[@]}"; do
    if ! wait "$pid"; then
      failures=$(( failures + 1 ))
    fi
  done

  # All children reaped; disarm the EXIT trap.
  trap - EXIT

  linode_psql_env_unset

  if (( failures > 0 )); then
    err "${failures} dump(s) failed. Inspect *.dump.log in ${DUMP_DIR}"
    exit 3
  fi

  ok "All dumps complete. Sizes:"
  for db in $LINODE_DBS; do
    local out="${DUMP_DIR}/${db}.dump"
    if [[ -f "$out" ]]; then
      printf '   %-26s %s\n' "$db" "$(du -h "$out" | awk '{print $1}')"
    fi
  done
}

# ------------------------------------------------------------------------------
# Subcommand: safety_snapshot
# ------------------------------------------------------------------------------
# Belt-and-suspenders: a single pg_dumpall (globals + all DBs as plain SQL),
# gzipped. We use it ONLY to recover roles/grants or to recover from a
# catastrophic pg_restore — it is NOT the primary restore path.
safety_snapshot() {
  mkdir -p "$DUMP_DIR"
  local out="${DUMP_DIR}/safety-pg_dumpall.sql.gz"

  # Only skip if the existing file is a complete, valid gzip stream. A
  # truncated dump (e.g. SIGINT mid-pg_dumpall) is still non-empty but unusable.
  if [[ -f "$out" && -s "$out" ]] && gzip -t "$out" 2>/dev/null; then
    ok "Skip: ${out} already exists and integrity check passed ($(du -h "$out" | awk '{print $1}'))"
    return 0
  fi
  if [[ -f "$out" ]]; then
    warn "Removing prior incomplete ${out}"
    rm -f "$out"
  fi

  linode_psql_env

  info "Running pg_dumpall (globals + all DBs) -> ${out}"
  # --no-role-passwords so we don't ship managed-DB password hashes around.
  # --clean produces DROP+CREATE for globals, useful for manual recovery.
  # Linode managed Postgres does NOT grant superuser; full pg_dumpall may fail
  # because it needs to read pg_authid and dump tablespaces. Fall back to
  # per-DB plain dumps so cutover does not abort on this belt-and-suspenders step.
  if ! pg_dumpall --no-role-passwords --clean --if-exists 2>"${out}.err" | gzip -6 > "$out"; then
    warn "pg_dumpall failed (likely managed-DB superuser restriction). See ${out}.err"
    warn "Falling back to per-DB plain dumps."
    rm -f "$out"
    for db in $LINODE_DBS; do
      local plain="${DUMP_DIR}/safety-${db}.sql.gz"
      info "  plain dump: ${db} -> ${plain}"
      if ! pg_dump --no-owner --no-privileges -Fp -d "$db" | gzip -6 > "$plain"; then
        warn "  safety plain dump failed for ${db}"
      fi
    done
  fi

  linode_psql_env_unset

  if [[ -f "$out" ]]; then
    ok "Safety snapshot written: $(du -h "$out" | awk '{print $1}')"
  else
    ok "Safety snapshot via per-DB plain dumps complete."
  fi
}

# ------------------------------------------------------------------------------
# Subcommand: scp_to_primary
# ------------------------------------------------------------------------------
scp_to_primary() {
  info "Ensuring ${REMOTE_DUMP_DIR} exists on ${HETZNER_DB_PRIMARY_IP}"
  hetz_ssh "mkdir -p '${REMOTE_DUMP_DIR}' && chown postgres:postgres '${REMOTE_DUMP_DIR}' && chmod 750 '${REMOTE_DUMP_DIR}'"

  if [[ ! -d "$DUMP_DIR" ]]; then
    err "Local dump directory not found: ${DUMP_DIR}"
    exit 4
  fi

  info "rsync ${DUMP_DIR}/  -->  ${HETZNER_SSH_USER}@${HETZNER_DB_PRIMARY_IP}:${REMOTE_DUMP_DIR}/"
  # --partial + --inplace + checksum-friendly: idempotent for re-runs.
  # We do NOT use -z (compression) because .dump is already compressed (-Z 6).
  rsync -av --partial --human-readable \
        -e "ssh -o ServerAliveInterval=30" \
        --include='*.dump' --include='safety-pg_dumpall.sql.gz' \
        --exclude='*' \
        "${DUMP_DIR}/" \
        "${HETZNER_SSH_USER}@${HETZNER_DB_PRIMARY_IP}:${REMOTE_DUMP_DIR}/"

  # Fix ownership so the postgres OS user can read the files for pg_restore.
  hetz_ssh "chown -R postgres:postgres '${REMOTE_DUMP_DIR}' && chmod 640 '${REMOTE_DUMP_DIR}'/*.dump 2>/dev/null || true"

  ok "Copied dumps to primary. Remote listing:"
  hetz_ssh "ls -lh '${REMOTE_DUMP_DIR}'"
}

# ------------------------------------------------------------------------------
# Subcommand: restore
# ------------------------------------------------------------------------------
# Per-DB pg_restore on the Hetzner primary, via ssh, as the local postgres role
# (peer auth). The target DBs are expected to already exist (created by
# postgres-setup.sh). We use --clean --if-exists so the restore is idempotent.
restore() {
  info "Restoring on ${HETZNER_DB_PRIMARY_IP} from ${REMOTE_DUMP_DIR}"
  info "Per-DB --jobs=${RESTORE_JOBS}"

  for db in $LINODE_DBS; do
    local remote_dump="${REMOTE_DUMP_DIR}/${db}.dump"
    step "Restoring ${db}"

    # Sanity: file exists on the far side
    if ! hetz_ssh "test -s '${remote_dump}'"; then
      err "Missing/empty dump on primary: ${remote_dump}"
      err "Re-run: $0 scp_to_primary"
      exit 5
    fi

    # Ensure target DB exists. Restore needs an existing DB to connect to.
    hetz_ssh "sudo -u postgres psql -tAX -c \"SELECT 1 FROM pg_database WHERE datname='${db}';\" | grep -q 1 \
              || sudo -u postgres createdb -O vacademy '${db}'"

    # Run the restore. We intentionally do NOT pass -j to pg_restore for
    # custom-format archives that include large objects — but standard
    # archives benefit, so we keep --jobs.
    #
    # Flags:
    #   --clean --if-exists : drop existing objects in target before recreate
    #   --no-owner          : don't try to set owners (managed-DB roles differ)
    #   --no-privileges     : skip GRANTs (we set them via postgres-setup.sh)
    #   --exit-on-error     : fail fast on the first error
    local start end elapsed
    start=$(date +%s)
    hetz_ssh "sudo -u postgres pg_restore \
                --dbname='${db}' \
                --clean --if-exists \
                --no-owner --no-privileges \
                --jobs=${RESTORE_JOBS} \
                --exit-on-error \
                --verbose \
                '${remote_dump}' 2>&1 | tail -n 50" \
      || { err "pg_restore failed for ${db}"; exit 6; }
    end=$(date +%s)
    elapsed=$(( end - start ))

    # Reassign ownership of restored objects to vacademy. We used --no-owner
    # at restore time; this puts everything under the app user in one shot.
    # Fail loud if this fails — otherwise the app user cannot write to its own tables.
    if ! hetz_ssh "sudo -u postgres psql -d '${db}' -tAX -c \"REASSIGN OWNED BY postgres TO vacademy;\"" >/dev/null; then
      err "REASSIGN OWNED failed for ${db}; vacademy will not own restored objects"
      exit 6
    fi
    # Also make vacademy the database owner and ensure schema privileges.
    hetz_ssh "sudo -u postgres psql -tAX -c \"ALTER DATABASE \\\"${db}\\\" OWNER TO vacademy;\"" >/dev/null \
      || warn "ALTER DATABASE OWNER failed for ${db} (non-fatal)"
    hetz_ssh "sudo -u postgres psql -d '${db}' -tAX -c \"GRANT CREATE, USAGE ON SCHEMA public TO vacademy;\"" >/dev/null \
      || warn "GRANT on schema public failed for ${db} (non-fatal)"

    ok "Restored ${db} in ${elapsed}s"
  done

  # After all restores, ANALYZE so the planner has fresh stats before traffic.
  info "Running ANALYZE on all restored DBs (planner stats)..."
  for db in $LINODE_DBS; do
    hetz_ssh "sudo -u postgres psql -d '${db}' -c 'ANALYZE;'" >/dev/null 2>&1 \
      && ok "  ANALYZE ${db} done" \
      || warn "  ANALYZE ${db} failed (non-fatal)"
  done

  ok "All databases restored."
}

# ------------------------------------------------------------------------------
# Subcommand: verify
# ------------------------------------------------------------------------------
# For each (db, table) in CRITICAL_TABLES, query Linode and Hetzner and diff.
# Anything beyond ROW_COUNT_TOLERANCE aborts.
verify() {
  info "Row-count verification (tolerance=${ROW_COUNT_TOLERANCE})"
  info "Tables: ${CRITICAL_TABLES[*]}"

  linode_psql_env

  local mismatches=0
  local report="${DUMP_DIR}/verify-report.txt"
  : > "$report"

  printf '%-40s %12s %12s %10s\n' "TABLE" "LINODE" "HETZNER" "DIFF" | tee -a "$report"
  printf '%-40s %12s %12s %10s\n' "----------------------------------------" "------------" "------------" "----------" | tee -a "$report"

  for entry in "${CRITICAL_TABLES[@]}"; do
    local db="${entry%%:*}"
    local tbl="${entry##*:}"
    local label="${db}.${tbl}"

    # We use a defensive query: if the table doesn't exist on either side
    # (older snapshot, renamed table), we record -1 and warn but don't abort.
    local sql="SELECT CASE WHEN to_regclass('public.${tbl}') IS NULL THEN -1 ELSE (SELECT count(*) FROM public.${tbl}) END;"

    local lin_count het_count diff
    lin_count="$(linode_psql_value "$db" "$sql" 2>/dev/null || echo "ERR")"
    het_count="$(hetz_psql_value   "$db" "$sql" 2>/dev/null || echo "ERR")"

    if [[ "$lin_count" == "ERR" || "$het_count" == "ERR" ]]; then
      warn "Could not read counts for ${label} (linode=${lin_count}, hetzner=${het_count})"
      printf '%-40s %12s %12s %10s\n' "$label" "$lin_count" "$het_count" "ERR" | tee -a "$report"
      mismatches=$(( mismatches + 1 ))
      continue
    fi

    if [[ "$lin_count" == "-1" || "$het_count" == "-1" ]]; then
      err "Critical table missing for ${label} (linode=${lin_count}, hetzner=${het_count})"
      printf '%-40s %12s %12s %10s\n' "$label" "$lin_count" "$het_count" "MISS" | tee -a "$report"
      mismatches=$(( mismatches + 1 ))
      continue
    fi

    diff=$(( lin_count - het_count ))
    local abs_diff=$diff
    (( abs_diff < 0 )) && abs_diff=$(( -abs_diff ))

    printf '%-40s %12s %12s %10s\n' "$label" "$lin_count" "$het_count" "$diff" | tee -a "$report"

    if (( abs_diff > ROW_COUNT_TOLERANCE )); then
      mismatches=$(( mismatches + 1 ))
    fi
  done

  linode_psql_env_unset

  echo
  if (( mismatches > 0 )); then
    err "Verification FAILED: ${mismatches} table(s) outside tolerance."
    err "Report: ${report}"
    err "Likely causes:"
    err "  - Linode workloads were not fully scaled to 0 before dump."
    err "  - A dump was generated before the freeze; re-run dump + restore."
    err "  - A table was added/renamed and is not yet in CRITICAL_TABLES."
    exit 7
  fi

  ok "Verification PASSED. Report saved to ${report}"
}

# ------------------------------------------------------------------------------
# Subcommand: done
# ------------------------------------------------------------------------------
done_step() {
  cat <<'EOF'

============================================================
  RESTORE COMPLETE — READY TO FLIP DNS
============================================================
Next steps (in order):

  1. Sanity-check apps against the Hetzner DB by port-forwarding
     pgbouncer locally or by hitting the new ingress with /etc/hosts
     overrides. Make sure /actuator/health is green on each service.

  2. When ready, run:

       ./cloudflare-dns-flip.sh

     to swap public DNS over to the Hetzner ingress IP.

  3. Keep the Linode stack scaled to 0 (NOT torn down) for at least
     24 hours in case rollback is needed.
============================================================
EOF
}

# ------------------------------------------------------------------------------
# Subcommand: all
# ------------------------------------------------------------------------------
all() {
  timed "preflight"          preflight
  timed "scale_down_linode"  scale_down_linode
  timed "dump"               dump
  timed "safety_snapshot"    safety_snapshot
  timed "scp_to_primary"     scp_to_primary
  timed "restore"            restore
  timed "verify"             verify
  done_step
}

# ------------------------------------------------------------------------------
# Usage / dispatch
# ------------------------------------------------------------------------------
usage() {
  cat <<EOF
Usage: $0 <subcommand>

Subcommands:
  preflight         Check tooling, connectivity, disk space.
  scale_down_linode Print reminder + wait for operator to type 'frozen'.
  dump              Parallel pg_dump per DB into \$DUMP_DIR.
  safety_snapshot   Extra pg_dumpall.gz (recovery belt-and-suspenders).
  scp_to_primary    rsync dumps to Hetzner primary at ${REMOTE_DUMP_DIR}.
  restore           pg_restore per DB on the Hetzner primary.
  verify            Row-count diff between Linode and Hetzner.
  done              Print the next-step (DNS flip) reminder.
  all               Run every step in order.

Configuration (via env or ./cutover.env):
  LINODE_DB_HOST, LINODE_DB_PORT, LINODE_DB_USER, LINODE_DB_PASS
  LINODE_DBS                 (default: ${LINODE_DBS})
  HETZNER_DB_PRIMARY_IP      (default: ${HETZNER_DB_PRIMARY_IP})
  HETZNER_SSH_USER           (default: ${HETZNER_SSH_USER})
  VACADEMY_USER_PASS
  DUMP_DIR                   (default: \$HOME/vacademy-cutover/<ts>)
  DUMP_PARALLEL              (default: ${DUMP_PARALLEL})
  RESTORE_JOBS               (default: ${RESTORE_JOBS})
  ROW_COUNT_TOLERANCE        (default: ${ROW_COUNT_TOLERANCE})
  MIN_FREE_MB                (default: ${MIN_FREE_MB})
EOF
}

main() {
  if [[ $# -lt 1 ]]; then
    usage
    exit 1
  fi
  local cmd="$1"; shift || true
  case "$cmd" in
    preflight)          timed "preflight"          preflight ;;
    scale_down_linode)  timed "scale_down_linode"  scale_down_linode ;;
    dump)               timed "dump"               dump ;;
    safety_snapshot)    timed "safety_snapshot"    safety_snapshot ;;
    scp_to_primary)     timed "scp_to_primary"     scp_to_primary ;;
    restore)            timed "restore"            restore ;;
    verify)             timed "verify"             verify ;;
    done)               done_step ;;
    all)                all ;;
    -h|--help|help)     usage ;;
    *)
      err "Unknown subcommand: ${cmd}"
      usage
      exit 1
      ;;
  esac
}

main "$@"
