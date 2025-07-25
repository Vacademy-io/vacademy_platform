#!/bin/bash

# Vacademy Platform - Port Forwarding for Local Access
echo "🔗 Starting port forwarding for all Vacademy services..."
echo "   This will make services accessible on localhost"
echo ""

# Colors for output
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

print_status() {
    echo -e "${GREEN}✅ $1${NC}"
}

print_info() {
    echo -e "${BLUE}ℹ️  $1${NC}"
}

print_warning() {
    echo -e "${YELLOW}⚠️  $1${NC}"
}

# Check if kubectl is available
if ! command -v kubectl &> /dev/null; then
    echo "❌ kubectl not found. Please run ./local-k8s-setup.sh first"
    exit 1
fi

# Check if services are running
print_info "Checking if services are deployed..."
if ! kubectl get deployment -n vacademy &> /dev/null; then
    echo "❌ No deployments found in vacademy namespace. Please run ./build-and-deploy-local.sh first"
    exit 1
fi

# Wait for deployments to be ready
print_info "Waiting for all deployments to be ready..."
kubectl wait --for=condition=Available deployment --all -n vacademy --timeout=300s

# Create a function to start port forwarding in background
start_port_forward() {
    local service=$1
    local port=$2
    
    print_info "Starting port forwarding for $service on port $port..."
    kubectl port-forward -n vacademy svc/$service $port:$port &
    local pid=$!
    echo $pid >> /tmp/vacademy-port-forwards.pids
    print_status "$service accessible at http://localhost:$port"
}

# Clean up any existing port forwards
print_info "Cleaning up existing port forwards..."
if [ -f /tmp/vacademy-port-forwards.pids ]; then
    while read pid; do
        kill $pid 2>/dev/null || true
    done < /tmp/vacademy-port-forwards.pids
    rm -f /tmp/vacademy-port-forwards.pids
fi

# Start port forwarding for all services
print_info "Starting port forwarding for all services..."
echo ""

start_port_forward "auth-service" 8071
start_port_forward "admin-core-service" 8072
start_port_forward "community-service" 8073
start_port_forward "assessment-service" 8074
start_port_forward "media-service" 8075
start_port_forward "notification-service" 8076

# Also forward database ports for debugging
start_port_forward "postgres" 5432
start_port_forward "redis" 6379

echo ""
print_status "All services are now accessible!"
echo ""
echo "🌐 Service URLs:"
echo "   • Auth Service:         http://localhost:8071/auth-service/swagger-ui.html"
echo "   • Admin Core Service:   http://localhost:8072/admin-core-service/swagger-ui.html"
echo "   • Community Service:    http://localhost:8073/community-service/swagger-ui.html"
echo "   • Assessment Service:   http://localhost:8074/assessment-service/swagger-ui.html"
echo "   • Media Service:        http://localhost:8075/media-service/swagger-ui.html"
echo "   • Notification Service: http://localhost:8076/notification-service/swagger-ui.html"
echo ""
echo "🗄️  Database Access:"
echo "   • PostgreSQL: localhost:5432 (user: postgres, password: vacademy123)"
echo "   • Redis:      localhost:6379"
echo ""
print_warning "Press Ctrl+C to stop all port forwarding"

# Function to cleanup on exit
cleanup() {
    print_info "Stopping all port forwards..."
    if [ -f /tmp/vacademy-port-forwards.pids ]; then
        while read pid; do
            kill $pid 2>/dev/null || true
        done < /tmp/vacademy-port-forwards.pids
        rm -f /tmp/vacademy-port-forwards.pids
    fi
    print_status "All port forwards stopped"
    exit 0
}

# Set up signal handlers
trap cleanup SIGINT SIGTERM

# Wait for user to stop
while true; do
    sleep 1
done 