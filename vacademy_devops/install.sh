#!/usr/bin/env bash
#
# Vacademy standalone single-server installer.
#
# Brings up the full stack on ONE Linux server using k3s (single-node Kubernetes):
#   - installs k3s + Helm + cert-manager (idempotent; skips what's present)
#   - prompts for domain, Let's Encrypt email, which optional services to run,
#     and the client's own cloud keys (S3 required for media; others optional)
#   - generates per-install DB / app / JWT secrets
#   - writes values.secret.yaml and deploys the chart (bundled Postgres + frontends)
#
# Re-runnable: re-run to change enabled services or rotate keys (it reuses an
# existing values.secret.yaml unless you choose to regenerate).
#
# Usage:  sudo ./install.sh
set -euo pipefail

HERE="$(cd "$(dirname "$0")" && pwd)"
CHART="$HERE/vacademy-services"
SECRET_FILE="$CHART/values.secret.yaml"
RELEASE="vacademy"
export KUBECONFIG="${KUBECONFIG:-/etc/rancher/k3s/k3s.yaml}"

c_info()  { printf '\033[0;34m[*]\033[0m %s\n' "$*"; }
c_ok()    { printf '\033[0;32m[+]\033[0m %s\n' "$*"; }
c_warn()  { printf '\033[0;33m[!]\033[0m %s\n' "$*"; }
c_err()   { printf '\033[0;31m[x]\033[0m %s\n' "$*" >&2; }
die()     { c_err "$*"; exit 1; }
ask()     { local p="$1" d="${2:-}" v; if [ -n "$d" ]; then read -r -p "$p [$d]: " v; echo "${v:-$d}"; else read -r -p "$p: " v; echo "$v"; fi; }
ask_yn()  { local p="$1" d="${2:-n}" v; read -r -p "$p ($([ "$d" = y ] && echo 'Y/n' || echo 'y/N')): " v; v="${v:-$d}"; [ "${v,,}" = y ] || [ "${v,,}" = yes ]; }

[ "$(id -u)" = 0 ] || die "Run as root (sudo ./install.sh) — k3s install needs it."

# --- 1. Pre-flight -----------------------------------------------------------
TOTAL_MB=$(free -m 2>/dev/null | awk '/^Mem:/{print $2}' || echo 0)
if [ "$TOTAL_MB" -gt 0 ] && [ "$TOTAL_MB" -lt 7500 ]; then
  c_warn "Detected ${TOTAL_MB}MB RAM. Mandatory tier wants ~8GB; full stack ~16GB."
  ask_yn "Continue anyway?" n || exit 1
fi

# --- 2. k3s ------------------------------------------------------------------
if ! command -v k3s >/dev/null 2>&1; then
  c_info "Installing k3s (single-node Kubernetes)..."
  curl -sfL https://get.k3s.io | sh -
  c_ok "k3s installed."
else
  c_ok "k3s already present."
fi
until kubectl get nodes >/dev/null 2>&1; do c_info "waiting for k3s API..."; sleep 3; done

# CoreDNS: forward to public resolvers. k3s CoreDNS forwards to the node's
# /etc/resolv.conf, which negative-caches NXDOMAIN during the window before the
# client's DNS records exist — that blocks cert-manager's HTTP-01 self-check and
# stalls TLS issuance. Pointing at public resolvers avoids the stale cache.
if kubectl -n kube-system get cm coredns >/dev/null 2>&1 \
   && kubectl -n kube-system get cm coredns -o jsonpath='{.data.Corefile}' | grep -q 'forward . /etc/resolv.conf'; then
  c_info "Pointing CoreDNS at public resolvers (1.1.1.1 / 8.8.8.8)..."
  kubectl -n kube-system get cm coredns -o yaml > /tmp/coredns.yaml
  sed -i 's#forward \. /etc/resolv.conf#forward . 1.1.1.1 8.8.8.8#' /tmp/coredns.yaml
  kubectl apply -f /tmp/coredns.yaml >/dev/null
  kubectl -n kube-system rollout restart deploy/coredns >/dev/null 2>&1 || true
  c_ok "CoreDNS updated."
fi

# --- 3. Helm -----------------------------------------------------------------
if ! command -v helm >/dev/null 2>&1; then
  c_info "Installing Helm..."
  curl -fsSL https://raw.githubusercontent.com/helm/helm/main/scripts/get-helm-3 | bash
  c_ok "Helm installed."
else
  c_ok "Helm already present."
fi

# --- 4. cert-manager ---------------------------------------------------------
if ! kubectl get ns cert-manager >/dev/null 2>&1; then
  c_info "Installing cert-manager..."
  helm repo add jetstack https://charts.jetstack.io >/dev/null 2>&1 || true
  helm repo update >/dev/null
  helm install cert-manager jetstack/cert-manager \
    --namespace cert-manager --create-namespace \
    --set crds.enabled=true --wait
  c_ok "cert-manager installed."
else
  c_ok "cert-manager already present."
fi

# --- 5. Configuration --------------------------------------------------------
if [ -f "$SECRET_FILE" ] && ask_yn "Found existing values.secret.yaml — reuse it?" y; then
  c_ok "Reusing $SECRET_FILE"
