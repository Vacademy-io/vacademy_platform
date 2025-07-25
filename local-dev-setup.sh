#!/bin/bash

# Vacademy Platform - Local Development Setup
echo "🚀 Setting up Vacademy Platform for local development..."
echo "   This will setup 6 microservices with PostgreSQL and Redis"
echo ""

# Check if Docker and Docker Compose are installed
echo "🔍 Checking prerequisites..."
if ! command -v docker &> /dev/null; then
    echo "❌ Docker is not installed. Please install Docker first."
    echo "   Visit: https://docs.docker.com/get-docker/"
    exit 1
fi

if ! command -v docker-compose &> /dev/null; then
    echo "❌ Docker Compose is not installed. Please install Docker Compose first."
    echo "   Visit: https://docs.docker.com/compose/install/"
    exit 1
fi

# Check Docker daemon is running
if ! docker info &> /dev/null; then
    echo "❌ Docker daemon is not running. Please start Docker first."
    exit 1
fi

echo "✅ Docker and Docker Compose are ready"

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

# Check if .env file already exists
if [ -f ".env" ]; then
    echo "⚠️  .env file already exists. Do you want to overwrite it? (y/n)"
    read -r response
    if [[ ! "$response" =~ ^[Yy]$ ]]; then
        echo "✅ Using existing .env file"
    else
        echo "📝 Creating new .env file..."
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
DEEPSEEK_API_KEY=your_deepseek_api_key

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
    fi
else
    echo "📝 Creating .env file..."
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
DEEPSEEK_API_KEY=your_deepseek_api_key

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
fi

# Build and start services
echo ""
echo "🐳 Building and starting Docker containers..."
echo "   This may take a few minutes on first run..."

# Clean up any existing containers
echo "🧹 Cleaning up existing containers..."
docker-compose down --remove-orphans 2>/dev/null || true

# Build all services
echo "🔨 Building all services (this may take 5-10 minutes)..."
if ! docker-compose build --no-cache; then
    echo "❌ Failed to build services. Check Docker logs for details."
    exit 1
fi

# Start infrastructure services first
echo "🗄️  Starting database and Redis..."
if ! docker-compose up -d postgres redis; then
    echo "❌ Failed to start database services."
    exit 1
fi

echo "⏳ Waiting for database to be ready..."
echo "   PostgreSQL is initializing multiple databases..."
sleep 15

# Verify database is ready
for i in {1..30}; do
    if docker-compose exec -T postgres pg_isready -U postgres >/dev/null 2>&1; then
        echo "✅ Database is ready"
        break
    fi
    if [ $i -eq 30 ]; then
        echo "❌ Database failed to start after 30 attempts"
        echo "   Check logs: docker-compose logs postgres"
        exit 1
    fi
    sleep 1
done

# Start application services
echo "🚀 Starting application services..."
echo "   Services: auth, admin-core, community, assessment, media, notification"
if ! docker-compose up -d; then
    echo "❌ Failed to start application services."
    echo "   Check logs: docker-compose logs"
    exit 1
fi

echo "⏳ Waiting for services to initialize..."
echo "   This may take 1-2 minutes for all services to start..."
sleep 45

# Health check
echo ""
echo "🏥 Performing health checks..."
declare -A services=(
    ["Auth Service"]="http://localhost:8071/auth-service/actuator/health"
    ["Admin Core Service"]="http://localhost:8072/admin-core-service/actuator/health"
    ["Community Service"]="http://localhost:8073/community-service/actuator/health"
    ["Assessment Service"]="http://localhost:8074/assessment-service/actuator/health"
    ["Media Service"]="http://localhost:8075/media-service/actuator/health"
    ["Notification Service"]="http://localhost:8076/notification-service/actuator/health"
)

