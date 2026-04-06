#!/bin/bash
# =============================================================
# BBB Health Check — run via cron or monitoring tool
# =============================================================
# Add to crontab:  */5 * * * * /opt/vacademy/health-check.sh
# =============================================================

BBB_URL="${BBB_URL:-https://bbb.vacademy.io}"
WEBHOOK_URL="${WEBHOOK_URL:-}"  # Optional: Slack/Discord webhook for alerts

check_service() {
    local name="$1"
    if systemctl is-active --quiet "$name" 2>/dev/null; then
        echo "  [OK] $name"
        return 0
    else
        echo "  [FAIL] $name"
        return 1
    fi
}

echo "BBB Health Check — $(date)"
echo "---"

FAILED=0

# Check critical BBB services
for svc in bbb-web bbb-apps-akka bbb-fsesl-akka nginx redis-server; do
    check_service "$svc" || FAILED=$((FAILED + 1))
done

# Check HTTPS endpoint
HTTP_STATUS=$(curl -s -o /dev/null -w "%{http_code}" "$BBB_URL/bigbluebutton/api" 2>/dev/null || echo "000")
if [ "$HTTP_STATUS" = "200" ]; then
    echo "  [OK] API endpoint (HTTP $HTTP_STATUS)"
else
    echo "  [FAIL] API endpoint (HTTP $HTTP_STATUS)"
    FAILED=$((FAILED + 1))
fi

# Check disk usage
DISK_USAGE=$(df / --output=pcent | tail -1 | tr -d ' %')
if [ "$DISK_USAGE" -gt 85 ]; then
    echo "  [WARN] Disk usage at ${DISK_USAGE}%"
    FAILED=$((FAILED + 1))
fi

# Alert if failures
if [ "$FAILED" -gt 0 ] && [ -n "$WEBHOOK_URL" ]; then
    curl -s -X POST "$WEBHOOK_URL" \
        -H 'Content-Type: application/json' \
        -d "{\"text\": \"BBB Alert: $FAILED check(s) failed on $(hostname)\"}" \
        >/dev/null 2>&1
fi

echo "---"
echo "Result: $FAILED failure(s)"
exit "$FAILED"
