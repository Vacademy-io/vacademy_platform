#!/usr/bin/env bash
# =============================================================================
# cloudflare-dns-flip.sh
# -----------------------------------------------------------------------------
# One-shot Cloudflare DNS A-record flipper for the Linode -> Hetzner Singapore
# production migration.
#
# What this does:
#   * Captures the CURRENT (Linode) A-record contents for the supplied records,
#     writing them to ./linode-current-ips-<timestamp>.json and updating the
#     symlink ./linode-current-ips-LATEST.json. This snapshot is the rollback
#     source of truth.
#   * Flips each record to a new target IP (typically the Hetzner k3s ingress
#     LB / floating IP), keeping type=A, proxied=true.
#   * Verifies that each PATCH returned 200 + the new content matches.
#   * In --back-to-linode mode, restores each record to its captured content.
#
# Usage:
#   Flip forward (Linode -> Hetzner):
#     CF_API_TOKEN=... CF_ZONE_ID=... ./cloudflare-dns-flip.sh \
#         --to 5.223.88.202 \
#         --records admin.vacademy.io,app.vacademy.io,backend.vacademy.io \
#         [--ttl 60] [--yes]
#
#   Rollback (Hetzner -> Linode):
#     CF_API_TOKEN=... CF_ZONE_ID=... ./cloudflare-dns-flip.sh \
#         --back-to-linode \
#         --records admin.vacademy.io,app.vacademy.io,backend.vacademy.io
#
# Verification AFTER flip (operator-side, all records are proxied=true):
#   * Because proxied=true, `dig +short <record>` MUST return Cloudflare anycast
#     IPs (e.g. 104.x / 172.x / 162.x), NOT the origin IP. This is expected.
#   * To verify origin routing through Cloudflare's edge use:
#         curl -H "Host: <record>" https://<record>/healthz
#     The HTTPS connection terminates at Cloudflare, then CF forwards to the
#     new origin IP. Make sure your origin certificates / ingress are ready
#     BEFORE flipping.
#   * To bypass Cloudflare and hit the new origin directly (sanity check):
#         curl --resolve <record>:443:<new-ip> -k https://<record>/healthz
#   * Cloudflare edge cache for proxied records typically picks up the new
#     origin within a few seconds. Browsers may still hit old TCP connections
#     -- short TTL (default 60s) keeps non-proxied lookups quick if you ever
#     unproxy.
# =============================================================================

set -euo pipefail

# -----------------------------------------------------------------------------
# Pretty logging helpers
# -----------------------------------------------------------------------------
info() { printf '\033[36m[INFO]\033[0m  %s\n' "$*"; }
ok()   { printf '\033[32m[ OK ]\033[0m  %s\n' "$*"; }
warn() { printf '\033[33m[WARN]\033[0m  %s\n' "$*" >&2; }
err()  { printf '\033[31m[ERR ]\033[0m  %s\n' "$*" >&2; }

die()  { err "$*"; exit 1; }

# -----------------------------------------------------------------------------
# Constants / paths
# -----------------------------------------------------------------------------
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
SNAPSHOT_LATEST="${SCRIPT_DIR}/linode-current-ips-LATEST.json"
CF_API="https://api.cloudflare.com/client/v4"
DEFAULT_TTL=60

# -----------------------------------------------------------------------------
# Dependency checks
# -----------------------------------------------------------------------------
command -v curl >/dev/null 2>&1 || die "curl is required but not found in PATH"
command -v jq   >/dev/null 2>&1 || die "jq is required but not found in PATH"

# -----------------------------------------------------------------------------
# Env checks
# -----------------------------------------------------------------------------
: "${CF_API_TOKEN:?CF_API_TOKEN is required (Cloudflare API token with Zone:DNS:Edit on vacademy.io)}"
: "${CF_ZONE_ID:?CF_ZONE_ID is required (Cloudflare zone ID for vacademy.io)}"

# -----------------------------------------------------------------------------
# CLI parsing
# -----------------------------------------------------------------------------
MODE=""            # "flip" or "rollback"
NEW_IP=""
RECORDS_CSV=""
TTL="${DEFAULT_TTL}"
ASSUME_YES="false"

