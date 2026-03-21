#!/bin/bash

# Vacademy Platform - Local Kubernetes Cleanup
echo "🧹 Cleaning up local Kubernetes environment..."
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

print_info() {
    echo -e "${BLUE}ℹ️  $1${NC}"
}

# Stop port forwarding
print_info "Stopping port forwarding..."
if [ -f /tmp/vacademy-port-forwards.pids ]; then
    while read pid; do
        kill $pid 2>/dev/null || true
    done < /tmp/vacademy-port-forwards.pids
    rm -f /tmp/vacademy-port-forwards.pids
    print_status "Port forwarding stopped"
fi

# Remove Helm deployment
print_info "Removing Helm deployment..."
if helm list -n vacademy | grep -q vacademy-local; then
    helm uninstall vacademy-local -n vacademy
    print_status "Helm deployment removed"
else
    print_warning "No Helm deployment found"
fi

# Remove namespace and all resources
print_info "Removing vacademy namespace..."
if kubectl get namespace vacademy &> /dev/null; then
    kubectl delete namespace vacademy --timeout=60s
    print_status "Namespace removed"
else
    print_warning "Vacademy namespace not found"
fi

# Clean up Docker images
print_info "Cleaning up local Docker images..."
docker images | grep "vacademy-local" | awk '{print $3}' | xargs -r docker rmi -f
print_status "Local Docker images cleaned"

# Clean up temporary files
print_info "Cleaning up temporary files..."
rm -f /tmp/vacademy-port-forwards.pids
print_status "Temporary files cleaned"

echo ""
print_status "Local Kubernetes environment cleaned up!"
echo ""
echo "To rebuild and deploy:"
echo "1. ./build-and-deploy-local.sh"
echo "2. ./start-port-forwarding.sh" 