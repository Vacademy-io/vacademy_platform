#!/bin/bash

# Vacademy Platform - Local Development Setup
echo "🚀 Setting up Vacademy Platform for local development..."

# Check if Docker and Docker Compose are installed
if ! command -v docker &> /dev/null; then
    echo "❌ Docker is not installed. Please install Docker first."
    exit 1
fi

if ! command -v docker-compose &> /dev/null; then
    echo "❌ Docker Compose is not installed. Please install Docker Compose first."
    exit 1
fi

# Function to check if port is available
check_port() {
    local port=$1
    if lsof -Pi :$port -sTCP:LISTEN -t >/dev/null ; then
        echo "❌ Port $port is already in use. Please free it up first."
        return 1
    else
        echo "✅ Port $port is available"
        return 0
    fi
}

# Check required ports
echo "🔍 Checking port availability..."
ports=(5432 6379 8071 8072 8073 8074 8075 8076 80)
for port in "${ports[@]}"; do
    if ! check_port $port; then
        echo "💡 You can free up port $port by running: lsof -ti:$port | xargs kill -9"
        exit 1
    fi
done

# Create local environment files if they don't exist
echo "📝 Setting up environment configuration..."

# Create .env file for Docker Compose
cat > .env << EOF
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

# Database URLs (for local development)
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
EOF

echo "✅ Environment configuration created"

# Build and start services
echo "🐳 Building and starting Docker containers..."
docker-compose down --remove-orphans
docker-compose build --no-cache
docker-compose up -d postgres redis

echo "⏳ Waiting for database to be ready..."
sleep 10

# Start application services
echo "🚀 Starting application services..."
docker-compose up -d

echo "⏳ Waiting for services to start..."
sleep 30

# Health check
echo "🏥 Performing health checks..."
services=(
    "http://localhost:8071/auth-service/actuator/health"
    "http://localhost:8072/admin-core-service/actuator/health"
    "http://localhost:8073/community-service/actuator/health"
    "http://localhost:8074/assessment-service/actuator/health"
    "http://localhost:8075/media-service/actuator/health"
    "http://localhost:8076/notification-service/actuator/health"
)

for service in "${services[@]}"; do
    if curl -f -s $service > /dev/null; then
        echo "✅ $(echo $service | cut -d'/' -f4) is healthy"
    else
        echo "❌ $(echo $service | cut -d'/' -f4) is not responding"
    fi
done

echo ""
echo "🎉 Local development environment is ready!"
echo ""
echo "📋 Service URLs:"
echo "   • Gateway: http://localhost"
echo "   • Auth Service: http://localhost:8071"
echo "   • Admin Core Service: http://localhost:8072"
echo "   • Community Service: http://localhost:8073"
echo "   • Assessment Service: http://localhost:8074"
echo "   • Media Service: http://localhost:8075"
echo "   • Notification Service: http://localhost:8076"
echo ""
echo "📋 Database:"
echo "   • PostgreSQL: localhost:5432"
echo "   • Redis: localhost:6379"
echo ""
echo "🔧 Useful commands:"
echo "   • View logs: docker-compose logs -f [service-name]"
echo "   • Stop all: docker-compose down"
echo "   • Restart service: docker-compose restart [service-name]"
echo "   • Rebuild service: docker-compose up -d --build [service-name]" 