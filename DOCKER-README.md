# 🐳 Docker Deployment Guide - Vacademy Learner Dashboard

This guide covers deploying the Vacademy Learner Dashboard using Docker, providing both development and production deployment options.

## 📋 Table of Contents

- [Prerequisites](#prerequisites)
- [Quick Start](#quick-start)
- [Environment Configuration](#environment-configuration)
- [Development Deployment](#development-deployment)
- [Production Deployment](#production-deployment)
- [Architecture Overview](#architecture-overview)
- [Troubleshooting](#troubleshooting)
- [Advanced Configuration](#advanced-configuration)

## 🛠 Prerequisites

- **Docker** (version 20.10+)
- **Docker Compose** (version 2.0+)
- **Git** for cloning the repository
- **2GB RAM** minimum, 4GB recommended
- **5GB disk space** for images and containers

### Install Docker

```bash
# Ubuntu/Debian
curl -fsSL https://get.docker.com -o get-docker.sh
sudo sh get-docker.sh

# macOS (using Homebrew)
brew install docker docker-compose

# Windows
# Download Docker Desktop from https://docker.com/products/docker-desktop
```

## 🚀 Quick Start

### 1. Clone the Repository

```bash
git clone <repository-url>
cd frontend-learner-dashboard-app
```

### 2. Configure Environment

```bash
# Copy the environment template
cp docker/environment-template.txt .env

# Edit the .env file with your configuration
nano .env
```

### 3. Start Development Environment

```bash
# Build and start the application
docker-compose up -d

# View logs
docker-compose logs -f vacademy-learner
```

The application will be available at `http://localhost:3000`

## ⚙️ Environment Configuration

### Required Environment Variables

Create a `.env` file in the project root with the following variables:

```bash
# API Configuration
VITE_API_BASE_URL=https://backend-stage.vacademy.io
VITE_INSTITUTE_ID=your-institute-id

# Firebase Configuration (Required for notifications)
VITE_FIREBASE_API_KEY=your-firebase-api-key
VITE_FIREBASE_AUTH_DOMAIN=your-project.firebaseapp.com
VITE_FIREBASE_PROJECT_ID=your-project-id
VITE_FIREBASE_STORAGE_BUCKET=your-project.appspot.com
VITE_FIREBASE_MESSAGING_SENDER_ID=123456789012
VITE_FIREBASE_APP_ID=1:123456789012:web:abcdef123456

# Analytics (Optional)
VITE_AMPLITUDE_API_KEY=your-amplitude-key
```

### Environment Templates

Use the provided template as a starting point:

```bash
# Development
cp docker/environment-template.txt .env.development

# Production
cp docker/environment-template.txt .env.production
```

## 🔧 Development Deployment

### Using Docker Compose

```bash
# Start development environment
docker-compose up -d

# View logs
docker-compose logs -f

# Stop services
docker-compose down

# Rebuild after code changes
docker-compose up --build -d
```

### Development Features

- **Hot reload**: Code changes trigger automatic rebuilds
- **Debug mode**: Enhanced logging and error reporting
- **Volume mounts**: Persistent logs and configuration
- **Health checks**: Automatic service monitoring

### Development Commands

```bash
# View container status
docker-compose ps

# Execute commands in container
docker-compose exec vacademy-learner sh

# View nginx logs
docker-compose logs vacademy-learner

# Restart specific service
docker-compose restart vacademy-learner
```

## 🚀 Production Deployment

### Using Production Compose File

```bash
# Deploy production environment
docker-compose -f docker-compose.prod.yml up -d

# Scale the application (if needed)
docker-compose -f docker-compose.prod.yml up -d --scale vacademy-learner=3
```

### Production Features

- **Optimized builds**: Multi-stage builds for smaller images
- **Resource limits**: CPU and memory constraints
- **Enhanced security**: Production-ready nginx configuration
- **Health checks**: Robust monitoring and restart policies
- **SSL ready**: HTTPS configuration support

### Production Environment Setup

1. **Create production environment file:**

```bash
cp docker/environment-template.txt .env.production

# Edit with production values
VITE_API_BASE_URL=https://api.vacademy.io
VITE_ENVIRONMENT=production
VITE_DEBUG_MODE=false
```

2. **Deploy with production settings:**

```bash
# Set environment
export COMPOSE_FILE=docker-compose.prod.yml
export COMPOSE_PROJECT_NAME=vacademy-prod

# Deploy
docker-compose up -d
```

### SSL/HTTPS Configuration

For production HTTPS, you have several options:

#### Option 1: External Load Balancer (Recommended)
Use AWS ALB, Cloudflare, or similar service for SSL termination.

#### Option 2: Traefik Integration
Uncomment the Traefik service in `docker-compose.prod.yml`:

```yaml
services:
  traefik:
    # ... traefik configuration
```

## 🏗 Architecture Overview

### Container Structure

```
┌─────────────────┐
│   Nginx (Port 80) │  ← Reverse Proxy + Static Files
├─────────────────┤
│   React App      │  ← Built application assets
├─────────────────┤
│   Runtime Config │  ← Environment injection
└─────────────────┘
```

### Build Process

1. **Build Stage**: 
   - Node.js 21 Alpine container
   - Install pnpm and dependencies
   - Build React application with Vite

2. **Production Stage**:
   - Nginx Alpine container
   - Copy built assets
   - Configure nginx for SPA routing
   - Runtime environment injection

### Networking

- **Development**: Bridge network with port mapping
- **Production**: Custom network with health checks
- **External**: Configurable for reverse proxies

## 🔍 Troubleshooting

### Common Issues

#### 1. Port Conflicts

```bash
# Check what's using port 3000
sudo lsof -i :3000

# Use different port
HOST_PORT=3001 docker-compose up -d
```

#### 2. Build Failures

```bash
# Clear Docker cache
docker system prune -a

# Rebuild without cache
docker-compose build --no-cache
```

#### 3. Environment Variables Not Loading

```bash
# Check container environment
docker-compose exec vacademy-learner env

# Check runtime config
docker-compose exec vacademy-learner cat /usr/share/nginx/html/config/env-config.js
```

#### 4. Application Not Loading

```bash
# Check nginx status
docker-compose exec vacademy-learner nginx -t

# Check logs
docker-compose logs vacademy-learner

# Check health endpoint
curl http://localhost:3000/health
```

### Debug Commands

```bash
# Container shell access
docker-compose exec vacademy-learner sh

# View nginx configuration
docker-compose exec vacademy-learner cat /etc/nginx/nginx.conf

# Check build logs
docker-compose logs --tail=100 vacademy-learner

# Monitor resource usage
docker stats vacademy-learner-dev
```

### Performance Monitoring

```bash
# Container resource usage
docker stats

# Application metrics
curl http://localhost:3000/health

# Nginx status (if enabled)
curl http://localhost:3000/nginx_status
```

## 🔐 Security Considerations

### Production Security Checklist

- [ ] Use HTTPS in production
- [ ] Set proper CORS headers
- [ ] Configure CSP headers
- [ ] Use secrets for sensitive environment variables
- [ ] Enable nginx security headers
- [ ] Regular security updates
- [ ] Monitor access logs

### Environment Security

```bash
# Use Docker secrets for sensitive data
echo "your-secret-api-key" | docker secret create firebase_api_key -

# Or use external secret management
# AWS Secrets Manager, HashiCorp Vault, etc.
```

## 📊 Monitoring & Logging

### Log Management

```bash
# View all logs
docker-compose logs

# Follow logs in real-time
docker-compose logs -f

# Export logs
docker-compose logs > application.log
```

### Health Monitoring

The application includes built-in health checks:

- **Endpoint**: `http://localhost:3000/health`
- **Interval**: 30 seconds
- **Timeout**: 10 seconds
- **Retries**: 3-5 (dev/prod)

### Optional Monitoring Stack

Uncomment monitoring services in `docker-compose.prod.yml`:

- **Prometheus**: Metrics collection
- **Grafana**: Dashboards and visualization
- **Logspout**: Log aggregation

## 🚀 Deployment Strategies

### CI/CD Integration

#### GitHub Actions Example

```yaml
name: Deploy to Production
on:
  push:
    branches: [main]

jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - name: Deploy to server
        run: |
          docker-compose -f docker-compose.prod.yml pull
          docker-compose -f docker-compose.prod.yml up -d
```

#### GitLab CI Example

```yaml
deploy:
  stage: deploy
  script:
    - docker-compose -f docker-compose.prod.yml up -d --build
  only:
    - main
```

### Rolling Updates

```bash
# Zero-downtime deployment
docker-compose -f docker-compose.prod.yml up -d --scale vacademy-learner=2
docker-compose -f docker-compose.prod.yml up -d --scale vacademy-learner=1
```

## 📈 Scaling

### Horizontal Scaling

```bash
# Scale to multiple instances
docker-compose -f docker-compose.prod.yml up -d --scale vacademy-learner=3

# Use with load balancer
docker-compose -f docker-compose.prod.yml -f docker-compose.lb.yml up -d
```

### Resource Optimization

```yaml
# Adjust resource limits in docker-compose.prod.yml
deploy:
  resources:
    limits:
      cpus: '2.0'
      memory: 1G
    reservations:
      cpus: '1.0'
      memory: 512M
```

## 🤝 Contributing

When contributing to Docker configuration:

1. Test changes in development environment
2. Update documentation
3. Verify production compatibility
4. Add appropriate labels and comments

## 📝 Additional Resources

- [Docker Best Practices](https://docs.docker.com/develop/best-practices/)
- [Nginx Configuration Guide](https://nginx.org/en/docs/)
- [React Production Deployment](https://reactjs.org/docs/optimizing-performance.html)
- [Vite Build Guide](https://vitejs.dev/guide/build.html)

---

**Need help?** Check the [troubleshooting section](#troubleshooting) or open an issue in the repository. 