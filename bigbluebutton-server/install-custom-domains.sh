#!/bin/bash
# =============================================================
# Per-institute custom live-class domains (white-labelling)
# =============================================================
# Makes this BBB server answer for institute-owned hostnames such as
# meet.zoeedtech.com, in addition to its canonical pool domain.
#
# Usage:
#   bash install-custom-domains.sh <CANONICAL_DOMAIN> [comma,separated,aliases]
#
# Example:
#   bash install-custom-domains.sh meet.vacademy.io meet.zoeedtech.com,live.school.in
#
# Safe to run on every boot: every step is idempotent, and the script is
# written so the CANONICAL domain keeps working even if every alias step
# fails. An alias that cannot get a certificate degrades to a TLS warning on
# that one hostname; it never takes the pool server down.
#
# Ordering matters. This MUST run AFTER `bbb-conf --setip` and after the
# stale-IP sweep, because both rewrite /etc/nginx/sites-available/bigbluebutton
# and would drop the server_name list this script installs.
#
# Requires (for certificate expansion only):
#   /etc/letsencrypt/cloudflare.ini   Cloudflare API token, DNS:Edit on the zones
# =============================================================

set -uo pipefail

CANONICAL="${1:?Usage: bash install-custom-domains.sh <CANONICAL_DOMAIN> [aliases]}"
ALIAS_CSV="${2:-}"

SITE=/etc/nginx/sites-available/bigbluebutton
WEB=/usr/share/bigbluebutton/nginx/web
CF_INI=/etc/letsencrypt/cloudflare.ini
LOG_TAG="bbb-custom-domains"
STAMP=$(date +%Y%m%d-%H%M%S)

log() { echo "[$LOG_TAG] $*"; }

# ── Normalise the alias list ─────────────────────────────────
# Drop blanks, lowercase, strip scheme/path, reject anything that is not a
# plain hostname. The backend validates too, but this list is about to be
# interpolated into an nginx directive and a certbot command line, so it is
# re-checked here rather than trusted over the wire.
ALIASES=""
if [ -n "$ALIAS_CSV" ]; then
    for raw in ${ALIAS_CSV//,/ }; do
        h=$(echo "$raw" | tr '[:upper:]' '[:lower:]' | sed -E 's#^[a-z][a-z0-9+.-]*://##; s#/.*$##; s#^[^@]*@##')
        [ -z "$h" ] && continue
        case "$h" in *:*) log "  skip (port not allowed): $raw"; continue ;; esac
        if ! echo "$h" | grep -qE '^([a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,}$'; then
            log "  skip (not a hostname): $raw"
            continue
        fi
        [ "$h" = "$CANONICAL" ] && continue
        case " $ALIASES " in *" $h "*) continue ;; esac
        ALIASES="${ALIASES:+$ALIASES }$h"
    done
fi

if [ -n "$ALIASES" ]; then
    log "aliases: $ALIASES"
else
    log "no aliases configured — restoring canonical-only config"
fi

# ── 1. Location-level redirect rewrite ───────────────────────
# bbb-web builds its join redirect from bigbluebutton.web.serverURL, which is
# absolute, so an alias host would be bounced straight back to the canonical
# domain. Rewrite Location to whatever host the client actually asked for.
#
# This has to sit INSIDE each location block: the packaged config sets
# `proxy_redirect default;` per-location, which overrides anything inherited
# from the server level. The `default` line is kept and ours added after it,
# so upstream 127.0.0.1 rewrites still work.
#
# For the canonical host the rewrite is an identity transform, which is why it
# is safe to leave installed permanently.
REWRITE='proxy_redirect     ~^https://[^/]+/(.*)$ https://$host/$1;'
if [ -f "$WEB" ]; then
    if grep -qF 'proxy_redirect     ~^https://[^/]+/(.*)$' "$WEB"; then
        log "1/4 redirect rewrite already present"
    else
        cp -a "$WEB" "$WEB.bak-$STAMP"
        perl -0pi -e 's{^(\s*)proxy_redirect(\s+)default;}{$1proxy_redirect$2default;\n$1'"$REWRITE"'}gm' "$WEB"
        log "1/4 redirect rewrite added ($(grep -c 'proxy_redirect     ~\^https' "$WEB") locations)"
    fi
