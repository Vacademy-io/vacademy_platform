# Vacademy Platform Helm Chart Deployment Guide

This guide will help you deploy the Vacademy platform to a new Kubernetes cluster using Helm.

## Prerequisites

Before deploying, ensure you have:

1. **Kubernetes Cluster**: A running Kubernetes cluster (EKS, GKE, AKS, or local cluster)
2. **kubectl**: Configured to connect to your target cluster
3. **Helm**: Version 3.x installed
4. **Domain**: A domain name for your deployment (currently configured for `backend-stage.vacademy.io`)
5. **Container Images**: Access to the ECR repositories or alternative image registry

## Architecture Overview

The Helm chart deploys 6 microservices and a Redis instance:
- **admin-core-service** (Port 8072)
- **auth-service** (Port 8071)
- **community-service** (Port 8073)
- **assessment-service** (Port 8074)
- **media-service** (Port 8075)
- **notification-service** (Port 8076)
- **redis-master** (Port 6379, internal only)

All services are exposed through a single NGINX ingress with path-based routing.

## Deployment Steps

### 1. Verify Cluster Connection
```bash
kubectl cluster-info
kubectl get nodes
```

### 2. Install Required Components
Run the setup script to install NGINX Ingress Controller and cert-manager:
```bash
./deploy-to-new-cluster.sh setup
```

### 3. Configure Domain and SSL
Update the ingress configuration for your domain:
- Edit `vacademy-services/templates/ingress.yaml`
- Replace `backend-stage.vacademy.io` with your domain
- Update the cert-issuer email in `cert-issuer.yaml`

### 4. Deploy the Application
```bash
./deploy-to-new-cluster.sh deploy
```

### 5. Verify Deployment
```bash
./deploy-to-new-cluster.sh verify
```

## Configuration Options

### Environment Variables
The chart supports different environments through values:
- `environment.stage`: For staging deployment
- `environment.prod`: For production deployment

### Redis Configuration
The chart includes a Redis instance (via Bitnami Redis chart). You can configure it in `values.yaml`:
```yaml
redis:
  enabled: true
  auth:
    enabled: true
    password: "secure-password" # Optional: set a specific password
  master:
    persistence:
      enabled: true
      size: 8Gi
```
To access Redis from your services, use the host `{{ .Release.Name }}-redis-master` (e.g., `vacademy-services-redis-master`) and port `6379`.
These are automatically exposed via the `REDIS_HOST` and `REDIS_PORT` environment variables injected into `admin-core-service`.

### Custom Values
Create a custom values file to override defaults:
```yaml
# custom-values.yaml
replicaCount: 2

services:
  admin_core_service:
    image:
      tag: "v1.2.0"
  # ... other service overrides
```

Deploy with custom values:
```bash
helm upgrade --install vacademy-services ./vacademy-services -f custom-values.yaml
```

### Resource Limits
Each service has predefined resource limits:
- CPU: 200m request, 250m limit
- Memory: 450Mi request, 600Mi limit

## Troubleshooting

### Common Issues

1. **ImagePullBackOff**: Ensure your cluster has access to the ECR repositories
2. **Ingress not working**: Check if NGINX ingress controller is running
3. **SSL certificate issues**: Verify cert-manager is installed and DNS is pointing to your cluster
4. **Health check failures**: Services may take 3-5 minutes to fully start up

### Useful Commands

```bash
# Check pod status
kubectl get pods

# Check service logs
kubectl logs -f deployment/admin-core-service

# Check ingress status
kubectl get ingress

# Check certificate status
kubectl get certificate

# Port forward for local testing
kubectl port-forward service/admin-core-service 8072:8072
```

## Security Considerations

1. **Image Security**: Ensure container images are scanned and up-to-date
2. **Network Policies**: Consider implementing network policies for service isolation
3. **RBAC**: Implement proper Role-Based Access Control
4. **Secrets Management**: Use Kubernetes secrets for sensitive configuration
5. **SSL/TLS**: Always use HTTPS in production (cert-manager handles this automatically)

## Scaling

To scale services:
```bash
kubectl scale deployment admin-core-service --replicas=3
```

Or update the `replicaCount` in values.yaml and upgrade the Helm release.

## Monitoring

Consider adding monitoring stack:
- Prometheus for metrics
- Grafana for dashboards
- Jaeger for distributed tracing
- ELK stack for logging

## Backup and Disaster Recovery

1. **Database Backups**: Ensure your external databases are backed up
2. **Configuration Backup**: Keep your values.yaml and custom configurations in version control
3. **Cluster State**: Consider using tools like Velero for cluster backups
