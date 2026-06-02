#!/usr/bin/env bash
# =============================================================================
# export-linode-prod-config.sh
# -----------------------------------------------------------------------------
# Capture the CURRENT Linode prod chart values into the two files the Hetzner
# helm upgrade consumes:
#
#   1. values-prod-hetzner.yaml   (REPLACE_* tokens in the template filled in
#                                  from the live Linode ConfigMap)
#   2. values.secret.yaml         (Secret keys, base64-decoded; gitignored)
#
# The Saturday dry-run AND the Sunday cutover (CUTOVER_PLAYBOOK.md T+40) both
# do:
#
#   helm upgrade --install vac . \
#       -f values.yaml \
#       -f values-prod-hetzner.yaml \
#       -f values.secret.yaml
#
# Without these two files filled in correctly, the helm upgrade either fails
# the env.required=true gate, or — worse — succeeds with a freshly generated
# jwtSecretKey, which silently invalidates every active session and every
# outstanding email/invite token across the platform. See the warning in
# values-prod-hetzner.yaml.template (lines 169-186) and CLAUDE.md
# ("Java services HARDCODE jwtSecretKey -- values.secret.yaml must reuse
# the prod value, NEVER randomize").
#
# -----------------------------------------------------------------------------
# Prerequisites
# -----------------------------------------------------------------------------
#   - kubectl on PATH with a context that can read the Linode prod cluster.
#     By default this script uses --context "$LINODE_KUBE_CONTEXT" (default:
#     "linode-prod"); override via the env var if your kubeconfig names it
#     something else.
#   - yq v4+ (mikefarah/yq) on PATH — used to splice secret values into the
#     output without trashing the template's comments/structure.
#   - base64 (BSD or GNU; the script detects which).
#
# -----------------------------------------------------------------------------
# What it does (idempotent; safe to re-run)
# -----------------------------------------------------------------------------
#   1. Verifies kubectl can reach the Linode prod context.
#   2. Locates the chart-rendered ConfigMap and Secret in `default` namespace.
#      The ConfigMap name is auto-detected (looks for the one that has
#      SPRING_PROFILES_ACTIVE / DB_HOST keys); the Secret name defaults to
#      `vacademy-secrets` (override with $LINODE_SECRET_NAME).
#   3. Reads every key, base64-decodes the Secret values.
#   4. Writes:
#        ./values-prod-hetzner.yaml   (copy of the template with REPLACE_*
#                                      env values substituted from the CM)
#        ./values.secret.yaml         (just the `secrets:` and `pgbouncer:`
#                                      sections, with real values; 0600 perms)
#   5. Greps the rendered file for any REMAINING `REPLACE` tokens and prints
#      them so you can hand-fill the ones the live cluster doesn't expose
#      (e.g. certManager.email is an ops contact, not stored in prod).
#
# -----------------------------------------------------------------------------
# Output safety
# -----------------------------------------------------------------------------
#   - values.secret.yaml is written with mode 0600.
#   - Both output files are listed in .gitignore (see vacademy_devops/.gitignore).
#     This script will FAIL CLOSED if values.secret.yaml is not gitignored, to
#     avoid an accidental commit of jwtSecretKey / AWS keys / Razorpay secrets.
#
# -----------------------------------------------------------------------------
# Usage
# -----------------------------------------------------------------------------
#   cd vacademy_devops/hetzner
#   LINODE_KUBE_CONTEXT=linode-prod \
#   LINODE_SECRET_NAME=vacademy-secrets \
#   bash export-linode-prod-config.sh
#
# Run this on FRIDAY (well before Saturday's dry-run), confirm jwtSecretKey
# in values.secret.yaml matches what the running Linode services use, then
# stash both files where the Sunday driver can reach them.
# =============================================================================

set -euo pipefail

# -----------------------------------------------------------------------------
# Config (override via env)
# -----------------------------------------------------------------------------
LINODE_KUBE_CONTEXT="${LINODE_KUBE_CONTEXT:-linode-prod}"
LINODE_NAMESPACE="${LINODE_NAMESPACE:-default}"
LINODE_SECRET_NAME="${LINODE_SECRET_NAME:-vacademy-secrets}"

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
TEMPLATE_FILE="${SCRIPT_DIR}/values-prod-hetzner.yaml.template"
OUT_VALUES="${SCRIPT_DIR}/values-prod-hetzner.yaml"
OUT_SECRETS="${SCRIPT_DIR}/values.secret.yaml"
WORKDIR="$(mktemp -d -t linode-prod-export.XXXXXX)"

trap 'rm -rf "$WORKDIR"' EXIT

# -----------------------------------------------------------------------------
# Helpers
# -----------------------------------------------------------------------------
log()  { printf '[export] %s\n' "$*" >&2; }
die()  { printf '[export] FATAL: %s\n' "$*" >&2; exit 1; }

need() {
  command -v "$1" >/dev/null 2>&1 || die "missing required binary: $1"
}