else
    log "1/4 WARNING: $WEB not found — skipping redirect rewrite"
fi

# ── 2. server_name + host-preserving HTTP redirect ───────────
cp -a "$SITE" "$SITE.bak-$STAMP"
ALL_NAMES="$CANONICAL${ALIASES:+ $ALIASES}"
sed -i -E "s/^([[:space:]]*)server_name[[:space:]]+.*;/\1server_name $ALL_NAMES;/" "$SITE"
# With more than one server_name, $server_name expands to the FIRST one, so an
# alias hitting :80 would be redirected to the canonical host. $host keeps the
# visitor on the hostname they typed.
sed -i 's|return 301 https://\$server_name\$request_uri;|return 301 https://$host$request_uri;|' "$SITE"
log "2/4 server_name -> $ALL_NAMES"

# ── 3. Certificate ───────────────────────────────────────────
# Expand the EXISTING lineage so haproxy's certbundle path never changes; its
# deploy hook rebuilds the bundle and reloads haproxy.
#
# DNS-01, not HTTP-01: this box gets a new public IP on every restore, so an
# HTTP-01 challenge fails for any hostname whose A record has not caught up
# yet. DNS-01 also lets a certificate be issued before the record exists.
if [ -z "$ALIASES" ]; then
    log "3/4 no aliases — leaving certificate untouched"
elif [ ! -f "$CF_INI" ]; then
    log "3/4 WARNING: $CF_INI missing — cannot expand certificate. Aliases will serve a TLS warning."
else
    LIVE=/etc/letsencrypt/live/$CANONICAL/cert.pem
    WANT=$(printf '%s\n' "$CANONICAL" $ALIASES | sort -u | tr '\n' ' ')
    HAVE=""
    [ -f "$LIVE" ] && HAVE=$(openssl x509 -in "$LIVE" -noout -ext subjectAltName 2>/dev/null \
        | tr ',' '\n' | sed -n 's/.*DNS://p' | tr -d ' ' | sort -u | tr '\n' ' ')

    if [ "$WANT" = "$HAVE" ]; then
        log "3/4 certificate already covers: $HAVE"
    else
        log "3/4 expanding certificate"
        log "     have: ${HAVE:-<none>}"
        log "     want: $WANT"
        if ! certbot plugins 2>/dev/null | grep -qi dns-cloudflare; then
            log "     installing python3-certbot-dns-cloudflare"
            DEBIAN_FRONTEND=noninteractive apt-get install -y -q python3-certbot-dns-cloudflare >/dev/null 2>&1
        fi
        D_ARGS=""
        for d in $WANT; do D_ARGS="$D_ARGS -d $d"; done
        # shellcheck disable=SC2086
        if certbot certonly --dns-cloudflare \
              --dns-cloudflare-credentials "$CF_INI" \
              --dns-cloudflare-propagation-seconds 30 \
              --cert-name "$CANONICAL" $D_ARGS \
              --non-interactive --agree-tos --expand 2>&1 | tail -5; then
            log "     certificate expanded"
        else
            # Non-fatal on purpose: the previous certificate is still in place and
            # still valid for the canonical domain, so classes keep working.
            log "     WARNING: certbot failed — keeping the existing certificate"
        fi
    fi
fi

# ── 4. Validate and reload ───────────────────────────────────
if nginx -t 2>&1 | tail -1; then
    systemctl reload nginx && log "4/4 nginx reloaded"
else
    log "4/4 ERROR: nginx config test failed — rolling back"
    cp -a "$SITE.bak-$STAMP" "$SITE"
    [ -f "$WEB.bak-$STAMP" ] && cp -a "$WEB.bak-$STAMP" "$WEB"
    nginx -t >/dev/null 2>&1 && systemctl reload nginx
    log "4/4 rolled back to the previous config"
    exit 1
fi

# Keep the backup directory from growing without bound across daily restores.
find /etc/nginx/sites-available /usr/share/bigbluebutton/nginx \
     -maxdepth 1 -name '*.bak-*' -mtime +7 -delete 2>/dev/null || true

log "done: serving $ALL_NAMES"
