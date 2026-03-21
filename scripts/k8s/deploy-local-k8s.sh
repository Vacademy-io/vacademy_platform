#!/bin/bash

# Vacademy Platform - Local Kubernetes Deployment
# Uses local-helm-chart and application-k8s-local.properties for local development

set -e

# Color functions (compatible with all shells)
print_info() { printf "\033[34mℹ️  %s\033[0m\n" "$1"; }
print_success() { printf "\033[32m✅ %s\033[0m\n" "$1"; }
print_error() { printf "\033[31m❌ %s\033[0m\n" "$1"; }
print_warning() { printf "\033[33m⚠️  %s\033[0m\n" "$1"; }

NAMESPACE="vacademy"
HELM_RELEASE="vacademy-local"

print_info "🚀 Starting Vacademy Local Kubernetes Deployment"

# Step 1: Build common_service using Docker (no local Maven required)
print_info "🔧 Building common_service foundation using Docker..."
print_info "📦 Note: Maven dependencies are cached in ~/.m2 for faster subsequent builds"
docker run --rm \
    -v "$PWD/common_service":/workspace \
    -v ~/.m2:/root/.m2 \
    -w /workspace \
    maven:3.8.5-openjdk-17-slim \
    mvn clean install -DskipTests

if [ $? -ne 0 ]; then
    print_error "Failed to build common_service"
    exit 1
fi
print_success "common_service built successfully"

# Step 2: Build all service Docker images
print_info "🐳 Building Docker images for all services..."
services=("auth_service" "admin_core_service" "community_service" "assessment_service" "media_service" "notification_service")

for service in "${services[@]}"; do
    if [ -d "$service" ]; then
        print_info "Building Docker image for $service..."
        cd "$service"
        
        # Create temporary directory and copy common_service
        mkdir -p common_service_temp
        cp ../common_service/target/common_service-0.0.2-SNAPSHOT.jar common_service_temp/
        
        # Create production Dockerfile
        cat > Dockerfile.local << 'EOF'
FROM maven:3.8.5-openjdk-17-slim AS dependencies
COPY common_service_temp/common_service-0.0.2-SNAPSHOT.jar /tmp/common_service.jar
RUN mvn install:install-file \
    -Dfile=/tmp/common_service.jar \
    -DgroupId=vacademy.io \
    -DartifactId=common_service \
    -Dversion=0.0.2-SNAPSHOT \
    -Dpackaging=jar

FROM maven:3.8.5-openjdk-17-slim AS build
WORKDIR /build
COPY --from=dependencies /root/.m2 /root/.m2
COPY . .
RUN mvn clean install -DskipTests