b64decode() {
  # Works on both BSD (macOS) and GNU base64.
  if base64 --help 2>&1 | grep -q -- '-D'; then
    base64 -D
  else
    base64 -d
  fi
}

ensure_gitignored() {
  local target_rel="vacademy_devops/hetzner/values.secret.yaml"
  local repo_root
  repo_root="$(cd "$SCRIPT_DIR/../.." && pwd)"
  if [[ ! -f "$repo_root/.gitignore" ]] \
      || ! grep -qE "(^|/)values\.secret\.yaml$|^${target_rel}$" "$repo_root/.gitignore"; then
    die "values.secret.yaml is NOT in $repo_root/.gitignore. Add it before re-running."
  fi
}

# -----------------------------------------------------------------------------
# Preflight
# -----------------------------------------------------------------------------
need kubectl
need yq
need base64

[[ -f "$TEMPLATE_FILE" ]] || die "template not found: $TEMPLATE_FILE"
ensure_gitignored

log "context=$LINODE_KUBE_CONTEXT namespace=$LINODE_NAMESPACE secret=$LINODE_SECRET_NAME"

if ! kubectl --context "$LINODE_KUBE_CONTEXT" -n "$LINODE_NAMESPACE" get ns "$LINODE_NAMESPACE" >/dev/null 2>&1; then
  die "kubectl cannot reach context '$LINODE_KUBE_CONTEXT' / ns '$LINODE_NAMESPACE'. Check your kubeconfig."
fi

# -----------------------------------------------------------------------------
# 1. Locate the ConfigMap. We pick the CM in the namespace that has
#    SPRING_PROFILES_ACTIVE — that's the chart-rendered app config.
# -----------------------------------------------------------------------------
log "locating chart-rendered ConfigMap..."
CM_NAME="$(kubectl --context "$LINODE_KUBE_CONTEXT" -n "$LINODE_NAMESPACE" \
  get cm -o json \
  | yq '.items[] | select(.data.SPRING_PROFILES_ACTIVE != null) | .metadata.name' \
  | head -n1)"
[[ -n "$CM_NAME" ]] || die "no ConfigMap with SPRING_PROFILES_ACTIVE found in ns '$LINODE_NAMESPACE'"
log "ConfigMap: $CM_NAME"

kubectl --context "$LINODE_KUBE_CONTEXT" -n "$LINODE_NAMESPACE" \
  get cm "$CM_NAME" -o yaml > "$WORKDIR/cm.yaml"

kubectl --context "$LINODE_KUBE_CONTEXT" -n "$LINODE_NAMESPACE" \
  get secret "$LINODE_SECRET_NAME" -o yaml > "$WORKDIR/secret.yaml"

# -----------------------------------------------------------------------------
# 2. Helper to pull a key from CM (raw value) or Secret (base64-decoded).
# -----------------------------------------------------------------------------
cm_get()  { yq -r ".data.\"$1\" // \"\"" "$WORKDIR/cm.yaml"; }
sec_get() {
  local v
  v="$(yq -r ".data.\"$1\" // \"\"" "$WORKDIR/secret.yaml")"
  [[ -z "$v" ]] && { echo ""; return; }
  printf '%s' "$v" | b64decode
}

# -----------------------------------------------------------------------------
# 3. Start from the template, write values-prod-hetzner.yaml with the
#    non-secret env values filled in. Secrets go in values.secret.yaml.
# -----------------------------------------------------------------------------
log "rendering $OUT_VALUES from template..."
cp "$TEMPLATE_FILE" "$OUT_VALUES"

# Map of (placeholder anchor in template) -> (live CM key). Edit if the
# live CM uses different key names; the script will warn on anything missing.
declare -a CM_FIELDS=(
  "env.cloudFrontUrl=CLOUDFRONT_URL"
  "env.s3.region=S3_REGION"
  "env.s3.bucket=S3_BUCKET"
  "env.s3.publicBucket=S3_PUBLIC_BUCKET"
  "env.mail.host=MAIL_HOST"
  "env.ses.senderEmail=SES_SENDER_EMAIL"
  "env.ses.configurationSet=SES_CONFIGURATION_SET"
  "env.ses.eventsSqsUrl=SES_EVENTS_SQS_URL"
  "env.sqs.region=SQS_REGION"
  "env.sqs.endpoint=SQS_ENDPOINT"
)

for pair in "${CM_FIELDS[@]}"; do
  yaml_path="${pair%%=*}"
  cm_key="${pair##*=}"
  val="$(cm_get "$cm_key")"
  if [[ -z "$val" ]]; then
    log "  WARN: CM key '$cm_key' is empty; leaving placeholder in $yaml_path"
    continue
  fi
  # Use yq to set the value, preserving comments via in-place merge.
  VAL="$val" yq -i "(.${yaml_path}) = strenv(VAL)" "$OUT_VALUES"
done

# -----------------------------------------------------------------------------
# 4. Write values.secret.yaml — just the keys the chart needs as secrets.
# -----------------------------------------------------------------------------
log "writing $OUT_SECRETS (mode 0600)..."
umask 077

