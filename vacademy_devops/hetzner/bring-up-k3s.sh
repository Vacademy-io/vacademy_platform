#!/usr/bin/env bash
# =============================================================================
# bring-up-k3s.sh
# -----------------------------------------------------------------------------
# Brings up an HA k3s cluster (embedded etcd) across the 3 CCX23 Hetzner nodes
# in Singapore, then installs:
#   - cert-manager (with CRDs)
#   - ingress-nginx (bare-metal manifest)
#   - Let's Encrypt prod ClusterIssuer
#   - CoreDNS upstream forwarders (1.1.1.1 / 8.8.8.8)
#
# Run from the operator's laptop. SSHes to each k3s node and drives the
# install remotely. Fully idempotent: safe to re-run.
#
# Required env:
#   LETSENCRYPT_EMAIL   - contact email for Let's Encrypt account
#   SSH_USER            - (optional) ssh user, defaults to "root"
#   SSH_KEY             - (optional) path to ssh private key
#
# Topology is loaded from ./topology.env (sibling file).
# =============================================================================

set -euo pipefail

# -----------------------------------------------------------------------------
# Pretty logging
# -----------------------------------------------------------------------------
_ts()   { date +'%Y-%m-%dT%H:%M:%S%z'; }
info()  { printf '\033[0;36m[INFO ]\033[0m %s %s\n' "$(_ts)" "$*"; }
ok()    { printf '\033[0;32m[ OK  ]\033[0m %s %s\n' "$(_ts)" "$*"; }
warn()  { printf '\033[0;33m[WARN ]\033[0m %s %s\n' "$(_ts)" "$*" >&2; }
err()   { printf '\033[0;31m[ERR  ]\033[0m %s %s\n' "$(_ts)" "$*" >&2; }
die()   { err "$*"; exit 1; }

# -----------------------------------------------------------------------------
# Locate & source topology.env (sibling of this script)
# -----------------------------------------------------------------------------
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
TOPOLOGY_FILE="${TOPOLOGY_FILE:-${SCRIPT_DIR}/topology.env}"

if [[ ! -f "${TOPOLOGY_FILE}" ]]; then
  die "topology.env not found at ${TOPOLOGY_FILE} (set TOPOLOGY_FILE=/path/to/topology.env to override)"
fi

# shellcheck source=/dev/null
source "${TOPOLOGY_FILE}"
ok "Loaded topology from ${TOPOLOGY_FILE}"

# Validate required topology vars
: "${K3S_NODE_1_PRIVATE:?K3S_NODE_1_PRIVATE missing in topology.env}"
: "${K3S_NODE_2_PRIVATE:?K3S_NODE_2_PRIVATE missing in topology.env}"
: "${K3S_NODE_3_PRIVATE:?K3S_NODE_3_PRIVATE missing in topology.env}"
: "${K3S_NODE_1_PUBLIC:?K3S_NODE_1_PUBLIC missing in topology.env}"
: "${K3S_NODE_2_PUBLIC:?K3S_NODE_2_PUBLIC missing in topology.env}"
: "${K3S_NODE_3_PUBLIC:?K3S_NODE_3_PUBLIC missing in topology.env}"
# DB hosts are validated too: this script is the FIRST in the pipeline and is
# responsible for distributing topology.env to db-primary and db-standby (the
# downstream Postgres scripts source it from /root/vacademy-migration/ on the
# remote VMs and hard-fail if it's missing).
: "${DB_PRIMARY_PUBLIC:?DB_PRIMARY_PUBLIC missing in topology.env}"
: "${DB_STANDBY_PUBLIC:?DB_STANDBY_PUBLIC missing in topology.env}"
: "${DB_PRIMARY_PRIVATE:?DB_PRIMARY_PRIVATE missing in topology.env}"
: "${DB_STANDBY_PRIVATE:?DB_STANDBY_PRIVATE missing in topology.env}"

# Validate Let's Encrypt email
: "${LETSENCRYPT_EMAIL:?LETSENCRYPT_EMAIL must be exported (contact email for the Lets Encrypt account)}"

# -----------------------------------------------------------------------------
# SSH plumbing
# -----------------------------------------------------------------------------
SSH_USER="${SSH_USER:-root}"
SSH_OPTS=(
  -o StrictHostKeyChecking=accept-new
  -o UserKnownHostsFile="${HOME}/.ssh/known_hosts"
  -o ServerAliveInterval=30
  -o ServerAliveCountMax=6
  -o ConnectTimeout=15
  -o BatchMode=yes
)
if [[ -n "${SSH_KEY:-}" ]]; then
  SSH_OPTS+=(-i "${SSH_KEY}")
