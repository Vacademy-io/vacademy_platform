# Sunday Cutover Playbook — Linode → Hetzner

**Date:** Sunday (TBD), starting at **T+0** (pick a low-traffic hour; suggest 02:00 IST).
**Window budget:** 90 min plan, 120 min hard cap. Rollback if cap is hit.

## Roles

- **Driver** — runs commands, has SSH to Linode and Hetzner, has Cloudflare API token loaded. (You.)
- **Observer** — watches logs, runs smoke tests, calls rollback. (Me / second person.)

## Pre-flight (T-30 min, before window)

Verify Saturday's dry-run is still healthy. Bail before announcing downtime if any of these fail.

```bash
# Hetzner cluster:
ssh root@<k3s-node-1>
export KUBECONFIG=/etc/rancher/k3s/k3s.yaml
kubectl get nodes                       # all 3 Ready
kubectl get pods -A                     # nothing CrashLoopBackOff
helm list                               # 'vac' release present, deployed (with empty DB)

# Hetzner DB primary:
ssh root@<db-primary>
sudo -u postgres psql -c "\l+"          # all per-service DBs present, schemas restored
sudo -u postgres psql -c "SELECT pg_is_in_recovery();"  # false on primary

# Hetzner DB standby:
ssh root@<db-standby>
sudo -u postgres psql -c "SELECT pg_is_in_recovery();"  # true
sudo -u postgres psql -c "SELECT pg_last_wal_replay_lsn();"  # advancing

# Cloudflare TTL is 60s on every record we'll flip:
dig +short admin.vacademy.io @1.1.1.1
dig +short app.vacademy.io @1.1.1.1
# Both should answer with current Linode LB IP, TTL <120s in the response (`+ttlunits`)
```

**Gate:** all green → proceed at T+0. Any red → reschedule.

---

## The cutover

> Conventions: `LINODE_DB_HOST` / `HETZNER_DB_PRIMARY` are the actual hostnames; `CF_TOKEN`
> is the Cloudflare API token (Zone:DNS:Edit, vacademy.io). Replace `<...>` placeholders
> from `TOPOLOGY.md`.

### T+0 — Maintenance page up, freeze writes

Put the static maintenance page in front of users **first**, so they see a consistent state
the moment we touch anything.

```bash
# On the Linode/LKE side — switch ingress to maintenance page
kubectl --context=linode -n default apply -f maintenance-ingress.yaml
# (or, in Cloudflare, deploy a Workers route returning the splash for admin/app hosts —
#  preferred because it doesn't require Linode to be healthy)

# Scale all Linode app deployments to 0 — stops further DB writes
kubectl --context=linode -n default scale deploy \
  auth-service admin-core-service media-service assessment-service \
  community-service notification-service ai-service --replicas=0
kubectl --context=linode -n default wait --for=delete pod \
  -l 'app in (auth-service,admin-core-service,...)' --timeout=120s

# Sanity: confirm no app pod is still running
kubectl --context=linode -n default get pods | grep -E 'service'
```

**Gate:** maintenance page live + 0 app pods running → proceed.

---

### T+5 — Final dump from Linode

Dump in **`-Fc` custom format** (parallel-restore-capable) and run **all DBs in parallel**
so total wall-clock ≈ time-of-biggest-DB. Expected total: ~5 min for ~10 GB.

```bash
# From a jumpbox with network access to BOTH Linode and Hetzner:
mkdir -p /tmp/cutover && cd /tmp/cutover

# Make sure standalone is OFF on Hetzner before restore (it should already be):
ssh root@<k3s-node-1> 'kubectl scale deploy --all -n default --replicas=0'

# Dump every per-service DB in parallel
for db in auth_service admin_core_service assessment_service media_service \
          notification_service community_service; do
  PGPASSWORD="$LINODE_DB_PASSWORD" pg_dump \
    -h "$LINODE_DB_HOST" -U linroot -d "$db" \
    -Fc --no-owner --no-privileges \
    -f "/tmp/cutover/$db.dump" \
    --verbose 2> "/tmp/cutover/$db.log" &
done
wait
ls -lh /tmp/cutover/*.dump   # confirm sizes look right vs Sat dry-run
```

