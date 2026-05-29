#!/usr/bin/env bash
# Launch ai_service locally against the local backend stack.
#
# Loads ai_service/.env.local (APP_ENV=local) and serves the FastAPI app on
# :8077 under the /ai-service base path — matching the frontend dev proxies.
#
# Must run with cwd = this directory (config loads ".env.<APP_ENV>" from cwd),
# with the parent on PYTHONPATH so "import ai_service" resolves.
set -euo pipefail

cd "$(dirname "$0")"

if [ ! -x .venv/bin/uvicorn ]; then
  echo "error: .venv not set up. Create it with:" >&2
  echo "  /opt/homebrew/opt/python@3.11/bin/python3.11 -m venv .venv" >&2
  echo "  .venv/bin/pip install -r requirements.txt" >&2
  exit 1
fi

export APP_ENV=local
export PYTHONPATH="..:${PYTHONPATH:-}"

exec .venv/bin/uvicorn ai_service.main:app \
  --host 0.0.0.0 --port 8077 --timeout-keep-alive 1200 "$@"
