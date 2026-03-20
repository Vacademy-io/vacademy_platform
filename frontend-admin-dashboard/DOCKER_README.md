# Docker Deployment Guide

This guide explains how to deploy your frontend admin dashboard using Docker.

## 📋 Prerequisites

Before you begin, ensure you have:

- [Docker](https://docs.docker.com/get-docker/) installed and running
- [Docker Compose](https://docs.docker.com/compose/install/) (usually included with Docker Desktop)
- At least 2GB of free disk space for the build process

## 🐳 Docker Configuration

### Architecture

The Docker setup uses a **multi-stage build**:

1. **Builder Stage**: Uses Node.js 20 Alpine to install dependencies and build the application
2. **Production Stage**: Uses Nginx Alpine to serve the built static files

### Key Features

- ✅ **Optimized Build**: Multi-stage build reduces final image size
- ✅ **Production Ready**: Nginx with production optimizations
- ✅ **SPA Support**: Proper client-side routing configuration
- ✅ **Security Headers**: CORS, XSS protection, and other security headers
- ✅ **Compression**: Gzip compression for better performance
- ✅ **Caching**: Static asset caching for improved load times

## 🚀 Quick Start

### Option 1: Using Build Scripts (Recommended)

**For Windows (PowerShell):**
```powershell
# Build and run the container
.\docker-build.ps1 run

# Or use Docker Compose
.\docker-build.ps1 compose
```

**For Linux/macOS (Bash):**
```bash
# Make the script executable
chmod +x docker-build.sh

# Build and run the container
./docker-build.sh run

# Or use Docker Compose
./docker-build.sh compose
```

### Option 2: Manual Docker Commands

```bash
# Build the image
docker build -t admin-dashboard:latest .

# Run the container
docker run -d \
  --name admin-dashboard-frontend \
  -p 80:80 \
  --restart unless-stopped \
  admin-dashboard:latest
```

### Option 3: Docker Compose

```bash
# Start the application
docker-compose up -d --build

# Stop the application
docker-compose down
```

## 🌐 Accessing the Application

Once the container is running, your application will be available at:

- **Local**: http://localhost
- **Network**: http://your-server-ip (if running on a server)

## 📜 Available Scripts

### PowerShell Scripts (Windows)

```powershell
.\docker-build.ps1 build     # Build the Docker image
.\docker-build.ps1 run       # Build and run the container
.\docker-build.ps1 compose   # Use Docker Compose
.\docker-build.ps1 logs      # Show container logs
.\docker-build.ps1 stop      # Stop the container
.\docker-build.ps1 restart   # Restart the container
```

### Bash Scripts (Linux/macOS)

```bash
./docker-build.sh build     # Build the Docker image
./docker-build.sh run       # Build and run the container
./docker-build.sh compose   # Use Docker Compose
./docker-build.sh logs      # Show container logs
./docker-build.sh stop      # Stop the container
./docker-build.sh restart   # Restart the container
```

## 🔧 Configuration

### Environment Variables

If you need to add environment variables, you can:

1. **Using Docker run:**
```bash
docker run -d \
  --name admin-dashboard-frontend \
  -p 80:80 \
  -e NODE_ENV=production \
  -e API_URL=https://your-api.com \
  admin-dashboard:latest
```

2. **Using Docker Compose:**
```yaml
# Uncomment and modify in docker-compose.yml
environment:
  - NODE_ENV=production
  - API_URL=https://your-api.com
```

3. **Using .env file:**
Create a `.env` file in the project root and modify the docker-compose.yml to use `env_file: .env`.

### Port Configuration

To change the port mapping, modify:

- **Docker run**: Change `-p 80:80` to `-p YOUR_PORT:80`
- **Docker Compose**: Change `"80:80"` to `"YOUR_PORT:80"` in docker-compose.yml

### Custom Nginx Configuration

If you need to modify the Nginx configuration, you can:

1. Create a custom `nginx.conf` file
2. Mount it as a volume: `-v ./nginx.conf:/etc/nginx/conf.d/default.conf`

## 📊 Monitoring and Logs

### View Logs

```bash
# Real-time logs
docker logs -f admin-dashboard-frontend

# Last 100 lines
docker logs --tail 100 admin-dashboard-frontend

# With Docker Compose
docker-compose logs -f frontend
```

### Health Check

The container includes a health check that verifies the application is responding:

```bash
# Check container health
docker ps

# Manual health check
docker exec admin-dashboard-frontend curl -f http://localhost:80
```

## 🐛 Troubleshooting

### Common Issues

1. **Port Already in Use**
   ```bash
   # Find what's using port 80
   netstat -tulpn | grep :80
   
   # Use a different port
   docker run -p 8080:80 admin-dashboard:latest
   ```

2. **Build Fails Due to Memory**
   ```bash
   # Increase Docker memory limit in Docker Desktop settings
   # Or build with less parallel processes
   docker build --memory=4g -t admin-dashboard:latest .
   ```

3. **Application Not Loading**
   ```bash
   # Check if container is running
   docker ps
   
   # Check logs for errors
   docker logs admin-dashboard-frontend
   
   # Verify nginx is serving files
   docker exec admin-dashboard-frontend ls -la /usr/share/nginx/html
   ```

### Performance Optimization

1. **Use .dockerignore**: Already included to exclude unnecessary files
2. **Multi-stage builds**: Already implemented to reduce image size
3. **Layer caching**: Dependencies are installed before copying source code

## 🚀 Production Deployment

### Recommended Production Setup

1. **Use a reverse proxy** (like Traefik or another Nginx instance) for:
   - SSL termination
   - Load balancing
   - Custom domain handling

2. **Set resource limits:**
```bash
docker run -d \
  --name admin-dashboard-frontend \
  --memory="512m" \
  --cpus="0.5" \
  -p 80:80 \
  admin-dashboard:latest
```

3. **Use Docker secrets** for sensitive configuration
4. **Implement proper logging** and monitoring
5. **Regular security updates** of the base images

### Scaling

For high-traffic applications, consider:

1. **Load balancing** with multiple container instances
2. **CDN integration** for static assets
3. **Container orchestration** with Kubernetes or Docker Swarm

## 📝 File Structure

```
├── Dockerfile              # Multi-stage Docker build configuration
├── docker-compose.yml      # Docker Compose configuration
├── .dockerignore           # Files to exclude from Docker build
├── docker-build.sh         # Build script for Linux/macOS
├── docker-build.ps1        # Build script for Windows
└── DOCKER_README.md        # This documentation
```

## 🤝 Contributing

When making changes that affect the Docker setup:

1. Test the build process locally
2. Update this documentation if needed
3. Consider backward compatibility
4. Update version tags appropriately

## 📞 Support

If you encounter issues with the Docker setup:

1. Check the troubleshooting section above
2. Verify your Docker installation
3. Check container logs for specific errors
4. Ensure adequate system resources 