#!/bin/bash

# Vacademy Platform Deployment Script for New Kubernetes Cluster
# Usage: ./deploy-to-new-cluster.sh [setup|deploy|verify|cleanup]

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuration
NAMESPACE="default"
HELM_RELEASE_NAME="vacademy-services"
INGRESS_NAMESPACE="ingress-nginx"
CERT_MANAGER_NAMESPACE="cert-manager"

# Print colored output
print_status() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

print_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

print_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Check if required tools are installed
check_prerequisites() {
    print_status "Checking prerequisites..."
    
    if ! command -v kubectl &> /dev/null; then
        print_error "kubectl is not installed. Please install kubectl first."
        exit 1
    fi
    
    if ! command -v helm &> /dev/null; then
        print_error "helm is not installed. Please install Helm 3.x first."
        exit 1
    fi
    
    # Check kubectl connectivity
    if ! kubectl cluster-info &> /dev/null; then
        print_error "Cannot connect to Kubernetes cluster. Please check your kubeconfig."
        exit 1
    fi
    
    print_success "Prerequisites check passed"
}

# Setup cluster with required components
setup_cluster() {
    print_status "Setting up cluster components..."
    
    # Add Helm repositories
    print_status "Adding Helm repositories..."
    helm repo add ingress-nginx https://kubernetes.github.io/ingress-nginx
    helm repo add jetstack https://charts.jetstack.io
    helm repo update
    
    # Install NGINX Ingress Controller
    print_status "Installing NGINX Ingress Controller..."
    if ! kubectl get namespace $INGRESS_NAMESPACE &> /dev/null; then
        kubectl create namespace $INGRESS_NAMESPACE
    fi
    
    helm upgrade --install ingress-nginx ingress-nginx/ingress-nginx \
        --namespace $INGRESS_NAMESPACE \
        --set controller.replicaCount=2 \
        --set controller.nodeSelector."kubernetes\.io/os"=linux \
        --set defaultBackend.nodeSelector."kubernetes\.io/os"=linux \
        --set controller.service.type=LoadBalancer \
        --wait --timeout=300s
    
    # Apply global ingress configuration
    print_status "Applying global ingress configuration..."
    kubectl apply -f backend-ingress-global-config.yaml
    
    # Install cert-manager
    print_status "Installing cert-manager..."
    if ! kubectl get namespace $CERT_MANAGER_NAMESPACE &> /dev/null; then
        kubectl create namespace $CERT_MANAGER_NAMESPACE
    fi
    
    helm upgrade --install cert-manager jetstack/cert-manager \
        --namespace $CERT_MANAGER_NAMESPACE \
        --set installCRDs=true \
        --wait --timeout=300s
    
    # Wait for cert-manager to be ready
    print_status "Waiting for cert-manager to be ready..."
    kubectl wait --for=condition=ready pod -l app.kubernetes.io/instance=cert-manager -n $CERT_MANAGER_NAMESPACE --timeout=300s
    
    # Apply certificate issuer
    print_status "Creating certificate issuer..."
    kubectl apply -f cert-issuer.yaml
    
    print_success "Cluster setup completed successfully!"
    
    # Show external IP
    print_status "Waiting for LoadBalancer external IP..."
    external_ip=""
    while [ -z $external_ip ]; do
        external_ip=$(kubectl get svc ingress-nginx-controller -n $INGRESS_NAMESPACE --template="{{range .status.loadBalancer.ingress}}{{.ip}}{{end}}")
        [ -z "$external_ip" ] && sleep 10
    done
    print_success "External IP: $external_ip"
    print_warning "Please update your DNS records to point your domain to this IP address."
}

# Deploy the Vacademy services
deploy_services() {
    print_status "Deploying Vacademy services..."
    
    # Check if Helm chart directory exists
    if [ ! -d "vacademy-services" ]; then
        print_error "Helm chart directory 'vacademy-services' not found!"
        exit 1
    fi
    
    # Deploy using Helm
    print_status "Installing/upgrading Helm release..."
    helm upgrade --install $HELM_RELEASE_NAME ./vacademy-services \
        --namespace $NAMESPACE \
        --create-namespace \
        --wait --timeout=600s
    
    print_success "Vacademy services deployed successfully!"
    
    # Show deployment status
    print_status "Deployment status:"
    kubectl get pods -n $NAMESPACE
    kubectl get services -n $NAMESPACE
    kubectl get ingress -n $NAMESPACE
}

