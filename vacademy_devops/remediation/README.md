# Vacademy Platform - Critical Issues Remediation

This folder contains configuration files and scripts to fix the critical issues identified in the Vacademy Kubernetes cluster.

## Issues Addressed

### P0 (Critical)

1. **NGINX Ingress Controller Instability** - 173+ restarts
2. **Calico Network Plugin Issues** - 336-1065+ restarts
3. **cert-manager Webhook Issues** - 888+ restarts

### P1 (High)

4. **Redis Without Persistence** - Data loss on restart
5. **Admin-Core Pod Startup Issues**
6. **Stale/Error Pods Cleanup**

### P2 (Medium)

7. **Security Improvements** (Redis auth, password encoder)
8. **Docker Image Tagging Strategy**
9. **Disable Emergency Trusted Login**

---

## Quick Start

```bash
# 1. Set your kubeconfig (if not already set)
export KUBECONFIG=~/.kube/config  # or your LKE kubeconfig

# 2. Apply all P0 fixes
./apply-p0-fixes.sh

# 3. Apply P1 fixes
./apply-p1-fixes.sh

# 4. Verify the fixes
./verify-fixes.sh
```

---

## Individual Fix Files

| File                               | Description                      | Priority |
| ---------------------------------- | -------------------------------- | -------- |
| `01-ingress-resources.yaml`        | Increase NGINX Ingress resources | P0       |
| `02-ingress-config-optimized.yaml` | Optimized NGINX configuration    | P0       |
| `03-calico-resource-fix.yaml`      | Increase Calico node resources   | P0       |
| `04-cert-manager-resources.yaml`   | Increase cert-manager resources  | P0       |
| `05-redis-with-persistence.yaml`   | Redis with PVC for persistence   | P1       |
| `06-cleanup-stale-pods.sh`         | Script to clean up error pods    | P1       |
| `apply-p0-fixes.sh`                | Apply all P0 fixes               | -        |
| `apply-p1-fixes.sh`                | Apply all P1 fixes               | -        |
| `verify-fixes.sh`                  | Verify all fixes                 | -        |

---

## Detailed Fix Instructions

### Fix 1: NGINX Ingress Controller (P0)

The ingress controller is restarting frequently, likely due to OOM kills.

```bash
# Check current resource usage
kubectl top pod -n ingress-nginx

# Check for OOM kills
kubectl describe pod -n ingress-nginx <ingress-pod-name> | grep -A5 "Last State"

# Apply fix
kubectl apply -f 01-ingress-resources.yaml
kubectl apply -f 02-ingress-config-optimized.yaml

# Force restart to pick up new resources
kubectl rollout restart deployment ingress-nginx-controller -n ingress-nginx
```

### Fix 2: Calico Network Issues (P0)

Calico nodes are restarting excessively.

```bash
# Check calico node logs
kubectl logs -n kube-system calico-node-<node-id> --tail=100

# Increase resources for Calico
kubectl apply -f 03-calico-resource-fix.yaml

# Restart calico daemonset
kubectl rollout restart daemonset calico-node -n kube-system
```

### Fix 3: cert-manager Webhook (P0)

```bash
# Check webhook logs
kubectl logs -n cert-manager cert-manager-webhook-<pod-id> --tail=100

# Apply resource increase
kubectl apply -f 04-cert-manager-resources.yaml

# Restart cert-manager
kubectl rollout restart deployment cert-manager-webhook -n cert-manager
```

### Fix 4: Redis Persistence (P1)

```bash
# Apply Redis with persistence
kubectl apply -f 05-redis-with-persistence.yaml

# Restart Redis deployment
kubectl rollout restart deployment redis
```

### Fix 5: Cleanup Stale Pods (P1)

```bash
# Run cleanup script
./06-cleanup-stale-pods.sh
```

---

## Monitoring After Fixes

After applying fixes, monitor the cluster:

```bash
# Watch pod restarts
watch -n 5 'kubectl get pods --all-namespaces | grep -E "Error|CrashLoopBackOff|Completed|Unknown"'

# Check resource usage
kubectl top pods --all-namespaces | head -30

# Check events for issues
kubectl get events --all-namespaces --sort-by='.lastTimestamp' | tail -30
```

---

## Rollback

If any fix causes issues:

```bash
# For ingress
kubectl rollout undo deployment ingress-nginx-controller -n ingress-nginx

# For calico
kubectl rollout undo daemonset calico-node -n kube-system

# For cert-manager
kubectl rollout undo deployment cert-manager-webhook -n cert-manager
```
