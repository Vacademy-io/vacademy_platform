# Vacademy Platform - Deployment Guide

This document outlines the **two deployment strategies** for the Vacademy platform:

1. **🏭 Production/Stage Deployment** - Using CI/CD with the main Helm chart
2. **🖥️ Local Development Deployment** - Using local Helm chart with `application-k8s-local.properties`

---

## 🏭 Production/Stage Deployment

### Overview
- **Location**: `vacademy_devops/vacademy-services/`
- **Configuration**: Uses environment variables from CI/CD pipeline
- **Target**: LKE (Linode Kubernetes Engine) or other production clusters
- **Trigger**: Automated via GitHub Actions on branch pushes

### GitHub Actions Workflows
Located in `.github/workflows/`:
- `maven-publish-auth-service.yml`
- `maven-publish-admin-core-service.yml`
- `maven-publish-community-service.yml`
- `maven-publish-assessment-service.yml`
- `maven-publish-media-service.yml`
- `maven-publish-notification-service.yml`
- `maven-publish-common.yml`

### Main Helm Chart Structure
```
vacademy_devops/vacademy-services/
├── Chart.yaml
├── values.yaml                    # Production values
├── templates/
│   ├── admin-core-service-deployment.yaml
│   ├── admin-core-service-service.yaml
│   ├── auth-service-deployment.yaml
│   ├── auth-service-service.yaml
│   ├── assessment-service-deployment.yaml
│   ├── assessment-service-service.yaml
│   ├── community-service-deployment.yaml
│   ├── community-service-service.yaml
│   ├── media-service-deployment.yaml
│   ├── media-service-service.yaml
│   ├── notification-service-deployment.yaml
│   ├── notification-service-service.yaml
│   └── ingress.yaml
```

### Deployment Process
1. **Code Push** → GitHub repository
2. **GitHub Actions** → Builds and pushes Docker images to ECR
3. **Helm Deployment** → Updates services in production/stage environment
4. **Health Checks** → Kubernetes verifies service readiness

---

## 🖥️ Local Development Deployment

### Overview
- **Location**: `local-helm-chart/`
- **Configuration**: Uses `application-k8s-local.properties` files
- **Target**: Local Docker Desktop Kubernetes or minikube
- **Trigger**: Manual deployment via script

### Prerequisites
```bash
# Required tools (Maven NOT required - we use Docker for builds)
brew install helm kubectl docker

# Enable Kubernetes in Docker Desktop
# OR start minikube
minikube start

# Ensure Docker is running
docker --version
```

### Quick Start
```bash
# 1. Deploy everything
./deploy-local-k8s.sh

# 2. Check status
kubectl get pods -n vacademy

# 3. Access services
./start-port-forwarding.sh

# 4. Verify deployment
./verify-local-deployment.sh

# 5. Cleanup when done
./cleanup-local-k8s.sh
```

### Local Helm Chart Structure
```
local-helm-chart/
├── Chart.yaml
├── values.yaml                    # Local development values
└── templates/
    ├── auth-service-deployment.yaml
    ├── auth-service-service.yaml
    ├── admin-core-service-deployment.yaml
    ├── admin-core-service-service.yaml
    ├── assessment-service-deployment.yaml
    ├── assessment-service-service.yaml
    ├── community-service-deployment.yaml
    ├── community-service-service.yaml
    ├── media-service-deployment.yaml
    ├── media-service-service.yaml
    ├── notification-service-deployment.yaml
    └── notification-service-service.yaml
```

### Configuration Files
Each service has local development configuration:
- `auth_service/src/main/resources/application-k8s-local.properties`
- `admin_core_service/src/main/resources/application-k8s-local.properties`
- `assessment_service/src/main/resources/application-k8s-local.properties`
- `community_service/src/main/resources/application-k8s-local.properties`
- `media_service/src/main/resources/application-k8s-local.properties`
- `notification_service/src/main/resources/application-k8s-local.properties`

### Key Features of Local Deployment
1. **Local Database**: PostgreSQL deployed in Kubernetes namespace
2. **Local Images**: Uses `imagePullPolicy: Never` for local Docker images
3. **Service Discovery**: Internal Kubernetes DNS (e.g., `auth-service.vacademy.svc.cluster.local`)
4. **DDL Auto-Update**: `spring.jpa.hibernate.ddl-auto=update` for development
5. **Mock Credentials**: All external service credentials are mocked for local testing

### Available Scripts

#### `deploy-local-k8s.sh`
- Builds all Docker images locally
- Deploys PostgreSQL and Redis
- Creates service databases
- Deploys all services via Helm

#### `start-port-forwarding.sh`
- Sets up port forwarding for all services
- Makes services accessible on localhost

#### `verify-local-deployment.sh`
- Checks pod health status
- Verifies service endpoints
- Tests database connectivity

#### `cleanup-local-k8s.sh`
- Removes all deployed resources
- Cleans up Docker images
- Resets local environment

---

## 🔧 Configuration Management

### Environment-Specific Properties

#### Production/Stage
- Uses **environment variables** injected by CI/CD
- External databases (managed PostgreSQL)
- Real external service credentials
- Profiles: `stage`, `prod`

#### Local Development
- Uses **application-k8s-local.properties** files
- Local PostgreSQL in Kubernetes
- Mock external service credentials
- Profile: `k8s-local`

### Health Check Configuration
Both deployments use service-specific health check paths:
- Auth Service: `/auth-service/actuator/health`
- Admin Core Service: `/admin-core-service/actuator/health`
- Assessment Service: `/assessment-service/actuator/health`
- Community Service: `/community-service/actuator/health`
- Media Service: `/media-service/actuator/health`
- Notification Service: `/notification-service/actuator/health`

---

## 📋 Service Ports

| Service | Port | Local URL (after port-forwarding) |
|---------|------|-----------------------------------|
| Auth Service | 8071 | http://localhost:8071 |
| Admin Core Service | 8072 | http://localhost:8072 |
| Community Service | 8073 | http://localhost:8073 |
| Assessment Service | 8074 | http://localhost:8074 |
| Media Service | 8075 | http://localhost:8075 |
| Notification Service | 8076 | http://localhost:8076 |

---

## 🚀 Getting Started

### For Production Deployment
1. Set up secrets in GitHub repository settings
2. Push code to trigger GitHub Actions
3. Monitor deployment in Kubernetes cluster

### For Local Development
1. Clone repository
2. Run `./deploy-local-k8s.sh`
3. Start developing with hot reload capabilities

---

## 🔍 Troubleshooting

### Common Issues
1. **Pod CrashLoopBackOff**: Check logs with `kubectl logs <pod-name> -n vacademy`
2. **Image Pull Errors**: Ensure Docker images are built locally for local deployment
3. **Database Connection**: Verify PostgreSQL is running and databases are created
4. **Health Check Failures**: Ensure correct health check paths are configured

### Useful Commands
```bash
# Check pod status
kubectl get pods -n vacademy

# View pod logs
kubectl logs -f <pod-name> -n vacademy

# Port forward specific service
kubectl port-forward service/<service-name> <local-port>:<service-port> -n vacademy

# Delete and redeploy
helm uninstall vacademy-local -n vacademy
./deploy-local-k8s.sh
```

This dual deployment strategy ensures smooth development workflows while maintaining production reliability. 