healthy_count=0
total_count=${#services[@]}

for service_name in "${!services[@]}"; do
    url="${services[$service_name]}"
    # Try multiple times for each service
    for attempt in {1..3}; do
        if curl -f -s --connect-timeout 5 --max-time 10 "$url" >/dev/null 2>&1; then
            echo "✅ $service_name is healthy"
            ((healthy_count++))
            break
        elif [ $attempt -eq 3 ]; then
            echo "❌ $service_name is not responding (tried 3 times)"
            echo "   Check logs: docker-compose logs $(echo $service_name | tr '[:upper:]' '[:lower:]' | sed 's/ /-/g')"
        else
            sleep 2
        fi
    done
done

echo ""
if [ $healthy_count -eq $total_count ]; then
    echo "🎉 All services are healthy! ($healthy_count/$total_count)"
elif [ $healthy_count -gt 0 ]; then
    echo "⚠️  Some services are healthy ($healthy_count/$total_count)"
    echo "   You can continue development, but check the logs for failed services"
else
    echo "❌ No services are responding. Please check the logs:"
    echo "   docker-compose logs"
    echo ""
    echo "Common issues:"
    echo "   • Services still starting up (wait a few more minutes)"
    echo "   • Port conflicts (check if ports 8071-8076 are free)"
    echo "   • Docker resource limits (increase Docker memory to 8GB+)"
fi

echo ""
echo "🎉 Local development environment setup complete!"
echo ""
echo "📋 Service Access Points:"
echo "   🌐 Gateway (Nginx):        http://localhost"
echo "   🔐 Auth Service:           http://localhost:8071"
echo "   👨‍💼 Admin Core Service:     http://localhost:8072"  
echo "   👥 Community Service:      http://localhost:8073"
echo "   📝 Assessment Service:     http://localhost:8074"
echo "   📁 Media Service:          http://localhost:8075"
echo "   📢 Notification Service:   http://localhost:8076"
echo ""
echo "📋 API Documentation (Swagger UI):"
echo "   • Auth:        http://localhost:8071/auth-service/swagger-ui.html"
echo "   • Admin:       http://localhost:8072/admin-core-service/swagger-ui.html"
echo "   • Community:   http://localhost:8073/community-service/swagger-ui.html"
echo "   • Assessment:  http://localhost:8074/assessment-service/swagger-ui.html"
echo "   • Media:       http://localhost:8075/media-service/swagger-ui.html"
echo "   • Notification: http://localhost:8076/notification-service/swagger-ui.html"
echo ""
echo "📋 Infrastructure:"
echo "   🗄️  PostgreSQL:    localhost:5432 (user: postgres, password: vacademy123)"
echo "   🔄 Redis:          localhost:6379"
echo "   📊 Service Status: docker-compose ps"
echo ""
echo "🔧 Useful Development Commands:"
echo "   📜 View all logs:           docker-compose logs -f"
echo "   📜 View service logs:       docker-compose logs -f [service-name]"
echo "   🛑 Stop all services:       docker-compose down"
echo "   🔄 Restart service:         docker-compose restart [service-name]"
echo "   🔨 Rebuild service:         docker-compose up -d --build [service-name]"
echo "   🗑️  Full cleanup:           docker-compose down -v --remove-orphans"
echo "   📊 Service status:          docker-compose ps"
echo ""
echo "🏥 Health Check Commands:"
echo "   🩺 All services:            curl http://localhost/health"
echo "   🩺 Individual service:      curl http://localhost:807X/[service]/actuator/health"
echo ""
echo "📚 Documentation:"
echo "   📖 Local Development Guide: LOCAL_DEVELOPMENT.md"
echo "   🔐 GitHub Secrets Setup:    GITHUB_SECRETS.md" 
echo "   🔒 Security Migration:      SECURITY_MIGRATION_SUMMARY.md"
echo ""
echo "🎯 Next Steps:"
echo "   1. Open http://localhost to access the gateway"
echo "   2. Check service health at individual /actuator/health endpoints"
echo "   3. Explore API documentation via Swagger UI links above"
echo "   4. For real functionality, update .env with actual API keys"
echo "   5. See LOCAL_DEVELOPMENT.md for detailed development workflow"
echo ""
echo "✨ Happy coding! Your Vacademy platform is ready for development!" 