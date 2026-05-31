#!/bin/sh
# Runtime config injection for the admin dashboard container.
# Writes window.__BACKEND_URL__ from the BACKEND_BASE_URL env var so a single
# generic image can serve any client domain (read by src/config/baseUrl.ts).
# If BACKEND_BASE_URL is unset, the value is empty and getBaseUrl() falls back
# to its build-time / domain-map logic (so this is a no-op for other deploys).
set -e

APP_DIR=/usr/share/nginx/html
CONFIG_DIR="${APP_DIR}/config"
mkdir -p "${CONFIG_DIR}"

cat > "${CONFIG_DIR}/runtime-config.js" <<EOF
// Generated at container startup — do not edit.
window.__BACKEND_URL__ = "${BACKEND_BASE_URL:-}";
EOF

# Inject the config script into <head> once, before the app bundle loads.
if ! grep -q "config/runtime-config.js" "${APP_DIR}/index.html"; then
  sed -i 's|<head>|<head><script src="/config/runtime-config.js"></script>|' "${APP_DIR}/index.html"
fi

echo "admin-frontend: BACKEND_BASE_URL=${BACKEND_BASE_URL:-<unset>}"
exec "$@"