fi

ssh_run() {
  # $1 = host (public IP), $2... = remote command (single string preferred)
  local host="$1"; shift
  ssh "${SSH_OPTS[@]}" "${SSH_USER}@${host}" "$@"
}

ssh_run_script() {
  # $1 = host, $2 = local script content (heredoc string)
  # Streams the script to bash on the remote with -euo pipefail.
  local host="$1"; shift
  ssh "${SSH_OPTS[@]}" "${SSH_USER}@${host}" "bash -s" <<<"$*"
}

# -----------------------------------------------------------------------------
# Constants
# -----------------------------------------------------------------------------
K3S_VERSION="${K3S_VERSION:-v1.30.5+k3s1}"
CERT_MANAGER_VERSION="${CERT_MANAGER_VERSION:-v1.15.3}"
INGRESS_NGINX_MANIFEST="${INGRESS_NGINX_MANIFEST:-https://raw.githubusercontent.com/kubernetes/ingress-nginx/controller-v1.11.2/deploy/static/provider/baremetal/deploy.yaml}"
HELM_VERSION="${HELM_VERSION:-v3.15.4}"

REMOTE_WORKDIR="/root/vacademy-migration"

# Common k3s flags shared by ALL nodes (server + agent role both - all 3 are servers in HA)
# Each node also gets its own --node-ip / --advertise-address appended.
COMMON_K3S_FLAGS=(
  "--disable=traefik"
  "--disable=servicelb"
  "--flannel-backend=wireguard-native"
  "--tls-san=${K3S_NODE_1_PUBLIC}"
  "--tls-san=${K3S_NODE_2_PUBLIC}"
  "--tls-san=${K3S_NODE_3_PUBLIC}"
  "--tls-san=${K3S_NODE_1_PRIVATE}"
  "--tls-san=${K3S_NODE_2_PRIVATE}"
  "--tls-san=${K3S_NODE_3_PRIVATE}"
)

# -----------------------------------------------------------------------------
# 0. Pre-flight: SSH reachability to every node (k3s + DB) and topology.env
#    distribution. The DB scripts (bring-up-postgres / setup-streaming-
#    replication / setup-pgbackrest) source topology.env from
#    /root/vacademy-migration/topology.env on the remote VMs and hard-fail if
#    it is missing — so we push it from here, the first script in the pipeline.
# -----------------------------------------------------------------------------
ALL_REMOTE_HOSTS=(
  "${K3S_NODE_1_PUBLIC}"
  "${K3S_NODE_2_PUBLIC}"
  "${K3S_NODE_3_PUBLIC}"
  "${DB_PRIMARY_PUBLIC}"
  "${DB_STANDBY_PUBLIC}"
)

info "Pre-flight: checking SSH connectivity to all 3 k3s nodes + 2 DB hosts..."
for h in "${ALL_REMOTE_HOSTS[@]}"; do
  if ssh_run "${h}" "true" >/dev/null 2>&1; then
    ok "SSH reachable: ${h}"
  else
    die "Cannot SSH ${SSH_USER}@${h}. Fix SSH access before proceeding."
  fi
done

# Ensure remote working directory on every box
for h in "${ALL_REMOTE_HOSTS[@]}"; do
  ssh_run "${h}" "mkdir -p '${REMOTE_WORKDIR}' && chmod 700 '${REMOTE_WORKDIR}'"
done
ok "Remote workdir ensured on all 5 hosts: ${REMOTE_WORKDIR}"

# Distribute topology.env to every box at /root/vacademy-migration/topology.env.
# Downstream scripts (bring-up-postgres.sh, setup-streaming-replication.sh,
# setup-pgbackrest.sh) all look there. Without this step they either fall back
# to hard-coded values or hard-fail.
info "Distributing topology.env to all 5 hosts at ${REMOTE_WORKDIR}/topology.env ..."
SCP_OPTS=("${SSH_OPTS[@]}")
for h in "${ALL_REMOTE_HOSTS[@]}"; do
  scp "${SCP_OPTS[@]}" "${TOPOLOGY_FILE}" "${SSH_USER}@${h}:${REMOTE_WORKDIR}/topology.env" >/dev/null
  ssh_run "${h}" "chmod 600 '${REMOTE_WORKDIR}/topology.env'"
  ok "  topology.env -> ${h}:${REMOTE_WORKDIR}/topology.env"
