# LKE Network Stability Remediation

This directory contains crucial patches and configurations to ensure stability of the Linode Kubernetes Engine (LKE) cluster, specifically addressing Calico CNI instability.

## 🚨 Critical Network Fix (Calico Flapping)

**Issue Encountered:** Jan 2026
**Symptoms:** intermittent 502 Bad Gateway errors, persistent BGP connection resets ("flapping"), random pod unreachability.
**Root Cause:**
Default Calico configuration on LKE uses `autodetect` method `can-reach=192.168.128.1`. This caused:

1.  Repeated re-evaluation of the node IP every minute.
2.  Selection of the **Public IP** on `eth0` instead of the LKE Shared Private IP.
3.  BGP peering failures due to firewalls blocking port 179 on the public interface.

### ✅ The Fix: 05-calico-ip-autodetection.yaml

We forced Calico to strictly use the **Private IP Range** on `eth0`.

**Configuration Applied:**

```yaml
env:
  - name: IP_AUTODETECTION_METHOD
    value: "cidr=192.168.128.0/17"
```

### 🛠️ How to Re-Apply (After Cluster Upgrade)

If Linode upgrades the cluster and resets the `calico-node` DaemonSet, network instability may return. To fix it:

1.  **Navigate to this directory:**

    ```bash
    cd vacademy_devops/remediation
    ```

2.  **Apply the Patch:**

    ```bash
    kubectl patch daemonset calico-node -n kube-system --patch-file 05-calico-ip-autodetection.yaml
    ```

3.  **Force Restart Pods (to pick up change immediately):**

    ```bash
    kubectl delete pods -n kube-system -l k8s-app=calico-node
    ```

4.  **Verify:**
    Check that pods are `1/1 Running` and logs show `Using autodetected IPv4 address 192.168.x.x`.

---

## Other Remediation Resources

- `01-ingress-resources.yaml`: Ingress Controller tuning (timeouts, buffers).
- `04-cert-manager-resources.yaml`: Cert-manager resource limit bumps.
