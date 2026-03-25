# Vacademy Platform - Local Development Guide

This guide explains how to run the Vacademy Platform microservices locally for development purposes.

## 🏗️ Architecture Overview

The platform consists of 6 microservices:

- **Auth Service** (8071) - Authentication and authorization
- **Admin Core Service** (8072) - Admin panel functionality  
- **Community Service** (8073) - Community features
- **Assessment Service** (8074) - Assessment and testing
- **Media Service** (8075) - Media handling and storage
- **Notification Service** (8076) - Push notifications and messaging

## 🚀 Quick Start

### Prerequisites

- Docker Desktop or Docker Engine
- Docker Compose
- Git
- At least 8GB RAM available

### 1. One-Command Setup

```bash
chmod +x local-dev-setup.sh
./local-dev-setup.sh
```

This script will:
- Check system requirements
- Verify port availability
- Set up environment configuration
- Build and start all services
- Perform health checks

### 2. Manual Setup

If you prefer manual setup:

```bash
# 1. Create environment file
# The setup script will create .env for you, or manually create it with:
# - Database: postgres/vacademy123  
# - Add your API keys for OAuth, S3, email, etc.

# 2. Start infrastructure services
docker-compose up -d postgres redis

# 3. Wait for DB to be ready
sleep 10

# 4. Start application services
docker-compose up -d

# 5. Check logs
docker-compose logs -f
```

## 📋 Service URLs

Once running, services will be available at:

| Service | Direct URL | Gateway URL |
|---------|------------|-------------|
| Gateway | http://localhost | http://localhost |
| Auth Service | http://localhost:8071 | http://localhost/auth-service/ |
| Admin Core | http://localhost:8072 | http://localhost/admin-core-service/ |
| Community | http://localhost:8073 | http://localhost/community-service/ |
| Assessment | http://localhost:8074 | http://localhost/assessment-service/ |
| Media | http://localhost:8075 | http://localhost/media-service/ |
| Notification | http://localhost:8076 | http://localhost/notification-service/ |

### API Documentation

Swagger UI is available for each service:
- Auth: http://localhost:8071/auth-service/swagger-ui.html
- Admin: http://localhost:8072/admin-core-service/swagger-ui.html  
- Community: http://localhost:8073/community-service/swagger-ui.html
- Assessment: http://localhost:8074/assessment-service/swagger-ui.html
- Media: http://localhost:8075/media-service/swagger-ui.html
- Notification: http://localhost:8076/notification-service/swagger-ui.html

## 🛠️ Development Workflow

### Common Commands

```bash
# View logs for all services
docker-compose logs -f

# View logs for specific service
docker-compose logs -f auth-service

# Restart a service
docker-compose restart auth-service

# Rebuild and restart a service
docker-compose up -d --build auth-service

# Stop all services
docker-compose down

# Stop and remove volumes (database reset)
docker-compose down -v

# Scale a service (useful for load testing)
docker-compose up -d --scale auth-service=3
```

### Database Access

Each service uses its own dedicated database:

```bash
# Connect to auth service database
docker-compose exec postgres psql -U postgres -d auth_service

# Connect to admin core service database
docker-compose exec postgres psql -U postgres -d admin_core_service

# Connect to community service database
docker-compose exec postgres psql -U postgres -d community_service

# Connect to assessment service database
docker-compose exec postgres psql -U postgres -d assessment_service

# Connect to media service database
docker-compose exec postgres psql -U postgres -d media_service

# Connect to notification service database
docker-compose exec postgres psql -U postgres -d notification_service

# Connect to Redis
docker-compose exec redis redis-cli

# List all databases
docker-compose exec postgres psql -U postgres -c "\l"
```

### Debugging

#### View Application Logs
```bash
# All services
docker-compose logs -f

# Specific service with timestamps
docker-compose logs -f -t auth-service

# Last 100 lines
docker-compose logs --tail=100 auth-service
```

#### Check Service Health
```bash
# Using curl
curl http://localhost:8071/auth-service/actuator/health

# Using browser
open http://localhost:8071/auth-service/actuator/health
```

#### Database Debugging
```bash
# Check database connections for auth service
docker-compose exec postgres psql -U postgres -d auth_service -c "SELECT application_name, state, query FROM pg_stat_activity;"

# Check all active connections across databases
docker-compose exec postgres psql -U postgres -c "SELECT datname, application_name, state, query FROM pg_stat_activity WHERE state = 'active';"

# View database logs
docker-compose logs postgres

# Check if all databases were created
docker-compose exec postgres psql -U postgres -c "\l"
```

### Port Management

If you get port conflicts:

```bash
# Check what's using a port
lsof -i :8071

# Kill process using a port
lsof -ti:8071 | xargs kill -9

# Check all used ports
docker-compose ps
```

## 🔧 Configuration

### Environment Variables

Key environment variables (defined in `.env`):