# Verify deployment
verify_deployment() {
    print_status "Verifying deployment..."
    
    # Check pod status
    print_status "Checking pod status..."
    kubectl get pods -n $NAMESPACE
    
    # Check if all pods are running
    not_running=$(kubectl get pods -n $NAMESPACE --field-selector=status.phase!=Running --no-headers | wc -l)
    if [ $not_running -gt 0 ]; then
        print_warning "Some pods are not in Running state. This might be normal during startup."
        kubectl get pods -n $NAMESPACE --field-selector=status.phase!=Running
    else
        print_success "All pods are running!"
    fi
    
    # Check services
    print_status "Checking services..."
    kubectl get services -n $NAMESPACE
    
    # Check ingress
    print_status "Checking ingress..."
    kubectl get ingress -n $NAMESPACE
    
    # Check certificate (if exists)
    cert_exists=$(kubectl get certificate -n $NAMESPACE --no-headers 2>/dev/null | wc -l)
    if [ $cert_exists -gt 0 ]; then
        print_status "Checking SSL certificate..."
        kubectl get certificate -n $NAMESPACE
    fi
    
    # Show ingress external IP
    external_ip=$(kubectl get svc ingress-nginx-controller -n $INGRESS_NAMESPACE --template="{{range .status.loadBalancer.ingress}}{{.ip}}{{end}}")
    if [ ! -z "$external_ip" ]; then
        print_success "Ingress external IP: $external_ip"
    fi
    
    print_status "Verification completed!"
}

# Cleanup deployment
cleanup_deployment() {
    print_warning "This will remove the Vacademy services deployment. Are you sure? (y/N)"
    read -r response
    if [[ "$response" =~ ^([yY][eE][sS]|[yY])$ ]]; then
        print_status "Removing Vacademy services..."
        helm uninstall $HELM_RELEASE_NAME -n $NAMESPACE || true
        
        print_warning "Do you want to remove the entire cluster setup (ingress, cert-manager)? (y/N)"
        read -r response2
        if [[ "$response2" =~ ^([yY][eE][sS]|[yY])$ ]]; then
            print_status "Removing cluster components..."
            helm uninstall ingress-nginx -n $INGRESS_NAMESPACE || true
            helm uninstall cert-manager -n $CERT_MANAGER_NAMESPACE || true
            kubectl delete namespace $INGRESS_NAMESPACE || true
            kubectl delete namespace $CERT_MANAGER_NAMESPACE || true
        fi
        
        print_success "Cleanup completed!"
    else
        print_status "Cleanup cancelled."
    fi
}

# Show help
show_help() {
    echo "Vacademy Platform Deployment Script"
    echo ""
    echo "Usage: $0 [COMMAND]"
    echo ""
    echo "Commands:"
    echo "  setup    - Set up cluster with ingress controller and cert-manager"
    echo "  deploy   - Deploy Vacademy services"
    echo "  verify   - Verify deployment status"
    echo "  cleanup  - Remove deployment and optionally cluster components"
    echo "  help     - Show this help message"
    echo ""
    echo "Example workflow for new cluster:"
    echo "  $0 setup"
    echo "  $0 deploy"
    echo "  $0 verify"
}

# Main script logic
main() {
    case "${1:-help}" in
        setup)
            check_prerequisites
            setup_cluster
            ;;
        deploy)
            check_prerequisites
            deploy_services
            ;;
        verify)
            check_prerequisites
            verify_deployment
            ;;
        cleanup)
            check_prerequisites
            cleanup_deployment
            ;;
        help)
            show_help
            ;;
        *)
            print_error "Unknown command: $1"
            show_help
            exit 1
            ;;
    esac
}

# Run main function with all arguments
main "$@"