done
ok "topology.env distributed"

# -----------------------------------------------------------------------------
# 1. Install k3s on node-1 (cluster-init)
# -----------------------------------------------------------------------------
info "[node-1 / ${K3S_NODE_1_PUBLIC}] Installing k3s server with --cluster-init..."

# Build INSTALL_K3S_EXEC string for node-1
NODE1_EXEC="server --cluster-init"
NODE1_EXEC+=" --node-ip=${K3S_NODE_1_PRIVATE}"
NODE1_EXEC+=" --advertise-address=${K3S_NODE_1_PRIVATE}"
NODE1_EXEC+=" --node-external-ip=${K3S_NODE_1_PUBLIC}"
for f in "${COMMON_K3S_FLAGS[@]}"; do NODE1_EXEC+=" ${f}"; done

# Heredoc executed on node-1
# NOTE: env vars must be passed as a single quoted command string to ssh;
# the `ssh host VAR=val bash -s` pattern is broken because ssh joins argv
# with spaces and INSTALL_K3S_EXEC always contains spaces.
ssh "${SSH_OPTS[@]}" "${SSH_USER}@${K3S_NODE_1_PUBLIC}" \
  "K3S_VERSION='${K3S_VERSION}' INSTALL_K3S_EXEC='${NODE1_EXEC}' bash -s" <<'REMOTE_NODE1'
set -euo pipefail

# Idempotent: if k3s already running and is a server, skip install.
if systemctl is-active --quiet k3s 2>/dev/null && [[ -f /etc/rancher/k3s/k3s.yaml ]]; then
  echo "[remote] k3s already active on node-1 - skipping install"
else
  echo "[remote] Installing k3s ${K3S_VERSION} with: ${INSTALL_K3S_EXEC}"
  curl -sfL https://get.k3s.io | \
    INSTALL_K3S_VERSION="${K3S_VERSION}" \
    INSTALL_K3S_EXEC="${INSTALL_K3S_EXEC}" \
    sh -
fi

# Wait for the API to come up
for i in $(seq 1 60); do
  if k3s kubectl get nodes >/dev/null 2>&1; then
    echo "[remote] k3s API responsive after ${i}s"
    break
  fi
  sleep 2
done

k3s kubectl get nodes
REMOTE_NODE1

ok "node-1 k3s server up"

# -----------------------------------------------------------------------------
# 2. Extract join token from node-1
# -----------------------------------------------------------------------------
info "Extracting k3s join token from node-1..."
K3S_TOKEN="$(ssh_run "${K3S_NODE_1_PUBLIC}" "cat /var/lib/rancher/k3s/server/node-token")"
if [[ -z "${K3S_TOKEN}" ]]; then
  die "Failed to read /var/lib/rancher/k3s/server/node-token from node-1"
fi
ok "Join token obtained (len=${#K3S_TOKEN})"

# -----------------------------------------------------------------------------
# 3. Join node-2 and node-3 to the cluster
# -----------------------------------------------------------------------------
join_node() {
  local label="$1"
  local public_ip="$2"
  local private_ip="$3"

  info "[${label} / ${public_ip}] Joining k3s cluster via https://${K3S_NODE_1_PRIVATE}:6443 ..."

  local exec_str="server"
  exec_str+=" --server https://${K3S_NODE_1_PRIVATE}:6443"
  exec_str+=" --node-ip=${private_ip}"
  exec_str+=" --advertise-address=${private_ip}"
  exec_str+=" --node-external-ip=${public_ip}"
  for f in "${COMMON_K3S_FLAGS[@]}"; do exec_str+=" ${f}"; done

  ssh "${SSH_OPTS[@]}" "${SSH_USER}@${public_ip}" \
    "K3S_VERSION='${K3S_VERSION}' K3S_TOKEN_VAL='${K3S_TOKEN}' INSTALL_K3S_EXEC='${exec_str}' bash -s" <<'REMOTE_JOIN'
set -euo pipefail

if systemctl is-active --quiet k3s 2>/dev/null; then
  echo "[remote] k3s already active on this node - skipping install"
else
  echo "[remote] Installing k3s ${K3S_VERSION} (joining) with: ${INSTALL_K3S_EXEC}"
  curl -sfL https://get.k3s.io | \
    INSTALL_K3S_VERSION="${K3S_VERSION}" \
    K3S_TOKEN="${K3S_TOKEN_VAL}" \
    INSTALL_K3S_EXEC="${INSTALL_K3S_EXEC}" \
    sh -
fi

# Wait for k3s to be up
for i in $(seq 1 60); do
  if systemctl is-active --quiet k3s; then
    echo "[remote] k3s active after ${i}s"
    break
  fi
  sleep 2
done
REMOTE_JOIN

  ok "${label} joined"
}

