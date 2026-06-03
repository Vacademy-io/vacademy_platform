# =============================================================
# Load-gen image: runs openfun/bbb-stress-test (Puppeteer) as a pod.
# Base = official Puppeteer image (ships Chrome + all libs).
#
# SCAFFOLD: verify the bootstrap/run steps against the upstream repo's
# Makefile before relying on this — bbb-stress-test's exact bootstrap target
# and .env keys can change. Build:
#   docker build -t ghcr.io/vacademy-io/bbb-loadgen:latest bigbluebutton-server/loadtest
# =============================================================
FROM ghcr.io/puppeteer/puppeteer:23.6.0

USER root
RUN apt-get update && apt-get install -y --no-install-recommends git make ca-certificates \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /opt
# Pin a commit in production use; depth-1 main is fine for a one-off load test.
RUN git clone --depth 1 https://github.com/openfun/bbb-stress-test.git
WORKDIR /opt/bbb-stress-test

# Reuse the base image's Chrome instead of downloading a second copy.
ENV PUPPETEER_SKIP_DOWNLOAD=true
ENV PUPPETEER_EXECUTABLE_PATH=/usr/bin/google-chrome-stable

# Install JS deps (the repo uses `make bootstrap`; npm ci is the usual underlying step).
RUN npm ci 2>/dev/null || npm install || make bootstrap

COPY entrypoint.sh /opt/entrypoint.sh
RUN chmod +x /opt/entrypoint.sh

ENTRYPOINT ["/opt/entrypoint.sh"]
