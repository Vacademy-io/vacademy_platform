#!/bin/bash

# Vacademy Platform - Deployment Verification
echo "🔍 Verifying local Kubernetes deployment..."
echo ""

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

print_status() {
    echo -e "${GREEN}✅ $1${NC}"
}

print_warning() {
    echo -e "${YELLOW}⚠️  $1${NC}"
}

print_error() {
    echo -e "${RED}❌ $1${NC}"
}

print_info() {
    echo -e "${BLUE}ℹ️  $1${NC}"
}

# Check if kubectl is available
if ! command -v kubectl &> /dev/null; then
    print_error "kubectl not found. Please run ./local-k8s-setup.sh first"
    exit 1
fi

# Check if cluster is accessible
if ! kubectl cluster-info &> /dev/null; then
    print_error "Kubernetes cluster not accessible"
    exit 1
fi

print_status "Kubernetes cluster is accessible"

# Check namespace
print_info "Checking vacademy namespace..."
if kubectl get namespace vacademy &> /dev/null; then
    print_status "Vacademy namespace exists"
else
    print_error "Vacademy namespace not found"
    exit 1
fi

# Check deployments
print_info "Checking deployments..."
deployments=("auth-service" "admin-core-service" "community-service" "assessment-service" "media-service" "notification-service" "postgres" "redis")

for deployment in "${deployments[@]}"; do
    if kubectl get deployment "$deployment" -n vacademy &> /dev/null; then
        status=$(kubectl get deployment "$deployment" -n vacademy -o jsonpath='{.status.conditions[?(@.type=="Available")].status}')
        if [ "$status" = "True" ]; then
            print_status "$deployment is running"
        else
            print_warning "$deployment is not ready"
        fi
    else
        print_error "$deployment not found"
    fi
done

# Check services
print_info "Checking services..."
services=("auth-service" "admin-core-service" "community-service" "assessment-service" "media-service" "notification-service" "postgres" "redis")

for service in "${services[@]}"; do
    if kubectl get service "$service" -n vacademy &> /dev/null; then
        print_status "$service service exists"
    else
        print_error "$service service not found"
    fi
done

# Check Helm deployment
print_info "Checking Helm deployment..."
if helm list -n vacademy | grep -q vacademy-local; then
    print_status "Helm deployment 'vacademy-local' found"
else
    print_warning "Helm deployment not found"
fi

# Test connectivity to services (if port-forwarding is active)
print_info "Testing service connectivity..."
services_with_ports=("auth-service:8071" "admin-core-service:8072" "community-service:8073" "assessment-service:8074" "media-service:8075" "notification-service:8076")

for service_port in "${services_with_ports[@]}"; do
    service=$(echo $service_port | cut -d: -f1)
    port=$(echo $service_port | cut -d: -f2)
    
    if nc -z localhost $port 2>/dev/null; then
        print_status "$service accessible on port $port"
    else
        print_warning "$service not accessible on port $port (port-forwarding may not be active)"
    fi
done

echo ""
print_info "Summary:"
echo "  📊 Pod Status:"
kubectl get pods -n vacademy

echo ""
echo "  🌐 Service Endpoints (with port-forwarding):"
echo "    • Auth Service:         http://localhost:8071/auth-service/swagger-ui.html"
echo "    • Admin Core Service:   http://localhost:8072/admin-core-service/swagger-ui.html"
echo "    • Community Service:    http://localhost:8073/community-service/swagger-ui.html"
echo "    • Assessment Service:   http://localhost:8074/assessment-service/swagger-ui.html"
echo "    • Media Service:        http://localhost:8075/media-service/swagger-ui.html"
echo "    • Notification Service: http://localhost:8076/notification-service/swagger-ui.html"

echo ""
print_info "To start port-forwarding: ./start-port-forwarding.sh"
print_info "To view logs: kubectl logs -f deployment/SERVICE-NAME -n vacademy"
print_info "To clean up: ./cleanup-local-k8s.sh" 