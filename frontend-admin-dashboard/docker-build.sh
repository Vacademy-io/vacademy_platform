#!/bin/bash

# Build and run script for the Admin Dashboard

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo -e "${GREEN}🐳 Admin Dashboard Docker Build Script${NC}"
echo "========================================="

# Function to print colored output
print_status() {
    echo -e "${GREEN}[INFO]${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

print_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Check if Docker is running
if ! docker info > /dev/null 2>&1; then
    print_error "Docker is not running. Please start Docker and try again."
    exit 1
fi

# Function to build the image
build_image() {
    print_status "Building Docker image..."
    docker build -t admin-dashboard:latest .
    print_status "✅ Image built successfully!"
}

# Function to run the container
run_container() {
    print_status "Stopping any existing container..."
    docker stop admin-dashboard-frontend 2>/dev/null || true
    docker rm admin-dashboard-frontend 2>/dev/null || true
    
    print_status "Starting new container..."
    docker run -d \
        --name admin-dashboard-frontend \
        -p 80:80 \
        --restart unless-stopped \
        admin-dashboard:latest
    
    print_status "✅ Container started successfully!"
    print_status "🌐 Application is available at: http://localhost"
}

# Function to use docker-compose
run_with_compose() {
    print_status "Using Docker Compose..."
    docker-compose down 2>/dev/null || true
    docker-compose up -d --build
    print_status "✅ Application started with Docker Compose!"
    print_status "🌐 Application is available at: http://localhost"
}

# Function to show logs
show_logs() {
    docker logs -f admin-dashboard-frontend
}

# Function to stop the container
stop_container() {
    print_status "Stopping container..."
    docker stop admin-dashboard-frontend 2>/dev/null || true
    docker rm admin-dashboard-frontend 2>/dev/null || true
    print_status "✅ Container stopped!"
}

# Main script logic
case "${1:-build}" in
    "build")
        build_image
        ;;
    "run")
        build_image
        run_container
        ;;
    "compose")
        run_with_compose
        ;;
    "logs")
        show_logs
        ;;
    "stop")
        stop_container
        ;;
    "restart")
        stop_container
        build_image
        run_container
        ;;
    *)
        echo "Usage: $0 {build|run|compose|logs|stop|restart}"
        echo ""
        echo "Commands:"
        echo "  build    - Build the Docker image"
        echo "  run      - Build and run the container"
        echo "  compose  - Use Docker Compose to run"
        echo "  logs     - Show container logs"
        echo "  stop     - Stop the container"
        echo "  restart  - Stop, rebuild, and start the container"
        exit 1
        ;;
esac 