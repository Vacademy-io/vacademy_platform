# Service Communication Network Issue - Fix Documentation

## Problem Summary

The `admin_core_service` (and likely other services) are experiencing DNS resolution failures when trying to communicate with the `auth-service`. The error shows:

```
I/O error on GET request for "https://backend-stage.vacademy.io/auth-service/v1/internal/user": backend-stage.vacademy.io
```

## Root Cause

Services are configured to communicate with each other using **external URLs** (`https://backend-stage.vacademy.io`) instead of **internal Kubernetes service names**. This causes:

1. DNS resolution failures inside the Kubernetes cluster
2. Unnecessary external network hops
3. Potential security issues
4. Higher latency

## Solution Applied

Updated `/vacademy_devops/vacademy-services/templates/configmap.yaml` to add environment variables with internal Kubernetes service URLs:

```yaml
# Internal service URLs for inter-service communication
AUTH_SERVER_BASE_URL: 'http://auth-service:8071'
NOTIFICATION_SERVER_BASE_URL: 'http://notification-service:8076'
MEDIA_SERVER_BASE_URL: 'http://media-service:8075'
ASSESSMENT_SERVER_BASE_URL: 'http://assessment-service:8074'
```

## Deployment Steps

### 1. Apply the ConfigMap changes

```bash
# Navigate to the devops directory
cd vacademy_devops/vacademy-services

# Apply the updated ConfigMap
kubectl apply -f templates/configmap.yaml
```

### 2. Restart all affected services

The ConfigMap changes won't take effect until pods are restarted:

```bash
# Restart all services to pick up the new environment variables
kubectl rollout restart deployment admin-core-service
kubectl rollout restart deployment auth-service
kubectl rollout restart deployment notification-service
kubectl rollout restart deployment media-service
kubectl rollout restart deployment assessment-service
kubectl rollout restart deployment community-service

# Wait for rollouts to complete
kubectl rollout status deployment admin-core-service
kubectl rollout status deployment auth-service
kubectl rollout status deployment notification-service
kubectl rollout status deployment media-service
kubectl rollout status deployment assessment-service
kubectl rollout status deployment community-service
```

### 3. Verify the fix

Check that services are communicating properly:

```bash
# Check admin-core-service logs
kubectl logs -f deployment/admin-core-service --tail=100

# Look for successful authentication attempts instead of DNS errors
# You should see: "User Authenticated Successfully..!!!"
# Instead of: "I/O error on GET request..."
```

### 4. Remove external environment variable overrides (if any)

If `AUTH_SERVER_BASE_URL` is set in your CI/CD pipeline or secrets, remove or update those settings to avoid overriding the ConfigMap values.

## Why This Works

### Before:
- Service tries to call: `https://backend-stage.vacademy.io/auth-service/v1/internal/user`
- DNS lookup for `backend-stage.vacademy.io` fails inside the cluster
- Request fails with I/O error

### After:
- Service calls: `http://auth-service:8071/auth-service/v1/internal/user`
- Kubernetes DNS resolves `auth-service` to the internal service IP
- Request succeeds via internal cluster networking

## Benefits

1. **Reliability**: Internal DNS is more reliable within the cluster
2. **Performance**: Direct pod-to-pod communication is faster
3. **Security**: Traffic stays within the cluster
4. **Cost**: No external egress charges

## Verification Checklist

- [ ] ConfigMap updated and applied
- [ ] All services restarted
- [ ] No more DNS errors in logs
- [ ] Authentication requests succeeding
- [ ] API endpoints responding normally
- [ ] Check response times (should be faster)

## Rollback Plan

If issues occur:

```bash
# Revert ConfigMap changes
git checkout HEAD -- vacademy_devops/vacademy-services/templates/configmap.yaml
kubectl apply -f vacademy_devops/vacademy-services/templates/configmap.yaml

# Restart services again
kubectl rollout restart deployment admin-core-service
# ... repeat for all services
```

## Additional Notes

- This fix applies to all inter-service communication
- External URLs (like OAuth callbacks) should still use `https://backend-stage.vacademy.io`
- Internal URLs should use `http://service-name:port`
- The `application-stage.properties` files already use environment variables, so no code changes are needed