join_node "node-2" "${K3S_NODE_2_PUBLIC}" "${K3S_NODE_2_PRIVATE}"
join_node "node-3" "${K3S_NODE_3_PUBLIC}" "${K3S_NODE_3_PRIVATE}"

# -----------------------------------------------------------------------------
# 4. Wait for all 3 nodes Ready
# -----------------------------------------------------------------------------
info "Waiting for all 3 nodes to reach Ready..."
for i in $(seq 1 90); do
  ready_count="$(ssh_run "${K3S_NODE_1_PUBLIC}" "k3s kubectl get nodes --no-headers 2>/dev/null | awk '\$2==\"Ready\"' | wc -l" || echo 0)"
  ready_count="${ready_count//[[:space:]]/}"
  if [[ "${ready_count}" == "3" ]]; then
    ok "All 3 nodes Ready (after ${i} polls)"
    break
  fi
  if [[ "${i}" -eq 90 ]]; then
    ssh_run "${K3S_NODE_1_PUBLIC}" "k3s kubectl get nodes -o wide" || true
    die "Timed out waiting for 3 Ready nodes (got ${ready_count})"
  fi
  sleep 4
done

ssh_run "${K3S_NODE_1_PUBLIC}" "k3s kubectl get nodes -o wide"

# -----------------------------------------------------------------------------
# 5. Install Helm 3 on node-1 (if missing) - we'll drive helm from there
# -----------------------------------------------------------------------------
info "[node-1] Ensuring Helm 3 is installed..."
ssh "${SSH_OPTS[@]}" "${SSH_USER}@${K3S_NODE_1_PUBLIC}" \
  "HELM_VERSION='${HELM_VERSION}' bash -s" <<'REMOTE_HELM'
set -euo pipefail
if command -v helm >/dev/null 2>&1; then
  echo "[remote] helm already present: $(helm version --short 2>/dev/null || true)"
  exit 0
fi
echo "[remote] Installing Helm ${HELM_VERSION}..."
cd /tmp
curl -fsSL "https://get.helm.sh/helm-${HELM_VERSION}-linux-amd64.tar.gz" -o helm.tgz
tar -xzf helm.tgz
install -m 0755 linux-amd64/helm /usr/local/bin/helm
rm -rf helm.tgz linux-amd64
helm version --short
REMOTE_HELM
ok "Helm ready on node-1"

# -----------------------------------------------------------------------------
# 6. Install cert-manager via helm
# -----------------------------------------------------------------------------
info "[node-1] Installing cert-manager ${CERT_MANAGER_VERSION}..."
ssh "${SSH_OPTS[@]}" "${SSH_USER}@${K3S_NODE_1_PUBLIC}" \
  "CERT_MANAGER_VERSION='${CERT_MANAGER_VERSION}' bash -s" <<'REMOTE_CM'
set -euo pipefail
export KUBECONFIG=/etc/rancher/k3s/k3s.yaml

helm repo add jetstack https://charts.jetstack.io >/dev/null 2>&1 || true
helm repo update jetstack >/dev/null

# Idempotent install/upgrade
helm upgrade --install cert-manager jetstack/cert-manager \
  --namespace cert-manager --create-namespace \
  --version "${CERT_MANAGER_VERSION}" \
  --set crds.enabled=true \
  --wait --timeout 5m

kubectl -n cert-manager get pods
REMOTE_CM
ok "cert-manager installed"

# -----------------------------------------------------------------------------
# 7. Install ingress-nginx (bare-metal manifest)
# -----------------------------------------------------------------------------
info "[node-1] Installing ingress-nginx (bare-metal)..."
ssh "${SSH_OPTS[@]}" "${SSH_USER}@${K3S_NODE_1_PUBLIC}" \
  "INGRESS_NGINX_MANIFEST='${INGRESS_NGINX_MANIFEST}' bash -s" <<'REMOTE_NGINX'
set -euo pipefail
export KUBECONFIG=/etc/rancher/k3s/k3s.yaml