else
  c_info "Let's configure this install."
  DOMAIN=$(ask "Base domain (you'll point admin.<domain> and app.<domain> here)")
  [ -n "$DOMAIN" ] || die "domain is required"
  LE_EMAIL=$(ask "Email for Let's Encrypt (TLS) notices")
  [ -n "$LE_EMAIL" ] || die "email is required"

  c_info "Optional services (mandatory auth/admin-core/media are always on):"
  EN_ASSESS=false; ask_yn "  Enable assessment-service?" n && EN_ASSESS=true
  EN_NOTIF=false;  c_warn "  notification-service is required for email/WhatsApp OTP login."
  ask_yn "  Enable notification-service?" y && EN_NOTIF=true
  EN_AI=false;     ask_yn "  Enable ai-service? (needs ~3GB RAM)" n && EN_AI=true
  EN_COMM=false;   ask_yn "  Enable community-service?" n && EN_COMM=true

  c_info "Client cloud keys (media needs S3; leave blank to fill later in $SECRET_FILE):"
  S3_KEY=$(ask "  AWS S3 access key")
  S3_SECRET=$(ask "  AWS S3 access secret")
  S3_REGION=$(ask "  AWS region" "ap-south-1")
  S3_BUCKET=$(ask "  S3 bucket name")
  S3_PUBLIC=$(ask "  S3 public bucket name" "$S3_BUCKET")
  OPENROUTER=""
  if [ "$EN_AI" = true ]; then OPENROUTER=$(ask "  OpenRouter API key (ai-service)"); fi

  # Auto-generated, install-specific secrets.
  # NOTE: jwtSecretKey is intentionally NOT randomized — the Java services hardcode
  # it (JwtService.java) and ignore the env, so it must stay the chart default
  # (=the hardcoded value) or ai-service can't validate tokens.
  DB_PASS=$(openssl rand -hex 24)
  APP_PASS=$(openssl rand -hex 16)
  INTERNAL_CLIENT_SECRET=$(openssl rand -hex 24)

  c_info "Writing $SECRET_FILE ..."
  cat > "$SECRET_FILE" <<YAML
# Generated by install.sh on $(date -u +%FT%TZ). GITIGNORED — never commit.
standalone:
  domain: "$DOMAIN"
certManager:
  email: "$LE_EMAIL"
services:
  assessment_service: { enabled: $EN_ASSESS }
  notification_service: { enabled: $EN_NOTIF }
  ai_service: { enabled: $EN_AI }
  community_service: { enabled: $EN_COMM }
env:
  s3:
    region: "$S3_REGION"
    bucket: "$S3_BUCKET"
    publicBucket: "$S3_PUBLIC"
  # media serves from this box; point the CDN var at the media-service path
  cloudFrontUrl: "https://app.$DOMAIN/media-service/media/"
secrets:
  dbPassword: "$DB_PASS"
  appPassword: "$APP_PASS"
  # jwtSecretKey omitted on purpose -> uses the chart default (the value Java hardcodes).
  internalClientSecret: "$INTERNAL_CLIENT_SECRET"
  s3:
    accessKey: "$S3_KEY"
    accessSecret: "$S3_SECRET"
  api:
    openrouter: "$OPENROUTER"
  ai:
    clientName: ai_service
  # Fill these if you enabled notification (email/OTP) or want OAuth login:
  ses: { mailUsername: "", mailPassword: "" }
  sqs: { accessKey: "", secretKey: "" }
  oauth: { googleClientId: "", googleClientSecret: "", githubClientId: "", githubClientSecret: "" }
YAML
  chmod 600 "$SECRET_FILE"
  c_ok "Wrote $SECRET_FILE (DB/JWT/app secrets auto-generated)."
fi

# --- 6. Deploy ---------------------------------------------------------------
c_info "Deploying chart (this pulls images and may take several minutes)..."
helm upgrade --install "$RELEASE" "$CHART" \
  -f "$CHART/values.yaml" \
  -f "$CHART/values-standalone.yaml" \
  -f "$SECRET_FILE" \
  --wait --timeout 15m

DOMAIN=$(grep -E '^\s*domain:' "$SECRET_FILE" | head -1 | sed 's/.*domain:\s*//; s/"//g')
NODE_IP=$(kubectl get nodes -o jsonpath='{.items[0].status.addresses[?(@.type=="ExternalIP")].address}' 2>/dev/null)
[ -n "$NODE_IP" ] || NODE_IP=$(kubectl get nodes -o jsonpath='{.items[0].status.addresses[?(@.type=="InternalIP")].address}')

c_ok "Deployed."
echo
echo "=================================================================="
echo " Point these DNS A-records at this server, then TLS issues itself:"
echo "   admin.$DOMAIN   ->  $NODE_IP   (admin dashboard)"
echo "   app.$DOMAIN     ->  $NODE_IP   (learner app + API)"
echo
echo " Watch rollout:   kubectl get pods -w"
echo " Watch TLS:       kubectl get certificate"
echo "=================================================================="
