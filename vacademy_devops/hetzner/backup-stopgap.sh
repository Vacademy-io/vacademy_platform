#!/usr/bin/env bash
# ============================================================================
# backup-stopgap.sh — STOPGAP Postgres backup to Hetzner Storage Box
# ============================================================================
#
# WHY THIS EXISTS
# ---------------
# pgBackRest 2.58.0 on Ubuntu 26.04 (libssh2-1t64 1.11.1-1build2) currently
# fails to authenticate against the Hetzner Storage Box via SFTP+key (libssh2
# error -19). The keys ARE authorized — OpenSSH from the same host works —
# but libssh2 cannot negotiate. Until that is fixed, this script provides a
# best-effort daily safety net using pg_dumpall + openssl + password-auth SFTP.
#
# THIS IS NOT A LONG-TERM SOLUTION. pgBackRest is the proper tool: it gives
# you PITR, incremental backups, parallelism, retention policy, and integrity
# verification. This stopgap gives you ONE thing: a daily encrypted logical
# dump you can restore from manually if the cluster burns down. No PITR. No
# incrementals. No verification beyond "the upload didn't error".
#
# USAGE
# -----
#   ./backup-stopgap.sh                — print usage
#   ./backup-stopgap.sh install        — install systemd timer (daily 03:30 UTC)
#   ./backup-stopgap.sh backup         — run a backup now
#   ./backup-stopgap.sh uninstall      — remove the systemd timer
#   ./backup-stopgap.sh list           — list remote backups on the Storage Box
#
# REQUIREMENTS
# ------------
#   - Runs on db-primary as root (the script su's to postgres for pg_dumpall).
#   - /root/vacademy-migration/topology.env exports:
#       STORAGE_BOX_HOST  (e.g. u605420.your-storagebox.de)
#       STORAGE_BOX_USER  (e.g. u605420)
#       STORAGE_BOX_PASS  (the BX11 password)
#   - Packages: postgresql-client, openssl, sshpass, lftp, coreutils.
#
# WHY lftp (not sshpass+sftp batch)
# ---------------------------------
# Tried both during stopgap design. lftp wins on Ubuntu 26.04 because:
#   (a) It speaks SFTP via its own subsystem — no terminal/batch quirks.
#   (b) `set sftp:auto-confirm yes` + `set ssl:verify-certificate no` handles
#       host-key prompts cleanly (sshpass+sftp needs StrictHostKeyChecking gym).
#   (c) `mirror`, `cls`, `rm` and date-based filtering are first-class.
#   (d) Its error codes propagate properly via `lftp -e ... && exit-from-lftp`,
#       whereas sshpass+sftp swallows non-zero from inside the batch file.
# Password is fed via env var LFTP_PASSWORD (never on the command line).
#
# ============================================================================

set -euo pipefail

# ---------------- constants ----------------
SCRIPT_PATH="$(readlink -f "$0")"
SCRIPT_NAME="$(basename "$SCRIPT_PATH")"
TOPOLOGY_ENV="/root/vacademy-migration/topology.env"
KEYFILE="/root/vacademy-migration/backup-stopgap-key"
LOG_DIR="/var/log/vacademy-backups"
LOG_FILE="${LOG_DIR}/backup-stopgap.log"
WORK_DIR="/var/tmp/vacademy-backup-stopgap"
REMOTE_DIR="/home/backups/vacademy"
RETENTION_DAYS=14
SYSTEMD_SERVICE="/etc/systemd/system/vacademy-backup-stopgap.service"
SYSTEMD_TIMER="/etc/systemd/system/vacademy-backup-stopgap.timer"
INSTALL_DEST="/usr/local/sbin/vacademy-backup-stopgap"

# ---------------- helpers ----------------
banner() {
  cat <<'BANNER'
================================================================================
  VACADEMY POSTGRES BACKUP — *** STOPGAP MODE ***
  This is a temporary daily pg_dumpall safety net.
  pgBackRest is the intended long-term backup tool. Fix libssh2 + Storage Box
  auth and switch back to pgBackRest as soon as possible.
================================================================================
BANNER
}

