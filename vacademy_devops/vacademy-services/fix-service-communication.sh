#!/bin/bash
# Script to fix inter-service communication DNS issues
# Run this script AFTER connecting to your stage Kubernetes cluster

set -e  # Exit on error

echo "======================================"
echo "Fixing Inter-Service Communication"
echo "======================================"
echo ""

# Check current context
echo "Current kubectl context:"
kubectl config current-context
echo ""

read -p "Is this the STAGE cluster context? (y/n) " -n 1 -r
echo ""
if [[ ! $REPLY =~ ^[Yy]$ ]]
then
    echo "Please switch to your stage cluster context first!"
    echo "Example: kubectl config use-context <stage-context-name>"
    exit 1
fi

# Apply the updated ConfigMap
echo "Step 1: Applying updated ConfigMap..."
kubectl apply -f templates/configmap.yaml
echo "✓ ConfigMap applied"
echo ""

# Verify ConfigMap
echo "Step 2: Verifying ConfigMap..."
kubectl get configmap myconfigmapv1.0 -o yaml | grep -A 5 "AUTH_SERVER_BASE_URL"
echo "✓ ConfigMap verified"
echo ""

# Restart services
echo "Step 3: Restarting all services to pick up new environment variables..."
echo ""

services=(
    "admin-core-service"
    "auth-service"
    "notification-service"
    "media-service"
    "assessment-service"
    "community-service"
)

for service in "${services[@]}"; do
    echo "Restarting $service..."
    kubectl rollout restart deployment $service
    echo "✓ $service restart initiated"
done

echo ""
echo "Step 4: Waiting for rollouts to complete..."
echo ""

for service in "${services[@]}"; do
    echo "Waiting for $service..."
    kubectl rollout status deployment $service --timeout=5m
    echo "✓ $service rolled out successfully"
done

echo ""
echo "======================================"
echo "Verification"
echo "======================================"
echo ""

# Check admin-core-service logs
echo "Recent admin-core-service logs:"
kubectl logs deployment/admin-core-service --tail=20 | grep -E "(auth-service|backend-stage)" || echo "No auth-service related logs in last 20 lines"
echo ""

# Show running pods
echo "Running pods:"
kubectl get pods | grep -E "admin-core-service|auth-service|media-service|assessment-service|notification-service|community-service"
echo ""

echo "======================================"
echo "Fix Applied Successfully!"
echo "======================================"
echo ""
echo "Services should now communicate using internal URLs:"
echo "  - http://auth-service:8071"
echo "  - http://admin-core-service:8072"
echo "  - http://community-service:8073"
echo "  - http://assessment-service:8074"
echo "  - http://media-service:8075"
echo "  - http://notification-service:8076"
echo "  - http://ai-service:8077"
echo ""
echo "Monitor logs to verify no more DNS errors:"
echo "  kubectl logs -f deployment/admin-core-service"
echo ""
