# PowerShell script for building and running the Admin Dashboard Docker container

param(
    [Parameter(Position=0)]
    [ValidateSet("build", "run", "compose", "logs", "stop", "restart")]
    [string]$Command = "build"
)

# Function to print colored output
function Write-Status {
    param([string]$Message)
    Write-Host "[INFO] $Message" -ForegroundColor Green
}

function Write-Warning {
    param([string]$Message)
    Write-Host "[WARNING] $Message" -ForegroundColor Yellow
}

function Write-Error {
    param([string]$Message)
    Write-Host "[ERROR] $Message" -ForegroundColor Red
}

Write-Host "🐳 Admin Dashboard Docker Build Script" -ForegroundColor Green
Write-Host "========================================="

# Check if Docker is running
try {
    docker info | Out-Null
} catch {
    Write-Error "Docker is not running. Please start Docker Desktop and try again."
    exit 1
}

# Function to build the image
function Build-Image {
    Write-Status "Building Docker image..."
    docker build -t admin-dashboard:latest .
    if ($LASTEXITCODE -eq 0) {
        Write-Status "✅ Image built successfully!"
    } else {
        Write-Error "Failed to build image"
        exit 1
    }
}

# Function to run the container
function Run-Container {
    Write-Status "Stopping any existing container..."
    docker stop admin-dashboard-frontend 2>$null
    docker rm admin-dashboard-frontend 2>$null
    
    Write-Status "Starting new container..."
    docker run -d `
        --name admin-dashboard-frontend `
        -p 80:80 `
        --restart unless-stopped `
        admin-dashboard:latest
    
    if ($LASTEXITCODE -eq 0) {
        Write-Status "✅ Container started successfully!"
        Write-Status "🌐 Application is available at: http://localhost"
    } else {
        Write-Error "Failed to start container"
        exit 1
    }
}

# Function to use docker-compose
function Run-WithCompose {
    Write-Status "Using Docker Compose..."
    docker-compose down 2>$null
    docker-compose up -d --build
    if ($LASTEXITCODE -eq 0) {
        Write-Status "✅ Application started with Docker Compose!"
        Write-Status "🌐 Application is available at: http://localhost"
    } else {
        Write-Error "Failed to start with Docker Compose"
        exit 1
    }
}

# Function to show logs
function Show-Logs {
    docker logs -f admin-dashboard-frontend
}

# Function to stop the container
function Stop-Container {
    Write-Status "Stopping container..."
    docker stop admin-dashboard-frontend 2>$null
    docker rm admin-dashboard-frontend 2>$null
    Write-Status "✅ Container stopped!"
}

# Main script logic
switch ($Command) {
    "build" {
        Build-Image
    }
    "run" {
        Build-Image
        Run-Container
    }
    "compose" {
        Run-WithCompose
    }
    "logs" {
        Show-Logs
    }
    "stop" {
        Stop-Container
    }
    "restart" {
        Stop-Container
        Build-Image
        Run-Container
    }
    default {
        Write-Host "Usage: .\docker-build.ps1 {build|run|compose|logs|stop|restart}"
        Write-Host ""
        Write-Host "Commands:"
        Write-Host "  build    - Build the Docker image"
        Write-Host "  run      - Build and run the container"
        Write-Host "  compose  - Use Docker Compose to run"
        Write-Host "  logs     - Show container logs"
        Write-Host "  stop     - Stop the container"
        Write-Host "  restart  - Stop, rebuild, and start the container"
        exit 1
    }
} 