JWT="$(sec_get JWT_SECRET_KEY)"
[[ -n "$JWT" ]] || die "JWT_SECRET_KEY missing from Linode secret '$LINODE_SECRET_NAME' -- CANNOT proceed (would invalidate all sessions)"

cat > "$OUT_SECRETS" <<EOF
# =============================================================================
# values.secret.yaml -- GENERATED by export-linode-prod-config.sh
#
# DO NOT COMMIT. DO NOT EDIT BY HAND unless you know which fields the Java
# services have hardcoded fallbacks for (jwtSecretKey, internalClientSecret).
#
# Regenerate by re-running: bash export-linode-prod-config.sh
# Source of truth: kubectl --context $LINODE_KUBE_CONTEXT -n $LINODE_NAMESPACE
#                  secret/$LINODE_SECRET_NAME
# =============================================================================

pgbouncer:
  dbPassword: $(sec_get VACADEMY_DB_PASSWORD | yq -r '. | @json' || true)

secrets:
  jwtSecretKey: $(printf '%s' "$JWT" | yq -r '. | @json')
  internalClientSecret: $(sec_get INTERNAL_CLIENT_SECRET | yq -r '. | @json' || true)

  s3:
    accessKey: $(sec_get S3_ACCESS_KEY | yq -r '. | @json' || true)
    secretKey: $(sec_get S3_SECRET_KEY | yq -r '. | @json' || true)

  ses:
    accessKey: $(sec_get SES_ACCESS_KEY | yq -r '. | @json' || true)
    secretKey: $(sec_get SES_SECRET_KEY | yq -r '. | @json' || true)

  sqs:
    accessKey: $(sec_get SQS_ACCESS_KEY | yq -r '. | @json' || true)
    secretKey: $(sec_get SQS_SECRET_KEY | yq -r '. | @json' || true)

  oauth:
    googleClientId: $(sec_get GOOGLE_CLIENT_ID | yq -r '. | @json' || true)
    googleClientSecret: $(sec_get GOOGLE_CLIENT_SECRET | yq -r '. | @json' || true)
    githubClientId: $(sec_get GITHUB_CLIENT_ID | yq -r '. | @json' || true)
    githubClientSecret: $(sec_get GITHUB_CLIENT_SECRET | yq -r '. | @json' || true)

  api:
    openaiApiKey: $(sec_get OPENAI_API_KEY | yq -r '. | @json' || true)
    anthropicApiKey: $(sec_get ANTHROPIC_API_KEY | yq -r '. | @json' || true)
    deepgramApiKey: $(sec_get DEEPGRAM_API_KEY | yq -r '. | @json' || true)
    razorpayKeyId: $(sec_get RAZORPAY_KEY_ID | yq -r '. | @json' || true)
    razorpayKeySecret: $(sec_get RAZORPAY_KEY_SECRET | yq -r '. | @json' || true)
    twilioAccountSid: $(sec_get TWILIO_ACCOUNT_SID | yq -r '. | @json' || true)
    twilioAuthToken: $(sec_get TWILIO_AUTH_TOKEN | yq -r '. | @json' || true)
    sentryDsn: $(sec_get SENTRY_DSN | yq -r '. | @json' || true)
    posthogApiKey: $(sec_get POSTHOG_API_KEY | yq -r '. | @json' || true)
EOF
chmod 0600 "$OUT_SECRETS"

# -----------------------------------------------------------------------------
# 5. Report any remaining REPLACE_* tokens — these are things the live CM
#    doesn't carry (e.g. certManager.email) and must be hand-filled.
# -----------------------------------------------------------------------------
log ""
log "remaining REPLACE_* tokens in $OUT_VALUES (fill by hand):"
if grep -nE 'REPLACE(_|$)' "$OUT_VALUES" >&2; then
  log ""
  log "  ^^ these are fields not present in the live ConfigMap. Common ones:"
  log "      certManager.email (ops contact for Let's Encrypt)"
  log "      env.s3.publicBucket (if the live CM uses a different key)"
else
  log "  (none -- $OUT_VALUES is fully populated)"
fi

# -----------------------------------------------------------------------------
# 6. Final sanity print -- show first 12 chars of jwtSecretKey so the operator
#    can compare against `kubectl ... get secret -o jsonpath` without leaking
#    the full value to logs.
# -----------------------------------------------------------------------------
log ""
log "DONE."
log "  jwtSecretKey fingerprint (first 12 chars): ${JWT:0:12}..."
log "  Verify it matches the live cluster:"
log "    kubectl --context $LINODE_KUBE_CONTEXT -n $LINODE_NAMESPACE \\"
log "      get secret $LINODE_SECRET_NAME -o jsonpath='{.data.JWT_SECRET_KEY}' | base64 -d | head -c12; echo"
log ""
log "  Then stash $OUT_SECRETS somewhere only the Sunday driver can reach"
log "  (e.g. 1Password, sealed-secrets, or an encrypted USB). DO NOT commit."