FROM amazoncorretto:17-alpine
WORKDIR /app
COPY --from=build /build/target/*_service.jar app.jar
EXPOSE 8071 8072 8073 8074 8075 8076
CMD ["java", "-jar", "-Dspring.profiles.active=k8s-local", "app.jar"]
EOF
        
        # Build Docker image
        docker build -f Dockerfile.local -t "vacademy-local/$service:latest" .
        
        # Cleanup
        rm -rf common_service_temp Dockerfile.local
        
        cd ..
        print_success "$service Docker image built"
    fi
done

# Step 3: Create Kubernetes namespace
print_info "🏗️ Setting up Kubernetes namespace..."
kubectl create namespace $NAMESPACE --dry-run=client -o yaml | kubectl apply -f -

# Step 4: Deploy PostgreSQL and Redis
print_info "🐘 Deploying PostgreSQL and Redis..."
kubectl apply -f - <<EOF
apiVersion: apps/v1
kind: Deployment
metadata:
  name: postgres
  namespace: $NAMESPACE
spec:
  replicas: 1
  selector:
    matchLabels:
      app: postgres
  template:
    metadata:
      labels:
        app: postgres
    spec:
      containers:
      - name: postgres
        image: postgres:13
        env:
        - name: POSTGRES_PASSWORD
          value: "vacademy123"
        - name: POSTGRES_USER
          value: "postgres"
        ports:
        - containerPort: 5432
---
apiVersion: v1
kind: Service
metadata:
  name: postgres
  namespace: $NAMESPACE
spec:
  selector:
    app: postgres
  ports:
  - port: 5432
    targetPort: 5432
---
apiVersion: apps/v1
kind: Deployment
metadata:
  name: redis
  namespace: $NAMESPACE
spec:
  replicas: 1
  selector:
    matchLabels:
      app: redis
  template:
    metadata:
      labels:
        app: redis
    spec:
      containers:
      - name: redis
        image: redis:7
        ports:
        - containerPort: 6379
---
apiVersion: v1
kind: Service
metadata:
  name: redis
  namespace: $NAMESPACE
spec:
  selector:
    app: redis
  ports:
  - port: 6379
    targetPort: 6379
EOF

# Step 5: Wait for PostgreSQL to be ready
print_info "⏳ Waiting for PostgreSQL to be ready..."
kubectl wait --for=condition=available --timeout=300s deployment/postgres -n $NAMESPACE

# Step 6: Create databases
print_info "🏗️ Creating service databases..."
for service in "${services[@]}"; do
    db_name="${service}"
    print_info "Creating database: $db_name"
    kubectl exec -n $NAMESPACE deployment/postgres -- psql -U postgres -tc "SELECT 1 FROM pg_database WHERE datname = '$db_name'" | grep -q 1 || \
    kubectl exec -n $NAMESPACE deployment/postgres -- psql -U postgres -c "CREATE DATABASE $db_name;"
done

# Step 6.5: Insert client secret keys for service-to-service authentication
print_info "🔐 Setting up client secret keys for service authentication..."
print_info "📝 This enables secure HMAC authentication between microservices"

# Define the client secret keys for all services
client_secrets="
INSERT INTO public.client_secret_key (client_name, secret_key, created_at, updated_at) VALUES
('auth_service', 'uhuh83389nxs9ujssnsjjbnbdjn2828', NOW(), NOW()),
('admin_core_service', '782hbs82nnkmn2882smsjhsjssj882', NOW(), NOW()),
('community_service', 'comm83hs92nnk2882smscomm882', NOW(), NOW()),
('assessment_service', 'assess92hs82nnkmass82smsjass', NOW(), NOW()),
('media_service', '88bsbb992ssm99mm87643u83nsjhu', NOW(), NOW()),
('notification_service', 'dnkdnlkdldmsdlsdlsdkls73samn7334', NOW(), NOW())
ON CONFLICT (client_name) DO UPDATE SET 
    secret_key = EXCLUDED.secret_key,
    updated_at = NOW();
"

# Insert client secret keys into each service database
for service in "${services[@]}"; do
    db_name="${service}"
    print_info "Adding client secret keys to $db_name database..."
    
    # First, create the table if it doesn't exist (for new deployments)
    kubectl exec -n $NAMESPACE deployment/postgres -- psql -U postgres -d "$db_name" -c "
    CREATE TABLE IF NOT EXISTS public.client_secret_key (
        id SERIAL PRIMARY KEY,
        client_name VARCHAR(255) UNIQUE NOT NULL,
        secret_key VARCHAR(255) NOT NULL,
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW()
    );"
    
    # Insert the client secret keys
    kubectl exec -n $NAMESPACE deployment/postgres -- psql -U postgres -d "$db_name" -c "$client_secrets"
    
    if [ $? -eq 0 ]; then
        print_success "Client secret keys added to $db_name"
    else
        print_warning "Failed to add client secret keys to $db_name (may already exist)"
    fi
done

# Step 7: Deploy services using Helm
print_info "🎛️ Deploying services using local Helm chart..."
helm upgrade --install $HELM_RELEASE local-helm-chart \
    --namespace $NAMESPACE \
    --set global.imageTag=latest \
    --set global.imagePullPolicy=Never \
    --set global.springProfile=k8s-local

print_success "🎉 Local Kubernetes deployment completed!"
print_info "📋 Next steps:"
echo "   1. Check status: kubectl get pods -n $NAMESPACE"
echo "   2. Start port-forwarding: ./start-port-forwarding.sh"
echo "   3. Verify deployment: ./verify-local-deployment.sh"
echo "   4. Cleanup when done: ./cleanup-local-k8s.sh" 