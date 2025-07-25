#!/bin/bash

# Vacademy Platform - Local Kubernetes Setup
echo "🚀 Setting up Local Kubernetes Environment for Vacademy Platform"
echo "   This will install kubectl, helm, Docker Desktop, and set up a local cluster"
echo ""

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Function to print colored output
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

# Check if running on macOS
if [[ "$OSTYPE" != "darwin"* ]]; then
    print_error "This script is designed for macOS. Please install tools manually for your OS."
    exit 1
fi

print_info "Detected macOS system"

# Install Homebrew if not present
if ! command -v brew &> /dev/null; then
    print_info "Installing Homebrew..."
    /bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"
    
    # Add Homebrew to PATH
    echo 'eval "$(/opt/homebrew/bin/brew shellenv)"' >> ~/.zprofile
    eval "$(/opt/homebrew/bin/brew shellenv)"
    
    print_status "Homebrew installed"
else
    print_status "Homebrew already installed"
fi

# Install Docker Desktop
if ! command -v docker &> /dev/null; then
    print_info "Installing Docker Desktop..."
    brew install --cask docker
    print_warning "Please start Docker Desktop manually and enable Kubernetes in Settings > Kubernetes"
    print_warning "After enabling Kubernetes, press any key to continue..."
    read -n 1 -s
else
    print_status "Docker already installed"
fi

# Install kubectl
if ! command -v kubectl &> /dev/null; then
    print_info "Installing kubectl..."
    brew install kubectl
    print_status "kubectl installed"
else
    print_status "kubectl already installed"
fi

# Install Helm
if ! command -v helm &> /dev/null; then
    print_info "Installing Helm..."
    brew install helm
    print_status "Helm installed"
else
    print_status "Helm already installed"
fi

# Verify Docker is running
print_info "Checking Docker status..."
if ! docker info &> /dev/null; then
    print_error "Docker is not running. Please start Docker Desktop and try again."
    exit 1
fi

# Check if Kubernetes is enabled in Docker Desktop
print_info "Checking Kubernetes status..."
if ! kubectl cluster-info &> /dev/null; then
    print_warning "Kubernetes not accessible. Please enable Kubernetes in Docker Desktop:"
    print_info "1. Open Docker Desktop"
    print_info "2. Go to Settings > Kubernetes"
    print_info "3. Check 'Enable Kubernetes'"
    print_info "4. Click 'Apply & Restart'"
    print_warning "After enabling Kubernetes, press any key to continue..."
    read -n 1 -s
fi

# Wait for Kubernetes to be ready
print_info "Waiting for Kubernetes to be ready..."
kubectl wait --for=condition=Ready nodes --all --timeout=300s

print_status "Kubernetes cluster is ready!"

# Create namespace for Vacademy
print_info "Creating Vacademy namespace..."
kubectl create namespace vacademy --dry-run=client -o yaml | kubectl apply -f -

print_status "Setup complete! Next steps:"
echo ""
echo "1. Build local Docker images"
echo "2. Create local Helm values file"
echo "3. Deploy with Helm"
echo ""
echo "Run the next script: ./build-and-deploy-local.sh" 