**Insurance:** also tarball a `pg_dumpall` so we have a complete rollback snapshot:
```bash
PGPASSWORD="$LINODE_DB_PASSWORD" pg_dumpall \
  -h "$LINODE_DB_HOST" -U linroot \
  -f /tmp/cutover/linode-pre-cutover.sql 2>/dev/null
gzip /tmp/cutover/linode-pre-cutover.sql
# keep this file for at least 30 days
```

---

### T+15 — Restore on Hetzner primary

```bash
# Copy dumps to the Hetzner DB primary (private network)
scp /tmp/cutover/*.dump root@<db-primary>:/tmp/

# On <db-primary>:
ssh root@<db-primary>
for db in auth_service admin_core_service assessment_service media_service \
          notification_service community_service; do
  sudo -u postgres pg_restore \
    --dbname="$db" --clean --if-exists --no-owner --no-privileges \
    --jobs=4 --exit-on-error \
    "/tmp/$db.dump"
done

# Standby will catch up via streaming replication automatically.
# Verify within ~30s:
sudo -u postgres psql -c "SELECT client_addr, state, sync_state, write_lag, flush_lag, replay_lag FROM pg_stat_replication;"
# Expect 1 row, state=streaming, lags <1s
```

---

### T+30 — Data verification

Before bringing services up, confirm critical tables look right.

```bash
# On <db-primary>:
for db in auth_service admin_core_service assessment_service; do
  echo "=== $db ==="
  sudo -u postgres psql -d "$db" -c "
    SELECT 'users' as t, count(*) FROM users
    UNION ALL SELECT 'roles', count(*) FROM roles
    UNION ALL SELECT 'client_secret_key', count(*) FROM client_secret_key;
  " 2>/dev/null
done

# Specifically for admin_core_service:
sudo -u postgres psql -d admin_core_service -c "
  SELECT 'course', count(*) FROM course
  UNION ALL SELECT 'level', count(*) FROM level
  UNION ALL SELECT 'session', count(*) FROM session
  UNION ALL SELECT 'package_session', count(*) FROM package_session
  UNION ALL SELECT 'groups', count(*) FROM groups;
"

# Compare these counts against the Saturday-baseline numbers you should have
# captured: scripts/snapshot-row-counts.sh > /tmp/cutover/expected-counts.txt
diff <(...) /tmp/cutover/expected-counts.txt
```

**Gate:** row counts match expected (within tolerance for the last few minutes of Linode
writes) → proceed. Major mismatch → **STOP** and re-dump; investigate before flipping.

---

### T+40 — Helm upgrade Hetzner chart, wait for Ready

```bash
ssh root@<k3s-node-1>
export KUBECONFIG=/etc/rancher/k3s/k3s.yaml
cd /root/vacademy-services

helm upgrade --install vac . \
  -f values.yaml \
  -f values-prod-hetzner.yaml \
  -f values.secret.yaml \
  --wait --timeout 15m

# Force rollout so any stale ConfigMap-only changes apply (defensive):
for d in auth-service admin-core-service media-service assessment-service \
         community-service notification-service ai-service; do
  kubectl rollout restart deploy "$d"
done
for d in auth-service admin-core-service media-service assessment-service \
         community-service notification-service ai-service; do
  kubectl rollout status deploy "$d" --timeout=300s
done

kubectl get pods   # all Ready
```

**Gate:** all expected deployments Ready → proceed. CrashLoopBackOff → **STOP**, debug,
or call rollback (`cloudflare-dns-flip.sh --back-to-linode`).

---

### T+55 — Internal smoke test (before DNS flip)

Exercise the cluster via `/etc/hosts` so we test Hetzner *before* user traffic hits.

```bash
# On the driver's machine:
HETZNER_LB_IP=<k3s-node-1 public IP, or the LB IP if you set one up>
sudo tee -a /etc/hosts <<EOF
$HETZNER_LB_IP admin-stage-canary.vacademy.io
$HETZNER_LB_IP app-stage-canary.vacademy.io
EOF
# (TLS will fail for canary host unless we pre-issued; use Host header curl instead:)
curl -sS -H 'Host: admin.vacademy.io' "https://$HETZNER_LB_IP/auth-service/actuator/health" -k
curl -sS -H 'Host: admin.vacademy.io' "https://$HETZNER_LB_IP/admin-core-service/actuator/health" -k
curl -sS -H 'Host: admin.vacademy.io' "https://$HETZNER_LB_IP/ai-service/docs" -k

# Full login flow against the new cluster (use a test account):
curl -sS -H 'Host: admin.vacademy.io' \
  -X POST "https://$HETZNER_LB_IP/auth-service/v1/login-root" \
  -H 'Content-Type: application/json' \
  -d '{"username":"admin@vacademy.io","password":"<test pwd>"}' -k
# Expect 200 + JWT
```

