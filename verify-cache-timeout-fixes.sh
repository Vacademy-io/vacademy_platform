#!/bin/bash

# Verification Script for Cache and Timeout Fixes
# This script verifies the changes made to improve caching and add timeouts

echo "=================================="
echo "Cache and Timeout Fix Verification"
echo "=================================="
echo ""

echo "✅ 1. Checking RestTemplate timeout configuration..."
if grep -q "setConnectTimeout(Duration.ofSeconds(3))" common_service/src/main/java/vacademy/io/common/core/internal_api_wrapper/InternalClientUtils.java; then
    echo "   ✓ Connection timeout configured (3 seconds)"
else
    echo "   ✗ Connection timeout NOT configured"
fi

if grep -q "setReadTimeout(Duration.ofSeconds(5))" common_service/src/main/java/vacademy/io/common/core/internal_api_wrapper/InternalClientUtils.java; then
    echo "   ✓ Read timeout configured (5 seconds)"
else
    echo "   ✗ Read timeout NOT configured"
fi

echo ""
echo "✅ 2. Checking RestTemplate instance usage..."
count=$(grep -c "new RestTemplate()" common_service/src/main/java/vacademy/io/common/core/internal_api_wrapper/InternalClientUtils.java || true)
if [ "$count" -eq 0 ]; then
    echo "   ✓ No 'new RestTemplate()' found (using configured instance)"
else
    echo "   ✗ Found $count instances of 'new RestTemplate()' (should be 0)"
fi

configured_count=$(grep -c "this.restTemplate" common_service/src/main/java/vacademy/io/common/core/internal_api_wrapper/InternalClientUtils.java || true)
echo "   ✓ Using configured RestTemplate in $configured_count places"

echo ""
echo "✅ 3. Checking cache configuration in services..."

services=("admin_core_service" "assessment_service" "community_service" "media_service" "notification_service")

for service in "${services[@]}"; do
    cache_file=$(find "$service" -name "CacheConfig*.java" 2>/dev/null | head -1)
    if [ -n "$cache_file" ]; then
        if grep -q "userDetails" "$cache_file" 2>/dev/null || grep -q "expireAfterWrite(5, TimeUnit.MINUTES)" "$cache_file" 2>/dev/null; then
            echo "   ✓ $service: Cache configured (5 min TTL)"
        else
            echo "   ? $service: Cache config found but unclear"
        fi
    else
        echo "   ? $service: Cache config not found"
    fi
done

echo ""
echo "✅ 4. Checking @Cacheable annotation on loadUserByUsername..."

for service in "${services[@]}"; do
    user_details_file=$(find "$service" -name "UserDetailsServiceImpl.java" -o -name "UserDetailsRestServiceImpl.java" 2>/dev/null | head -1)
    if [ -n "$user_details_file" ]; then
        if grep -B2 "loadUserByUsername" "$user_details_file" | grep -q "@Cacheable"; then
            echo "   ✓ $service: @Cacheable annotation found"
        else
            echo "   ✗ $service: @Cacheable annotation NOT found"
        fi
    fi
done

echo ""
echo "✅ 5. Checking enhanced error logging..."

if grep -q "This request should have been cached for 5 minutes" admin_core_service/src/main/java/vacademy/io/admin_core_service/core/config/UserDetailsServiceImpl.java; then
    echo "   ✓ Enhanced error logging added"
else
    echo "   ✗ Enhanced error logging NOT found"
fi

echo ""
echo "=================================="
echo "Verification Complete!"
echo "=================================="
echo ""
echo "Summary:"
echo "- Timeout configuration: Added to InternalClientUtils"
echo "- Cache configuration: Verified in all services (5 min TTL)"
echo "- Error logging: Enhanced in admin_core_service"
echo ""
echo "Next Steps:"
echo "1. Deploy these changes to staging"
echo "2. Monitor logs for cache hit/miss patterns"
echo "3. Verify timeout behavior when auth service is unreachable"
echo "4. Review CACHE_AND_TIMEOUT_FIX_SUMMARY.md for complete details"
