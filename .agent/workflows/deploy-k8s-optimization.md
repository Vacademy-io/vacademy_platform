---
description: Deploy optimized inter-service communication configuration
---

# Deploy K8s Inter-Service Communication Optimizations

This workflow deploys the optimized ConfigMap and restarts services to enable internal service discovery for better performance.

## Prerequisites
- kubectl configured and connected to your cluster
- Helm installed
- Access to the cluster namespace

## Steps

### 1. Review the changes
Review the updated ConfigMap and application properties files to ensure all service URLs are correctly configured.

```bash
cat vacademy_devops/vacademy-services/templates/configmap.yaml
```

### 2. Navigate to Helm chart directory
```bash
cd vacademy_devops/vacademy-services
```

### 3. Validate Helm chart
```bash
helm lint .
```

### 4. Dry run to preview changes
```bash
helm upgrade vacademy-services . \
  --namespace default \
  --dry-run \
  --debug
```

### 5. Apply ConfigMap updates
// turbo
```bash
helm upgrade vacademy-services . \
  --namespace default \
  --reuse-values
```

### 6. Verify ConfigMap was updated
```bash
kubectl get configmap myconfigmapv1.0 -o yaml
```

### 7. Restart services to pick up new environment variables

Restart auth-service:
```bash
kubectl rollout restart deployment/auth-service
```

Restart admin-core-service:
```bash
kubectl rollout restart deployment/admin-core-service
```

Restart assessment-service:
```bash
kubectl rollout restart deployment/assessment-service
```

Restart media-service:
```bash
kubectl rollout restart deployment/media-service
```

Restart notification-service:
```bash
kubectl rollout restart deployment/notification-service
```

Restart community-service:
```bash
kubectl rollout restart deployment/community-service
```

Restart ai-service:
```bash
kubectl rollout restart deployment/ai-service
```

### 8. Monitor rollout status

```bash
kubectl rollout status deployment/auth-service
kubectl rollout status deployment/admin-core-service
kubectl rollout status deployment/assessment-service
kubectl rollout status deployment/media-service
kubectl rollout status deployment/notification-service
kubectl rollout status deployment/community-service
kubectl rollout status deployment/ai-service
```

### 9. Verify all pods are running
```bash
kubectl get pods -l 'app in (auth-service,admin-core-service,assessment-service,media-service,notification-service,community-service,ai-service)'
```

### 10. Test internal service communication

Exec into a pod and verify internal DNS resolution:
```bash
kubectl exec -it $(kubectl get pod -l app=auth-service -o jsonpath='{.items[0].metadata.name}') -- /bin/sh -c "wget -O- http://admin-core-service:8072/admin-core-service/actuator/health"
```

### 11. Check service logs for inter-service calls

```bash
# Check admin-core-service logs for calls to auth-service
kubectl logs -l app=admin-core-service --tail=50 | grep "http://auth-service"

# Check notification-service logs for calls to admin-core-service
kubectl logs -l app=notification-service --tail=50 | grep "http://admin-core-service"
```

### 12. Verify external ingress still works

```bash
curl https://backend-stage.vacademy.io/auth-service/actuator/health
curl https://backend-stage.vacademy.io/admin-core-service/actuator/health
```

## Rollback (if needed)

If there are issues, rollback the Helm release:

```bash
helm rollback vacademy-services
```

## Expected Results

- ✅ All pods restart successfully
- ✅ Health checks pass
- ✅ Internal service DNS resolves correctly
- ✅ Inter-service communication uses internal URLs
- ✅ External ingress continues to work
- ✅ Improved latency (10-50x faster inter-service calls)

## Troubleshooting

### Pods not starting
```bash
kubectl describe pod <pod-name>
kubectl logs <pod-name>
```

### Service DNS not resolving
```bash
kubectl get svc
kubectl run -it --rm debug --image=busybox --restart=Never -- nslookup auth-service
```

### ConfigMap not updated
```bash
kubectl get configmap myconfigmapv1.0 -o yaml
kubectl delete configmap myconfigmapv1.0
helm upgrade vacademy-services . --namespace default --reuse-values
```