**Gate:** auth + admin-core + ai-service all 200, login returns a JWT → proceed.

---

### T+65 — DNS flip via Cloudflare

```bash
export CF_API_TOKEN="..."   # Zone:DNS:Edit, vacademy.io
export CF_ZONE_ID="..."
export NEW_TARGET_IP="$HETZNER_LB_IP"

bash cloudflare-dns-flip.sh \
  --records admin.vacademy.io,app.vacademy.io,backend.vacademy.io \
  --to "$NEW_TARGET_IP" \
  --ttl 60
# Script does: GET each record's id → PATCH content=NEW_TARGET_IP, ttl=60, proxied=true
```

DNS propagates in <60s (TTL was lowered Friday).

---

### T+70 — External smoke test (real DNS, real users)

```bash
# Wait for propagation
for h in admin.vacademy.io app.vacademy.io; do
  echo "$h -> $(dig +short $h @1.1.1.1)"
done
# Should resolve to Cloudflare proxied IPs; trace to Hetzner backend

# Browser test:
# 1. Open https://admin.vacademy.io in incognito (avoids cached SW + cookies)
# 2. Login as a real admin
# 3. Navigate: dashboard → courses → create a TEST course → AI credits page → delete test course
# 4. Confirm no "Something went wrong" / "Could not validate credentials"

# Watch logs in parallel:
ssh root@<k3s-node-1> 'kubectl logs -f deploy/admin-core-service --tail=50' &
ssh root@<k3s-node-1> 'kubectl logs -f deploy/auth-service --tail=50' &
ssh root@<k3s-node-1> 'kubectl logs -f deploy/ai-service --tail=50' &
```

**Gate:** smoke test passes → migration complete. Take down maintenance page if it's still
showing on any path. Announce all-clear.

---

### T+90 — Window cap

If anything is still broken at T+90:

```bash
bash cloudflare-dns-flip.sh \
  --records admin.vacademy.io,app.vacademy.io,backend.vacademy.io \
  --back-to-linode --ttl 60

ssh root@<linode-k8s-master> 'kubectl scale deploy --all -n default --replicas=2'
# (or your normal replica counts)
```

Then post-mortem the failure. Hetzner stays running so we can debug without pressure.

---

## Post-cutover

| When | What |
|---|---|
| **+30 min** | Confirm pgBackRest backed up the new prod DB cleanly. `pgbackrest info` should show a current backup. |
| **+2 h** | Compare row counts on Hetzner vs the `linode-pre-cutover.sql.gz` snapshot — sanity that nothing was lost in dump/restore. |
| **+24 h** | DB metrics check: connection count, slow queries, replication lag. |
| **+72 h** | If everything's healthy: decommission Linode K8s cluster + managed DB. **Keep `linode-pre-cutover.sql.gz` for 30 days minimum.** |
| **+1 week** | Restore Hetzner from a pgBackRest backup to a scratch box, prove the backup chain works. |

## Rollback decision tree

| Symptom | Decide by | Action |
|---|---|---|
| Helm upgrade fails / pods CrashLoop | T+55 | Rollback DNS flip not needed — we haven't flipped yet. Investigate, retry, or call window. |
| Data verification fails | T+35 | **STOP**. Re-dump from Linode (already drained), investigate before flipping. |
| Internal smoke test fails | T+65 | DNS not flipped yet — keep Linode serving via maintenance page (it's still down). Debug or rollback by bringing Linode app pods back up. |
| External smoke test fails | T+75 | Flip DNS back via `cloudflare-dns-flip.sh --back-to-linode`. Linode pods are still scaled to 0 — scale them back up. Data drift = whatever brief window of Hetzner writes happened (rare). |
| Subtle issue surfaces post-window | T+90+ | If fixable in <30 min on Hetzner: fix forward. Otherwise rollback DNS, scale Linode, debug from a position of stability. |
