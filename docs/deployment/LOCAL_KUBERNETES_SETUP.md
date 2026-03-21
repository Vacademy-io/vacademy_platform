# 🚀 Vacademy Platform - Local Kubernetes Deployment

This guide helps you deploy the exact same Helm chart and Kubernetes configuration locally that you use in production, enabling you to test your production deployment setup.

## 🎯 Why Use Local Kubernetes?

- **Production Parity**: Test the exact same Helm charts and Kubernetes configurations
- **Deployment Validation**: Catch deployment issues before they reach production
- **Kubernetes Testing**: Test ingress, services, configmaps, and other K8s resources
- **Helm Chart Development**: Develop and test Helm charts locally
- **CI/CD Validation**: Validate your deployment pipeline changes

## 📋 Prerequisites

- **macOS** (this setup is designed for macOS)
- **8GB+ RAM** available for Docker Desktop
- **10GB+ disk space** for Docker images and Kubernetes

## 🚀 Quick Start

### 1. Install Tools and Setup Kubernetes

```bash
# Make scripts executable
chmod +x *.sh

# Install kubectl, helm, Docker Desktop, and enable Kubernetes
./local-k8s-setup.sh
```

**What this does:**
- Installs Homebrew (if needed)
- Installs Docker Desktop
- Installs kubectl and Helm
- Guides you through enabling Kubernetes in Docker Desktop
- Creates the `vacademy` namespace

### 2. Build and Deploy

```bash
# Build Docker images and deploy with Helm
./build-and-deploy-local.sh
```

**What this does:**
- Installs `common_service` dependency to local Maven repository
- Builds all 6 microservice Docker images locally (with dependency resolution)
- Creates local Helm chart templates with environment variable support
- Deploys PostgreSQL and Redis
- Deploys all services using Helm
- Waits for everything to be ready

### 3. Access Services

```bash
# Start port forwarding to access services on localhost
./start-port-forwarding.sh
```

**What this does:**
- Port forwards all services to localhost
- Makes services accessible at their standard ports
- Keeps running until you press Ctrl+C

### 4. Verify Deployment (Optional)

```bash
# Check if everything is working correctly
./verify-local-deployment.sh
```

**What this does:**
- Verifies all deployments and services are running
- Tests connectivity to services
- Shows deployment status and helpful information

## 🌐 Service Access

Once port forwarding is active:

| Service | URL | Swagger UI |
|---------|-----|------------|
| **Auth Service** | http://localhost:8071 | http://localhost:8071/auth-service/swagger-ui.html |
| **Admin Core** | http://localhost:8072 | http://localhost:8072/admin-core-service/swagger-ui.html |
| **Community** | http://localhost:8073 | http://localhost:8073/community-service/swagger-ui.html |
| **Assessment** | http://localhost:8074 | http://localhost:8074/assessment-service/swagger-ui.html |
| **Media** | http://localhost:8075 | http://localhost:8075/media-service/swagger-ui.html |
| **Notification** | http://localhost:8076 | http://localhost:8076/notification-service/swagger-ui.html |

### Database Access

| Database | Connection |
|----------|------------|
| **PostgreSQL** | `localhost:5432` (user: `postgres`, password: `vacademy123`) |
| **Redis** | `localhost:6379` |

## 🔧 Development Workflow

### Making Code Changes

1. **Modify your code** in any service
2. **Rebuild specific service:**
   ```bash
   # Rebuild just one service
   docker build -t vacademy-local/auth_service:latest auth_service/
   
   # Update the deployment
   kubectl rollout restart deployment/auth-service -n vacademy
   ```

3. **Or rebuild everything:**
   ```bash
   ./build-and-deploy-local.sh
   ```

### Viewing Logs

```bash
# View logs for specific service
kubectl logs -f deployment/auth-service -n vacademy

# View logs for all services
kubectl logs -f -l app -n vacademy --max-log-requests=10
```

### Debugging Pods

```bash
# Get pod status
kubectl get pods -n vacademy

# Describe a problematic pod
kubectl describe pod POD_NAME -n vacademy

# Execute into a pod
kubectl exec -it POD_NAME -n vacademy -- /bin/sh
```

### Database Operations

```bash
# Connect to PostgreSQL
kubectl exec -it deployment/postgres -n vacademy -- psql -U postgres -d auth_service

# Connect to Redis
kubectl exec -it deployment/redis -n vacademy -- redis-cli
```

## 🧹 Cleanup

When you're done testing:

```bash
# Clean up everything
./cleanup-local-k8s.sh
```

This removes:
- All Helm deployments
- The vacademy namespace and all resources
- Local Docker images
- Port forwarding processes

## 📁 File Structure

```
vacademy_platform/
├── local-k8s-setup.sh              # Initial setup
├── build-and-deploy-local.sh       # Build and deploy
├── create-local-helm-templates.sh  # Generate Helm templates
├── start-port-forwarding.sh        # Access services
├── verify-local-deployment.sh      # Verify deployment
├── cleanup-local-k8s.sh           # Clean up
├── local-helm-chart/               # Local Helm chart
│   ├── Chart.yaml
│   ├── values.yaml
│   └── templates/                  # Generated templates
└── LOCAL_KUBERNETES_SETUP.md      # This file
```

## 🔍 Architecture Comparison

| Aspect | Docker Compose | Local Kubernetes |
|--------|----------------|------------------|
| **Similarity to Production** | ❌ Different | ✅ Identical |
| **Networking** | Docker networks | Kubernetes services |
| **Configuration** | Environment files | ConfigMaps/Secrets |
| **Service Discovery** | Container names | DNS + Services |
| **Load Balancing** | Basic | Advanced (ingress) |
| **Health Checks** | Basic | Comprehensive probes |
| **Scaling** | Manual | Declarative |
| **Resource Limits** | Basic | Advanced |

## 🐛 Troubleshooting

### Port Already in Use
```bash
# Check what's using the port
lsof -i :8071

# Kill the process
kill -9 PID
```

### Docker Desktop Issues
1. Restart Docker Desktop
2. Ensure Kubernetes is enabled in Settings > Kubernetes
3. Reset Kubernetes cluster if needed

### Build Failures
```bash
# Clean up Docker cache
docker system prune -f

# Rebuild with no cache
docker build --no-cache -t vacademy-local/SERVICE:latest SERVICE/
```

### Pod Not Starting
```bash
# Check pod events
kubectl describe pod POD_NAME -n vacademy

# Check if image exists
docker images | grep vacademy-local

# Check resource usage
kubectl top nodes
kubectl top pods -n vacademy
```

### Helm Issues
```bash
# Check Helm deployment status
helm list -n vacademy

# Check what Helm would deploy
helm template vacademy-local ./local-helm-chart

# Debug Helm deployment
helm install vacademy-local ./local-helm-chart --namespace vacademy --dry-run --debug
```

## 🎯 Next Steps

1. **Test your changes** using this local setup
2. **Validate Helm charts** before deploying to production
3. **Test networking** between services
4. **Verify environment configurations**
5. **Test health checks and probes**

This local setup gives you confidence that your production deployments will work exactly as expected! 