usage() {
  cat <<'USAGE'
Usage:
  cloudflare-dns-flip.sh --to <new-ip> --records r1,r2,... [--ttl 60] [--yes]
  cloudflare-dns-flip.sh --back-to-linode --records r1,r2,...

Options:
  --to <ip>              New A-record content (e.g. Hetzner LB / floating IP).
  --back-to-linode       Restore records from ./linode-current-ips-LATEST.json.
  --records <csv>        Comma-separated FQDNs to update (must be in CF_ZONE_ID).
  --ttl <seconds>        TTL for the record (default 60, ignored when proxied).
  --yes                  Skip the "type 'flip' to continue" confirmation.
  -h, --help             Show this help.

Environment:
  CF_API_TOKEN  Cloudflare API token (Zone:DNS:Edit on vacademy.io). REQUIRED.
  CF_ZONE_ID    Cloudflare zone ID for vacademy.io.                  REQUIRED.
USAGE
}

while [[ $# -gt 0 ]]; do
  case "$1" in
    --to)
      [[ $# -ge 2 ]] || die "--to requires an IP argument"
      NEW_IP="$2"; MODE="flip"; shift 2 ;;
    --back-to-linode)
      MODE="rollback"; shift ;;
    --records)
      [[ $# -ge 2 ]] || die "--records requires a comma-separated list"
      RECORDS_CSV="$2"; shift 2 ;;
    --ttl)
      [[ $# -ge 2 ]] || die "--ttl requires a value"
      TTL="$2"; shift 2 ;;
    --yes|-y)
      ASSUME_YES="true"; shift ;;
    -h|--help)
      usage; exit 0 ;;
    *)
      err "Unknown argument: $1"
      usage; exit 1 ;;
  esac
done

[[ -n "${MODE}" ]]        || { usage; die "Must specify --to <ip> or --back-to-linode"; }
[[ -n "${RECORDS_CSV}" ]] || { usage; die "--records is required"; }

# Basic IP sanity check for flip mode
if [[ "${MODE}" == "flip" ]]; then
  if [[ ! "${NEW_IP}" =~ ^[0-9]{1,3}(\.[0-9]{1,3}){3}$ ]]; then
    die "Invalid IPv4 address: ${NEW_IP}"
  fi
fi

# Build records array
IFS=',' read -r -a RECORDS <<< "${RECORDS_CSV}"
if [[ ${#RECORDS[@]} -eq 0 ]]; then
  die "No records parsed from --records"
fi
# Trim whitespace and validate non-empty
for i in "${!RECORDS[@]}"; do
  RECORDS[$i]="$(echo "${RECORDS[$i]}" | tr -d '[:space:]')"
  [[ -n "${RECORDS[$i]}" ]] || die "Empty record name in --records list"
done

# -----------------------------------------------------------------------------
# Cloudflare API helpers
# -----------------------------------------------------------------------------
# cf_get_record_by_name <fqdn>
#   Echoes a single JSON object: { "id": "...", "content": "...", "ttl": N,
#                                  "proxied": true|false, "type": "A" }
#   Exits non-zero if not found / API error.
cf_get_record_by_name() {
  local name="$1"
  local resp http_code body
  resp="$(curl -sS -w '\n__HTTP_CODE__:%{http_code}' \
    -H "Authorization: Bearer ${CF_API_TOKEN}" \
    -H "Content-Type: application/json" \
    "${CF_API}/zones/${CF_ZONE_ID}/dns_records?type=A&name=${name}")"
  http_code="$(printf '%s' "${resp}" | sed -n 's/^__HTTP_CODE__://p' | tail -n1)"
  body="$(printf '%s' "${resp}" | sed '/^__HTTP_CODE__:/d')"

  if [[ "${http_code}" == "429" ]]; then
    die "Cloudflare rate limit hit (HTTP 429) while looking up ${name}. Back off and retry."
  fi
  if [[ "${http_code}" != "200" ]]; then
    err "Cloudflare GET failed (HTTP ${http_code}) for ${name}:"
    printf '%s\n' "${body}" | jq . >&2 2>/dev/null || printf '%s\n' "${body}" >&2
    return 1
  fi
  local success count
  success="$(printf '%s' "${body}" | jq -r '.success')"
  if [[ "${success}" != "true" ]]; then
    err "Cloudflare API returned success=false for ${name}:"
    printf '%s' "${body}" | jq '.errors' >&2
    return 1
  fi
  count="$(printf '%s' "${body}" | jq -r '.result | length')"
  if [[ "${count}" -eq 0 ]]; then
    err "No A record found for ${name} in zone ${CF_ZONE_ID}"
    return 1
  fi
  if [[ "${count}" -gt 1 ]]; then
    warn "Multiple A records found for ${name} (count=${count}); using the first."
  fi
  printf '%s' "${body}" | jq -c '.result[0] | {id, content, ttl, proxied, type}'
}

# cf_patch_record <record_id> <new_ip> <ttl> <proxied>
#   Echoes the result JSON. Exits non-zero on error.
cf_patch_record() {
  local rid="$1" content="$2" ttl="$3" proxied="$4"
  local payload resp http_code body
  payload="$(jq -nc \
    --arg type "A" \
    --arg content "${content}" \
    --argjson ttl "${ttl}" \
    --argjson proxied "${proxied}" \
    '{type:$type, content:$content, ttl:$ttl, proxied:$proxied}')"
  resp="$(curl -sS -w '\n__HTTP_CODE__:%{http_code}' -X PATCH \
    -H "Authorization: Bearer ${CF_API_TOKEN}" \
    -H "Content-Type: application/json" \
    --data "${payload}" \
    "${CF_API}/zones/${CF_ZONE_ID}/dns_records/${rid}")"
  http_code="$(printf '%s' "${resp}" | sed -n 's/^__HTTP_CODE__://p' | tail -n1)"
  body="$(printf '%s' "${resp}" | sed '/^__HTTP_CODE__:/d')"

  if [[ "${http_code}" == "429" ]]; then
    die "Cloudflare rate limit hit (HTTP 429) while PATCHing ${rid}. Back off and retry."
  fi
  if [[ "${http_code}" != "200" ]]; then
    err "Cloudflare PATCH failed (HTTP ${http_code}) for record id ${rid}:"
    printf '%s\n' "${body}" | jq . >&2 2>/dev/null || printf '%s\n' "${body}" >&2
    return 1
  fi
  local success
  success="$(printf '%s' "${body}" | jq -r '.success')"
  if [[ "${success}" != "true" ]]; then
    err "Cloudflare PATCH returned success=false for ${rid}:"
    printf '%s' "${body}" | jq '.errors' >&2
    return 1
  fi
  printf '%s' "${body}" | jq -c '.result | {id, name, content, ttl, proxied, type}'
}

# -----------------------------------------------------------------------------
# Snapshot capture (BEFORE state)
# -----------------------------------------------------------------------------
# Always snapshot current state before any mutation. The snapshot is the
# authoritative rollback source.
capture_snapshot() {
  if [[ -e "${SNAPSHOT_LATEST}" ]]; then
    info "Existing snapshot found: $(readlink -f "${SNAPSHOT_LATEST}")"
    local stale=0
    for rec in "${RECORDS[@]}"; do
      local snap_ip
      snap_ip="$(jq -r --arg n "$rec" '.records[$n].content // empty' "${SNAPSHOT_LATEST}")"
      if [[ -z "$snap_ip" || "$snap_ip" == "${NEW_IP}" ]]; then stale=1; break; fi
    done
    if [[ $stale -eq 0 ]]; then
      warn "Re-using existing snapshot (LATEST already records pre-flip state); NOT overwriting."
      return 0
    fi
    die "LATEST snapshot exists but appears stale/missing records. Refuse to overwrite. Move it aside manually if you really want a fresh snapshot."
  fi

  local ts snapshot_path
  ts="$(date -u +%Y%m%dT%H%M%SZ)"
  snapshot_path="${SCRIPT_DIR}/linode-current-ips-${ts}.json"

  info "Capturing current DNS state to ${snapshot_path}"

  # Build a JSON object keyed by record name.
  local snapshot_json='{}'
  snapshot_json="$(jq -nc --arg ts "${ts}" --arg zone "${CF_ZONE_ID}" \
    '{captured_at:$ts, zone_id:$zone, records:{}}')"

  local rec record_json
  for rec in "${RECORDS[@]}"; do
    info "  GET ${rec}"
    if ! record_json="$(cf_get_record_by_name "${rec}")"; then
      die "Failed to fetch current state for ${rec}; aborting before any changes."
    fi
    snapshot_json="$(printf '%s' "${snapshot_json}" \
      | jq --arg name "${rec}" --argjson r "${record_json}" \
        '.records[$name] = $r')"
  done

  printf '%s\n' "${snapshot_json}" | jq . > "${snapshot_path}"
  ln -sfn "${snapshot_path}" "${SNAPSHOT_LATEST}"
  ok "Snapshot written: ${snapshot_path}"
  ok "Symlink updated:  ${SNAPSHOT_LATEST} -> $(basename "${snapshot_path}")"
}

# -----------------------------------------------------------------------------
# Confirmation prompt (flip only)
# -----------------------------------------------------------------------------
confirm_flip() {
  if [[ "${ASSUME_YES}" == "true" ]]; then
    warn "--yes passed; skipping confirmation prompt."
    return 0
  fi
  echo
  warn "About to flip the following records to ${NEW_IP} (ttl=${TTL}, proxied=true):"
  for rec in "${RECORDS[@]}"; do
    printf '         - %s\n' "${rec}"
  done
  echo
  read -r -p "Type 'flip' to continue (anything else aborts): " answer
  if [[ "${answer}" != "flip" ]]; then
    die "Aborted by operator (expected 'flip', got '${answer}')."
  fi
}

# -----------------------------------------------------------------------------
# Flip / rollback execution
# -----------------------------------------------------------------------------
# Results buffer for the final summary table.
# Each row: "<record>\t<old_ip>\t<new_ip>\t<status>"
declare -a RESULTS=()

do_flip() {
  capture_snapshot
  confirm_flip

  info "Flipping ${#RECORDS[@]} record(s) to ${NEW_IP} (ttl=${TTL}, proxied=true)..."

  # Re-read snapshot for old values (single source of truth).
  local rec rid old_ip patched new_content
  for rec in "${RECORDS[@]}"; do
    rid="$(jq -r --arg n "${rec}" '.records[$n].id' "${SNAPSHOT_LATEST}")"
    old_ip="$(jq -r --arg n "${rec}" '.records[$n].content' "${SNAPSHOT_LATEST}")"

    if [[ -z "${rid}" || "${rid}" == "null" ]]; then
      err "No record id for ${rec} in snapshot; skipping."
      RESULTS+=("${rec}|${old_ip:-?}|${NEW_IP}|MISSING_ID")
      continue
    fi

    if [[ "${old_ip}" == "${NEW_IP}" ]]; then
      warn "${rec} already points to ${NEW_IP}; skipping PATCH (idempotent)."
      RESULTS+=("${rec}|${old_ip}|${NEW_IP}|ALREADY_SET")
      continue
    fi

    info "  PATCH ${rec} (${rid}): ${old_ip} -> ${NEW_IP}"
    if ! patched="$(cf_patch_record "${rid}" "${NEW_IP}" "${TTL}" "true")"; then
      RESULTS+=("${rec}|${old_ip}|${NEW_IP}|PATCH_FAILED")
      continue
    fi
    new_content="$(printf '%s' "${patched}" | jq -r '.content')"
    if [[ "${new_content}" != "${NEW_IP}" ]]; then
      err "  PATCH succeeded but content mismatch for ${rec}: got '${new_content}', wanted '${NEW_IP}'"
      RESULTS+=("${rec}|${old_ip}|${new_content}|CONTENT_MISMATCH")
      continue
    fi
    ok "  ${rec} -> ${NEW_IP}"
    RESULTS+=("${rec}|${old_ip}|${NEW_IP}|OK")
  done
}

do_rollback() {
  if [[ ! -e "${SNAPSHOT_LATEST}" ]]; then
    die "No snapshot found at ${SNAPSHOT_LATEST}. Refusing to roll back without a captured BEFORE state."
  fi
  # Resolve symlink target for the log
  local target
  target="$(readlink "${SNAPSHOT_LATEST}" || echo "${SNAPSHOT_LATEST}")"
  info "Rolling back using snapshot: ${target}"

  local rec rid old_ip ttl proxied patched new_content current_record cur_content
  for rec in "${RECORDS[@]}"; do
    rid="$(jq -r --arg n "${rec}" '.records[$n].id'      "${SNAPSHOT_LATEST}")"
    old_ip="$(jq -r --arg n "${rec}" '.records[$n].content' "${SNAPSHOT_LATEST}")"
    ttl="$(jq -r --arg n "${rec}" '.records[$n].ttl // 60' "${SNAPSHOT_LATEST}")"
    proxied="$(jq -r --arg n "${rec}" '.records[$n].proxied | if . == null then true else . end' "${SNAPSHOT_LATEST}")"

    if [[ -z "${rid}" || "${rid}" == "null" ]]; then
      err "${rec} not present in snapshot; skipping."
      RESULTS+=("${rec}|?|?|NOT_IN_SNAPSHOT")
      continue
    fi

    # Idempotency: skip if already restored.
    if current_record="$(cf_get_record_by_name "${rec}")"; then
      cur_content="$(printf '%s' "${current_record}" | jq -r '.content')"
      if [[ "${cur_content}" == "${old_ip}" ]]; then
        warn "${rec} already at original IP ${old_ip}; skipping PATCH."
        RESULTS+=("${rec}|${cur_content}|${old_ip}|ALREADY_RESTORED")
        continue
      fi
    else
      cur_content="?"
    fi

    info "  PATCH ${rec} (${rid}): ${cur_content} -> ${old_ip} (rollback)"
    if ! patched="$(cf_patch_record "${rid}" "${old_ip}" "${ttl}" "${proxied}")"; then
      RESULTS+=("${rec}|${cur_content}|${old_ip}|PATCH_FAILED")
      continue
    fi
    new_content="$(printf '%s' "${patched}" | jq -r '.content')"
    if [[ "${new_content}" != "${old_ip}" ]]; then
      err "  Rollback PATCH content mismatch for ${rec}: got '${new_content}', wanted '${old_ip}'"
      RESULTS+=("${rec}|${cur_content}|${new_content}|CONTENT_MISMATCH")
      continue
    fi
    ok "  ${rec} restored to ${old_ip}"
    RESULTS+=("${rec}|${cur_content}|${old_ip}|OK")
  done
}

# -----------------------------------------------------------------------------
# Summary table
# -----------------------------------------------------------------------------
print_summary() {
  echo
  echo "============================================================================"
  if [[ "${MODE}" == "flip" ]]; then
    printf 'Cloudflare DNS Flip Summary  (target=%s, ttl=%s, proxied=true)\n' "${NEW_IP}" "${TTL}"
  else
    printf 'Cloudflare DNS Rollback Summary  (source=%s)\n' "${SNAPSHOT_LATEST}"
  fi
  echo "============================================================================"
  printf '%-32s  %-18s  %-18s  %s\n' "RECORD" "FROM" "TO" "STATUS"
  printf '%-32s  %-18s  %-18s  %s\n' "------" "----" "--" "------"
  local row rec from to status
  local fail=0
  for row in "${RESULTS[@]}"; do
    IFS='|' read -r rec from to status <<< "${row}"
    printf '%-32s  %-18s  %-18s  %s\n' "${rec}" "${from}" "${to}" "${status}"
    case "${status}" in
      OK|ALREADY_SET|ALREADY_RESTORED) ;;
      *) fail=$((fail+1)) ;;
    esac
  done
  echo "============================================================================"
  echo
  if [[ "${MODE}" == "flip" && ${fail} -eq 0 ]]; then
    cat <<'POSTFLIP'
Post-flip verification checklist:
  1) Because all records are proxied=true, `dig +short <record>` should return
     Cloudflare anycast IPs (104.x / 172.x / 162.x). DO NOT expect to see the
     new origin IP here -- that is correct behaviour.

  2) Verify through Cloudflare's edge (origin must already be healthy):
         curl -fsS -H "Host: <record>" https://<record>/healthz

  3) Bypass Cloudflare and hit the new origin directly (sanity check):
         curl --resolve <record>:443:<new-ip> -fsS -k https://<record>/healthz

  4) Watch error rates / latency in observability for a few minutes before
     considering the migration complete.

To roll back, run:
    ./cloudflare-dns-flip.sh --back-to-linode --records <same csv>
POSTFLIP
  fi

  if [[ ${fail} -gt 0 ]]; then
    err "${fail} record(s) did not complete successfully. Review the table above."
    exit 1
  fi
}

# -----------------------------------------------------------------------------
# Main
# -----------------------------------------------------------------------------
info "Mode:       ${MODE}"
info "Zone ID:    ${CF_ZONE_ID}"
info "Records:    ${RECORDS_CSV}"
if [[ "${MODE}" == "flip" ]]; then
  info "Target IP:  ${NEW_IP}"
  info "TTL:        ${TTL}"
fi

case "${MODE}" in
  flip)     do_flip ;;
  rollback) do_rollback ;;
  *)        die "Unknown mode '${MODE}'" ;;
esac

print_summary
ok "Done."
