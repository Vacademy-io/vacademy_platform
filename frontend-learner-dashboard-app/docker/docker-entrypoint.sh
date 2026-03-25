#!/bin/bash
set -e

# Docker entrypoint script for Vacademy Learner Dashboard
# This script injects environment variables at runtime into the React app

echo "🚀 Starting Vacademy Learner Dashboard container..."

# Define the path to the built React app
APP_DIR="/usr/share/nginx/html"
CONFIG_DIR="${APP_DIR}/config"
CONFIG_FILE="${CONFIG_DIR}/env-config.js"

# Create config directory if it doesn't exist
mkdir -p "${CONFIG_DIR}"

echo "📝 Generating runtime configuration..."

# Generate the env-config.js file with environment variables
cat > "${CONFIG_FILE}" << EOF
// Runtime environment configuration
// This file is generated at container startup
window._env_ = {
  // API Configuration
  VITE_API_BASE_URL: "${VITE_API_BASE_URL:-https://backend-stage.vacademy.io}",
  VITE_INSTITUTE_ID: "${VITE_INSTITUTE_ID:-c70f40a5-e4d3-4b6c-a498-e612d0d4b133}",
  
  // Firebase Configuration
  VITE_FIREBASE_API_KEY: "${VITE_FIREBASE_API_KEY:-}",
  VITE_FIREBASE_AUTH_DOMAIN: "${VITE_FIREBASE_AUTH_DOMAIN:-}",
  VITE_FIREBASE_PROJECT_ID: "${VITE_FIREBASE_PROJECT_ID:-}",
  VITE_FIREBASE_STORAGE_BUCKET: "${VITE_FIREBASE_STORAGE_BUCKET:-}",
  VITE_FIREBASE_MESSAGING_SENDER_ID: "${VITE_FIREBASE_MESSAGING_SENDER_ID:-}",
  VITE_FIREBASE_APP_ID: "${VITE_FIREBASE_APP_ID:-}",
  VITE_FIREBASE_MEASUREMENT_ID: "${VITE_FIREBASE_MEASUREMENT_ID:-}",
  
  // Analytics Configuration
  VITE_AMPLITUDE_API_KEY: "${VITE_AMPLITUDE_API_KEY:-}",
  
  // App Configuration
  VITE_APP_NAME: "${VITE_APP_NAME:-Vacademy Learner}",
  VITE_APP_VERSION: "${VITE_APP_VERSION:-1.0.3}",
  VITE_ENVIRONMENT: "${VITE_ENVIRONMENT:-production}",
  
  // Feature Flags
  VITE_ENABLE_ANALYTICS: "${VITE_ENABLE_ANALYTICS:-true}",
  VITE_ENABLE_PUSH_NOTIFICATIONS: "${VITE_ENABLE_PUSH_NOTIFICATIONS:-true}",
  VITE_ENABLE_PROCTORING: "${VITE_ENABLE_PROCTORING:-true}",
  
  // Debug Settings
  VITE_DEBUG_MODE: "${VITE_DEBUG_MODE:-false}",
  VITE_LOG_LEVEL: "${VITE_LOG_LEVEL:-error}",
};

// Make configuration available globally
Object.freeze(window._env_);
EOF

echo "✅ Environment configuration generated at ${CONFIG_FILE}"

# Update index.html to include the runtime config
echo "🔧 Injecting runtime configuration into index.html..."

# Create a backup of the original index.html if it doesn't exist
if [ ! -f "${APP_DIR}/index.html.original" ]; then
    cp "${APP_DIR}/index.html" "${APP_DIR}/index.html.original"
fi

# Inject the config script into index.html if not already present
if ! grep -q "env-config.js" "${APP_DIR}/index.html"; then
    sed -i 's|<head>|<head>\n    <script src="/config/env-config.js"></script>|' "${APP_DIR}/index.html"
    echo "✅ Runtime configuration script injected into index.html"
else
    echo "ℹ️  Runtime configuration script already present in index.html"
fi

# Print configuration summary (without sensitive values)
echo "📋 Configuration Summary:"
echo "   API Base URL: ${VITE_API_BASE_URL:-https://backend-stage.vacademy.io}"
echo "   Institute ID: ${VITE_INSTITUTE_ID:-c70f40a5-e4d3-4b6c-a498-e612d0d4b133}"
echo "   App Name: ${VITE_APP_NAME:-Vacademy Learner}"
echo "   Environment: ${VITE_ENVIRONMENT:-production}"
echo "   Debug Mode: ${VITE_DEBUG_MODE:-false}"

# Set proper permissions
chmod 644 "${CONFIG_FILE}"
chown nginx:nginx "${CONFIG_FILE}"

echo "🎯 Container initialization completed successfully!"
echo "🌐 Starting nginx server..."

# Execute the main container command
exec "$@" 