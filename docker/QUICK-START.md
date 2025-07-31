# 🚀 Quick Start - Docker Deployment

## Prerequisites
- Docker & Docker Compose installed
- 2GB RAM available

## Development (5 minutes)

```bash
# 1. Clone and navigate
git clone <repo-url>
cd frontend-learner-dashboard-app

# 2. Copy environment template
cp docker/environment-template.txt .env

# 3. Start development
docker-compose up -d

# 4. Open browser
open http://localhost:3000
```

## Production

```bash
# 1. Configure production environment
cp docker/environment-template.txt .env
# Edit .env with production values

# 2. Deploy production
docker-compose -f docker-compose.prod.yml up -d

# 3. Check health
curl http://localhost/health
```

## Essential Commands

```bash
# View logs
docker-compose logs -f

# Stop services
docker-compose down

# Rebuild after changes
docker-compose up --build -d

# Check status
docker-compose ps
```

## Troubleshooting

```bash
# Check container logs
docker-compose logs vacademy-learner

# Access container shell
docker-compose exec vacademy-learner sh

# View environment config
docker-compose exec vacademy-learner cat /usr/share/nginx/html/config/env-config.js
```

## Next Steps

- Read the full [DOCKER-README.md](../DOCKER-README.md) for detailed documentation
- Configure Firebase for push notifications
- Set up SSL for production deployment
- Configure monitoring and logging 