ts()  { date -u +'%Y-%m-%dT%H:%M:%SZ'; }
log() { printf '[%s] %s\n' "$(ts)" "$*" | tee -a "$LOG_FILE" >&2; }
die() { log "FATAL: $*"; exit 1; }

require_root() {
  [[ $EUID -eq 0 ]] || die "must run as root (got uid=$EUID)"
}

require_cmds() {
  local missing=()
  for c in "$@"; do
    command -v "$c" >/dev/null 2>&1 || missing+=("$c")
  done
  if (( ${#missing[@]} > 0 )); then
    die "missing required commands: ${missing[*]} — apt install postgresql-client openssl sshpass lftp"
  fi
}

load_topology() {
  [[ -r "$TOPOLOGY_ENV" ]] || die "cannot read $TOPOLOGY_ENV"
  # shellcheck disable=SC1090
  set -a; source "$TOPOLOGY_ENV"; set +a
  : "${STORAGE_BOX_HOST:?STORAGE_BOX_HOST not set in $TOPOLOGY_ENV}"
  : "${STORAGE_BOX_USER:?STORAGE_BOX_USER not set in $TOPOLOGY_ENV}"
  : "${STORAGE_BOX_PASS:?STORAGE_BOX_PASS not set in $TOPOLOGY_ENV}"
}

ensure_dirs() {
  mkdir -p "$LOG_DIR" "$WORK_DIR"
  chmod 700 "$WORK_DIR"
  touch "$LOG_FILE"
  chmod 600 "$LOG_FILE"
}

# Rotate the local log file when it crosses 50 MiB. Keeps 5 generations.
rotate_log_if_big() {
  local max=$((50 * 1024 * 1024))
  if [[ -f "$LOG_FILE" ]]; then
    local sz
    sz=$(stat -c%s "$LOG_FILE" 2>/dev/null || echo 0)
    if (( sz > max )); then
      for i in 4 3 2 1; do
        [[ -f "${LOG_FILE}.${i}" ]] && mv "${LOG_FILE}.${i}" "${LOG_FILE}.$((i+1))"
      done
      mv "$LOG_FILE" "${LOG_FILE}.1"
      : > "$LOG_FILE"
      chmod 600 "$LOG_FILE"
    fi
  fi
}

ensure_keyfile() {
  if [[ ! -s "$KEYFILE" ]]; then
    log "no encryption keyfile at $KEYFILE — generating a new one"
    mkdir -p "$(dirname "$KEYFILE")"
    # 512 bits of base64 randomness — used as -pass file:.
    openssl rand -base64 64 | tr -d '\n' > "$KEYFILE"
    chmod 400 "$KEYFILE"
    chown root:root "$KEYFILE"

    # Loud, unmissable reminder. This prints to stderr AND to the log so it
    # ends up in the cron email on the very first run.
    {
      echo ""
      echo "################################################################"
      echo "#                                                              #"
      echo "#   !!!  NEW BACKUP ENCRYPTION KEY GENERATED  !!!              #"
      echo "#                                                              #"
      echo "#   File: $KEYFILE"
      echo "#                                                              #"
      echo "#   COPY THIS KEY OUT-OF-BAND RIGHT NOW.                       #"
      echo "#   If db-primary dies and you don't have this key elsewhere,  #"
      echo "#   every backup on the Storage Box is unrecoverable.          #"
      echo "#                                                              #"
      echo "#   Suggested vaults: 1Password / Bitwarden / printed safe.    #"
      echo "#                                                              #"
      echo "#   Key contents:                                              #"
      echo "#   $(cat "$KEYFILE")"
      echo "#                                                              #"
      echo "################################################################"
      echo ""
    } | tee -a "$LOG_FILE" >&2
  fi
}

# lftp wrapper: takes commands on stdin, runs them against the Storage Box.
# Reads password from env LFTP_PASSWORD (never on the command line).
# IMPORTANT: lftp's -e argument parser does NOT treat newlines as command
# separators — only `;` does. We must therefore collapse newlines on both the
# stdin commands AND the surrounding boilerplate so the whole -e string is
# one big `;`-separated line. Stray newlines cause lftp to bail with the
# misleading "cd: Not connected" error.
lftp_run() {
  local stdin_cmds
  stdin_cmds="$(cat | sed -e 's/[[:space:]]*$//' -e 's/$/;/' | tr '\n' ' ')"
  LFTP_PASSWORD="$STORAGE_BOX_PASS" lftp \
    -u "$STORAGE_BOX_USER,$(printf %s "$STORAGE_BOX_PASS")" \
    --env-password \
    -e "set sftp:auto-confirm yes; set net:max-retries 3; set net:reconnect-interval-base 5; set net:timeout 30; set cmd:fail-exit yes; set xfer:clobber yes; ${stdin_cmds} bye;" \
    "sftp://$STORAGE_BOX_HOST"
}
# Note: lftp's -u takes user,password — but we ALSO set --env-password so the
# password actually comes from $LFTP_PASSWORD in the env, not argv. The arg
# password is a fallback that lftp ignores when --env-password is given. We
# keep both because some lftp builds parse -u strictly.

# ---------------- backup ----------------
do_backup() {
  banner
  log "=== backup run starting ==="
  rotate_log_if_big
  require_root
  require_cmds pg_dumpall openssl sshpass lftp gzip su stat date

  load_topology
  ensure_dirs
  ensure_keyfile

  local stamp dump_path gz_path enc_path remote_name
  stamp="$(date -u +'%Y%m%d-%H%M')"
  dump_path="${WORK_DIR}/vacademy-pgdumpall-${stamp}.sql"
  gz_path="${dump_path}.gz"
  enc_path="${gz_path}.enc"
  remote_name="$(basename "$enc_path")"

  # Cleanup any stale work artefacts from a previous crashed run.
  rm -f "${WORK_DIR}"/vacademy-pgdumpall-*.sql \
        "${WORK_DIR}"/vacademy-pgdumpall-*.sql.gz \
        "${WORK_DIR}"/vacademy-pgdumpall-*.sql.gz.enc

  log "step 1/4: pg_dumpall as postgres user -> $dump_path"
  # We dump as the postgres OS user via local socket; no password needed.
  # Use --clean --if-exists so a restore re-creates roles/databases cleanly.
  if ! su -s /bin/bash postgres -c "pg_dumpall --clean --if-exists --quote-all-identifiers" > "$dump_path" 2>>"$LOG_FILE"; then
    rm -f "$dump_path"
    die "pg_dumpall failed — see $LOG_FILE"
  fi
  local dump_bytes
  dump_bytes=$(stat -c%s "$dump_path")
  log "  pg_dumpall ok — ${dump_bytes} bytes"
  if (( dump_bytes < 1024 )); then
    rm -f "$dump_path"
    die "pg_dumpall produced suspiciously small output (${dump_bytes} bytes)"
  fi

  log "step 2/4: gzip -9 -> $gz_path"
  if ! gzip -9 "$dump_path"; then
    rm -f "$dump_path" "$gz_path"
    die "gzip failed"
  fi
  local gz_bytes
  gz_bytes=$(stat -c%s "$gz_path")
  log "  gzip ok — ${gz_bytes} bytes (compressed from ${dump_bytes})"

  log "step 3/4: openssl AES-256-CBC encrypt -> $enc_path"
  if ! openssl enc -aes-256-cbc -pbkdf2 -salt \
        -in "$gz_path" -out "$enc_path" \
        -pass "file:$KEYFILE" 2>>"$LOG_FILE"; then
    rm -f "$gz_path" "$enc_path"
    die "openssl enc failed"
  fi
  # Wipe the plaintext-gzip; we only ship and keep the encrypted blob.
  rm -f "$gz_path"
  local enc_bytes
  enc_bytes=$(stat -c%s "$enc_path")
  log "  openssl ok — ${enc_bytes} bytes encrypted"

  log "step 4/4: upload $remote_name to ${STORAGE_BOX_HOST}:${REMOTE_DIR}/"
  # mkdir -p the remote dir (idempotent), then put the file, then rotate.
  if ! lftp_run <<LFTP
mkdir -p -f "$REMOTE_DIR"
cd "$REMOTE_DIR"
put -O . "$enc_path" -o "$remote_name"
LFTP
  then
    log "upload FAILED — leaving $enc_path in $WORK_DIR for retry"
    die "lftp upload failed — see $LOG_FILE"
  fi
  log "  upload ok"

  # Verify the file landed at the expected size.
  local remote_size
  remote_size=$(lftp_run <<LFTP 2>/dev/null | awk -v n="$remote_name" '$NF==n {print $(NF-1)}'
cd "$REMOTE_DIR"
cls -l --sort=name
LFTP
)
  if [[ -n "$remote_size" && "$remote_size" != "$enc_bytes" ]]; then
    log "WARN: remote size ($remote_size) != local size ($enc_bytes) — upload may be truncated"
  else
    log "  remote size verified: ${remote_size:-unknown}"
  fi

  rm -f "$enc_path"

  log "rotating remote backups older than ${RETENTION_DAYS} days"
  rotate_remote || log "WARN: rotation step had problems — see $LOG_FILE"

  log "=== backup run complete: $remote_name ==="
}

# Rotation: list the remote dir, parse the YYYYMMDD out of each filename,
# delete anything strictly older than RETENTION_DAYS days from today (UTC).
rotate_remote() {
  local listing
  if ! listing=$(lftp_run <<LFTP 2>>"$LOG_FILE"
cd "$REMOTE_DIR"
cls --sort=name
LFTP
); then
    log "rotation: failed to list remote dir"
    return 1
  fi

  local cutoff today_epoch cutoff_epoch fname date_part f_epoch
  today_epoch=$(date -u +%s)
  cutoff_epoch=$(( today_epoch - RETENTION_DAYS * 86400 ))
  cutoff=$(date -u -d "@${cutoff_epoch}" +'%Y%m%d')
  log "  cutoff date (UTC): $cutoff — anything dated before this is deleted"

  local to_delete=()
  while IFS= read -r fname; do
    [[ -z "$fname" ]] && continue
    # Expected: vacademy-pgdumpall-YYYYMMDD-HHMM.sql.gz.enc
    if [[ "$fname" =~ ^vacademy-pgdumpall-([0-9]{8})-[0-9]{4}\.sql\.gz\.enc$ ]]; then
      date_part="${BASH_REMATCH[1]}"
      f_epoch=$(date -u -d "${date_part}" +%s 2>/dev/null || echo 0)
      if (( f_epoch > 0 && f_epoch < cutoff_epoch )); then
        to_delete+=("$fname")
      fi
    fi
  done <<<"$listing"

  if (( ${#to_delete[@]} == 0 )); then
    log "  nothing to rotate"
    return 0
  fi

  log "  deleting ${#to_delete[@]} old backup(s): ${to_delete[*]}"
  local rm_cmds=""
  local f
  for f in "${to_delete[@]}"; do
    rm_cmds+="rm \"$f\""$'\n'
  done

  if ! lftp_run <<LFTP
cd "$REMOTE_DIR"
$rm_cmds
LFTP
  then
    log "  rotation: at least one rm failed (continuing — not fatal)"
    return 1
  fi
  log "  rotation ok"
  return 0
}

# ---------------- list ----------------
do_list() {
  banner
  require_root
  require_cmds lftp
  load_topology
  echo "Remote: ${STORAGE_BOX_HOST}:${REMOTE_DIR}"
  echo "---"
  lftp_run <<LFTP
cd "$REMOTE_DIR"
cls -l --sort=name
LFTP
}

# ---------------- install / uninstall ----------------
do_install() {
  banner
  require_root
  log "installing $SCRIPT_NAME to $INSTALL_DEST"

  install -m 0755 -o root -g root "$SCRIPT_PATH" "$INSTALL_DEST"

  cat > "$SYSTEMD_SERVICE" <<UNIT
[Unit]
Description=Vacademy STOPGAP Postgres backup to Hetzner Storage Box
Documentation=file:${INSTALL_DEST}
After=network-online.target postgresql.service
Wants=network-online.target

[Service]
Type=oneshot
ExecStart=${INSTALL_DEST} backup
User=root
# Don't let a wedged backup block the next day's run.
TimeoutStartSec=3h
# Keep stdout/stderr in the journal AND in our log file (tee inside script).
StandardOutput=journal
StandardError=journal
Nice=10
IOSchedulingClass=idle
UNIT

  cat > "$SYSTEMD_TIMER" <<UNIT
[Unit]
Description=Daily Vacademy STOPGAP Postgres backup (03:30 UTC)
Documentation=file:${INSTALL_DEST}

[Timer]
OnCalendar=*-*-* 03:30:00 UTC
Persistent=true
RandomizedDelaySec=300
Unit=vacademy-backup-stopgap.service

[Install]
WantedBy=timers.target
UNIT

  chmod 0644 "$SYSTEMD_SERVICE" "$SYSTEMD_TIMER"
  systemctl daemon-reload
  systemctl enable --now vacademy-backup-stopgap.timer

  echo ""
  systemctl status vacademy-backup-stopgap.timer --no-pager || true
  echo ""
  log "install complete — next run:"
  systemctl list-timers vacademy-backup-stopgap.timer --no-pager || true
  echo ""
  echo "Trigger a test run NOW with:"
  echo "  systemctl start vacademy-backup-stopgap.service && journalctl -u vacademy-backup-stopgap.service -f"
}

do_uninstall() {
  banner
  require_root
  log "uninstalling vacademy-backup-stopgap timer"
  systemctl disable --now vacademy-backup-stopgap.timer 2>/dev/null || true
  rm -f "$SYSTEMD_TIMER" "$SYSTEMD_SERVICE"
  systemctl daemon-reload
  log "removed timer + service. Script stays at $INSTALL_DEST; keyfile stays at $KEYFILE."
  log "remote backups on the Storage Box are NOT deleted."
}

# ---------------- usage ----------------
usage() {
  banner
  cat <<USAGE

Usage: $SCRIPT_NAME <command>

Commands:
  install      Install /usr/local/sbin + systemd timer (daily 03:30 UTC)
  uninstall    Disable + remove the systemd timer (keeps script + key + remote backups)
  backup       Run one backup now
  list         List existing backups on the Storage Box
  (no args)    Print this help

Files:
  Topology env:   $TOPOLOGY_ENV
  Encryption key: $KEYFILE     (mode 400 — back this up out-of-band!)
  Local log:      $LOG_FILE
  Remote path:    sftp://\$STORAGE_BOX_HOST${REMOTE_DIR}/
  Filename:       vacademy-pgdumpall-YYYYMMDD-HHMM.sql.gz.enc
  Retention:      ${RETENTION_DAYS} days

Restore (manual):
  1) scp the desired vacademy-pgdumpall-*.sql.gz.enc back to a recovery host.
  2) openssl enc -d -aes-256-cbc -pbkdf2 -in <file>.enc -out <file>.gz -pass file:<KEYFILE>
  3) gunzip <file>.gz
  4) psql -h <target> -U postgres -f <file>.sql       # restores all DBs + roles

Remember: pgBackRest is the proper long-term tool. This is a STOPGAP.

USAGE
}

# ---------------- main ----------------
main() {
  case "${1:-}" in
    install)   do_install ;;
    uninstall) do_uninstall ;;
    backup)    do_backup ;;
    list)      do_list ;;
    ""|-h|--help|help) usage ;;
    *) usage; exit 2 ;;
  esac
}

main "$@"