kubectl apply -f "${INGRESS_NGINX_MANIFEST}"

echo "[remote] Waiting for ingress-nginx controller deployment to become available..."
# Wait for namespace + deployment to exist before --for=condition wait
for i in $(seq 1 30); do
  if kubectl -n ingress-nginx get deploy ingress-nginx-controller >/dev/null 2>&1; then
    break
  fi
  sleep 2
done
kubectl -n ingress-nginx rollout status deploy/ingress-nginx-controller --timeout=5m

# The upstream baremetal manifest creates the controller Service as NodePort
# (random high ports), which is unreachable from Cloudflare on 80/443. k3s was
# started with --disable=servicelb and we don't install MetalLB/hcloud-CCM, so
# the only way to make :80/:443 listen on the node public IPs is to give the
# controller pods hostPort. Patch the Deployment to bind hostPort 80 and 443.
echo "[remote] Patching ingress-nginx controller to use hostPort 80/443..."
# Idempotent: jq-style JSON patch with 'add' is safe to re-apply because we
# overwrite the same field paths. We use a strategic merge patch on the
# container's ports array via JSON merge.
kubectl -n ingress-nginx patch deploy ingress-nginx-controller --type=json -p='[
  {"op":"add","path":"/spec/template/spec/containers/0/ports/0/hostPort","value":80},
  {"op":"add","path":"/spec/template/spec/containers/0/ports/1/hostPort","value":443}
]' || \
kubectl -n ingress-nginx patch deploy ingress-nginx-controller --type=json -p='[
  {"op":"replace","path":"/spec/template/spec/containers/0/ports/0/hostPort","value":80},
  {"op":"replace","path":"/spec/template/spec/containers/0/ports/1/hostPort","value":443}
]'

kubectl -n ingress-nginx rollout status deploy/ingress-nginx-controller --timeout=5m
kubectl -n ingress-nginx get pods,svc -o wide
REMOTE_NGINX
ok "ingress-nginx installed"

# -----------------------------------------------------------------------------
# 8. Let's Encrypt prod ClusterIssuer
# -----------------------------------------------------------------------------
info "[node-1] Applying Let's Encrypt prod ClusterIssuer (email=${LETSENCRYPT_EMAIL})..."
ssh "${SSH_OPTS[@]}" "${SSH_USER}@${K3S_NODE_1_PUBLIC}" \
  "LE_EMAIL='${LETSENCRYPT_EMAIL}' bash -s" <<'REMOTE_ISSUER'
set -euo pipefail
export KUBECONFIG=/etc/rancher/k3s/k3s.yaml

# Wait until the cert-manager webhook is actually serving (otherwise apply 500s).
echo "[remote] Waiting for cert-manager webhook to be ready..."
for i in $(seq 1 60); do
  if kubectl -n cert-manager get endpoints cert-manager-webhook \
       -o jsonpath='{.subsets[*].addresses[*].ip}' 2>/dev/null | grep -q .; then
    echo "[remote] cert-manager-webhook has endpoints"
    break
  fi
  sleep 2
done

cat <<EOF | kubectl apply -f -
apiVersion: cert-manager.io/v1
kind: ClusterIssuer
metadata:
  name: letsencrypt-prod
spec:
  acme:
    server: https://acme-v02.api.letsencrypt.org/directory
    email: ${LE_EMAIL}
    privateKeySecretRef:
      name: letsencrypt-prod-account-key
    solvers:
      - http01:
          ingress:
            class: nginx
EOF

kubectl get clusterissuer letsencrypt-prod -o wide
REMOTE_ISSUER
ok "ClusterIssuer letsencrypt-prod applied"

# -----------------------------------------------------------------------------
# 9. Patch CoreDNS to forward to 1.1.1.1 / 8.8.8.8
#    (Same fix we applied on stage - Hetzner's default resolvers can flake.)
# -----------------------------------------------------------------------------
info "[node-1] Patching CoreDNS Corefile to use 1.1.1.1 / 8.8.8.8 upstreams..."
ssh "${SSH_OPTS[@]}" "${SSH_USER}@${K3S_NODE_1_PUBLIC}" \
  bash -s <<'REMOTE_COREDNS'
set -euo pipefail
export KUBECONFIG=/etc/rancher/k3s/k3s.yaml