```bash
# Database Configuration
DB_USERNAME=postgres
DB_PASSWORD=vacademy123

# Spring Profile
SPRING_PROFILES_ACTIVE=stage

# Service URLs (for local development)
AUTH_SERVER_BASE_URL=http://localhost
ADMIN_CORE_SERVICE_BASE_URL=http://localhost
NOTIFICATION_SERVER_BASE_URL=http://localhost
MEDIA_SERVICE_BASE_URL=http://localhost
ASSESSMENT_SERVER_BASE_URL=http://localhost
CLOUD_FRONT_URL=http://localhost/media/

# Database URLs (automatically configured for local)
AUTH_SERVICE_DB_URL=jdbc:postgresql://postgres:5432/auth_service
ADMIN_CORE_SERVICE_DB_URL=jdbc:postgresql://postgres:5432/admin_core_service
COMMUNITY_SERVICE_DB_URL=jdbc:postgresql://postgres:5432/community_service
ASSESSMENT_SERVICE_DB_URL=jdbc:postgresql://postgres:5432/assessment_service
MEDIA_SERVICE_DB_URL=jdbc:postgresql://postgres:5432/media_service
NOTIFICATION_SERVICE_DB_URL=jdbc:postgresql://postgres:5432/notification_service

# Application Credentials
APP_USERNAME=stage
APP_PASSWORD=test

# OAuth Credentials (replace with your actual values)
GOOGLE_CLIENT_ID=your_google_client_id
GOOGLE_CLIENT_SECRET=your_google_client_secret
OAUTH_GITHUB_CLIENT_ID=your_github_client_id
OAUTH_GITHUB_CLIENT_SECRET=your_github_client_secret

# AWS S3 Configuration (replace with your actual values)
S3_AWS_ACCESS_KEY=your_aws_access_key
S3_AWS_ACCESS_SECRET=your_aws_secret_key
AWS_BUCKET_NAME=vacademy-media-storage
AWS_S3_PUBLIC_BUCKET=vacademy-media-storage-public

# API Keys (replace with your actual values)
OPENROUTER_API_KEY=your_openrouter_api_key
GEMINI_API_KEY=your_gemini_api_key
YOUTUBE_API_KEY=your_youtube_api_key

# Email Configuration (replace with your actual values)
MAIL_HOST=email-smtp.ap-south-1.amazonaws.com
MAIL_PORT=2587
AWS_MAIL_USERNAME=your_aws_mail_username
AWS_MAIL_PASSWORD=your_aws_mail_password
SES_SENDER_EMAIL=support@vacademy.io

# WhatsApp Configuration (replace with your actual value)
WHATSAPP_ACCESS_TOKEN=your_whatsapp_access_token

# Scheduling
SCHEDULING_TIME_FRAME=5
```

**Important**: 
- For **local development**: The setup script creates `.env` with safe defaults
- For **production**: All sensitive values are managed through GitHub secrets (see `GITHUB_SECRETS.md`)
- Replace placeholder values with real credentials for full functionality

### Service-Specific Configuration

Each service can be configured via environment variables in `docker-compose.yml`:

```yaml
environment:
  - SPRING_PROFILES_ACTIVE=dev
  - DATABASE_URL=jdbc:postgresql://postgres:5432/vacademy_db
  - AUTH_SERVICE_URL=http://auth-service:8071
```

## 🐛 Troubleshooting

### Common Issues

#### 1. Port Already in Use
```bash
Error: Port 8071 is already allocated
```
**Solution**: 
```bash
# Find and kill the process
lsof -ti:8071 | xargs kill -9
```

#### 2. Database Connection Failed
```bash
Error: Connection to localhost:5432 refused
```
**Solution**: 
```bash
# Restart database
docker-compose restart postgres
# Wait for it to be ready
sleep 10
```

#### 3. Service Won't Start
```bash
Error: Container exits immediately
```
**Solution**: 
```bash
# Check logs
docker-compose logs service-name
# Often it's a configuration issue
```

#### 4. Out of Memory
```bash
Error: Container killed (OOMKilled)
```
**Solution**: 
- Increase Docker memory limit (8GB+)
- Or run fewer services at once

### Clean Reset

If everything is broken:

```bash
# Nuclear option - clean everything
docker-compose down -v --remove-orphans
docker system prune -f
docker volume prune -f

# Then restart
./local-dev-setup.sh
```

## 🚢 VS Kubernetes/Helm

### Why Docker Compose for Local?

| Aspect | Docker Compose | Kubernetes/Helm |
|--------|---------------|-----------------|
| **Setup Time** | 2 minutes | 15+ minutes |
| **Resource Usage** | Low | High (minikube/k3s) |
| **Debugging** | Easy logs/exec | Complex kubectl |
| **Hot Reload** | Simple restart | Complex redeploy |
| **IDE Integration** | Good | Limited |

### When to Use Kubernetes Locally

Consider local Kubernetes only if:
- Testing Kubernetes-specific features
- Validating Helm charts
- Testing with production-like networking
- Multiple developers need shared environment

For this, you could:
```bash
# Option 1: Minikube
minikube start
helm install vacademy ./vacademy_devops/vacademy-services

# Option 2: Kind
kind create cluster
helm install vacademy ./vacademy_devops/vacademy-services

# Option 3: Docker Desktop Kubernetes
kubectl apply -f ./vacademy_devops/
```

## 🔄 CI/CD Integration

This local setup can be integrated with:

### GitHub Actions

The repository includes a `local-development-test.yml` workflow that:
- Tests Docker Compose configuration with GitHub secrets
- Validates environment variable resolution
- Ensures database connectivity
- Verifies service startup

```yaml
- name: Test local setup
  uses: ./.github/workflows/local-development-test.yml
  secrets: inherit
```

### Custom Integration
```yaml
- name: Start local services
  run: ./local-dev-setup.sh
  
- name: Run integration tests
  run: mvn test -Dspring.profiles.active=stage
```

### Pre-commit Hooks
```bash
# .git/hooks/pre-commit
#!/bin/bash
./local-dev-setup.sh
mvn test
```

### GitHub Secrets Management

For production deployments, see `GITHUB_SECRETS.md` for:
- Complete list of required secrets
- Environment-specific configuration
- Security best practices

## 📚 Next Steps

1. **Development**: Start with `docker-compose logs -f` open
2. **Testing**: Use service URLs for API testing
3. **Debugging**: Check individual service logs
4. **Deployment**: Use existing Helm charts for staging/prod

---

**Happy coding! 🎉** 