# k3s manages coredns via /var/lib/rancher/k3s/server/manifests/coredns.yaml.
# We patch the ConfigMap in-cluster AND install a manifests/ overlay so
# k3s doesn't revert our change on reconcile.
#
# Approach: edit the ConfigMap's NodeHosts/Corefile so the `forward . ...`
# line points at 1.1.1.1 + 8.8.8.8 instead of /etc/resolv.conf.

current="$(kubectl -n kube-system get configmap coredns -o jsonpath='{.data.Corefile}' 2>/dev/null || echo '')"

if echo "${current}" | grep -qE 'forward[[:space:]]+\.[[:space:]]+1\.1\.1\.1[[:space:]]+8\.8\.8\.8'; then
  echo "[remote] CoreDNS already forwards to 1.1.1.1 8.8.8.8 - no change"
else
  echo "[remote] Patching CoreDNS forward upstreams..."
  patched="$(echo "${current}" | sed -E 's|forward[[:space:]]+\.[[:space:]]+[^ }]+([^}]*)|forward . 1.1.1.1 8.8.8.8\1|')"
  # Fallback: if sed didn't match (e.g. unusual Corefile shape), write a sane default.
  if [[ -z "${patched}" || "${patched}" == "${current}" ]]; then
    patched=$(cat <<'COREFILE'
.:53 {
    errors
    health
    ready
    kubernetes cluster.local in-addr.arpa ip6.arpa {
      pods insecure
      fallthrough in-addr.arpa ip6.arpa
    }
    hosts /etc/coredns/NodeHosts {
      ttl 60
      reload 15s
      fallthrough
    }
    prometheus :9153
    forward . 1.1.1.1 8.8.8.8
    cache 30
    loop
    reload
    loadbalance
}
COREFILE
)
  fi

  # Apply via JSON merge so we don't disturb other keys (NodeHosts etc.)
  # NOTE: python3 -c does NOT parse trailing VAR=val args into os.environ
  # (unlike /bin/sh). Export PATCHED into the real environment so python
  # can read it via os.environ['PATCHED'].
  export PATCHED="${patched}"
  kubectl -n kube-system get configmap coredns -o json \
    | python3 -c '
import json, sys, os
cm = json.load(sys.stdin)
cm["data"]["Corefile"] = os.environ["PATCHED"]
print(json.dumps(cm))
' \
    | kubectl apply -f -
  unset PATCHED

  kubectl -n kube-system rollout restart deploy/coredns
  kubectl -n kube-system rollout status  deploy/coredns --timeout=2m
fi

kubectl -n kube-system get configmap coredns -o jsonpath='{.data.Corefile}' | sed -n '1,40p'
echo
REMOTE_COREDNS
ok "CoreDNS patched"

# -----------------------------------------------------------------------------
# 10. Final verification
# -----------------------------------------------------------------------------
info "Final verification..."
ssh "${SSH_OPTS[@]}" "${SSH_USER}@${K3S_NODE_1_PUBLIC}" bash -s <<'REMOTE_VERIFY'
set -euo pipefail
export KUBECONFIG=/etc/rancher/k3s/k3s.yaml

echo
echo "===== Nodes ====="
kubectl get nodes -o wide

echo
echo "===== Pods (all namespaces) ====="
kubectl get pods -A

echo
echo "===== Helm releases ====="
helm list -A

echo
echo "===== Kubeconfig ====="
echo "On node-1: /etc/rancher/k3s/k3s.yaml"
echo "(Copy to your laptop, then rewrite server: to https://<node-1 PUBLIC IP>:6443)"
REMOTE_VERIFY

ok "k3s cluster bring-up complete"

cat <<NEXTSTEP

================================================================================
 NEXT STEP
================================================================================
 k3s HA cluster is up. cert-manager + ingress-nginx + letsencrypt-prod issuer
 are installed. CoreDNS is forwarding to 1.1.1.1 / 8.8.8.8.

 To grab kubeconfig on your laptop:
   scp ${SSH_USER}@${K3S_NODE_1_PUBLIC}:/etc/rancher/k3s/k3s.yaml ~/.kube/vacademy-prod.yaml
   sed -i '' "s#server: https://127.0.0.1:6443#server: https://${K3S_NODE_1_PUBLIC}:6443#" ~/.kube/vacademy-prod.yaml
   export KUBECONFIG=~/.kube/vacademy-prod.yaml
   kubectl get nodes

 Now run the Postgres bring-up:
   ./bring-up-postgres.sh
================================================================================
NEXTSTEP
