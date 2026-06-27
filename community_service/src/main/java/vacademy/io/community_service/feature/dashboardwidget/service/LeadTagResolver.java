package vacademy.io.community_service.feature.dashboardwidget.service;

import com.fasterxml.jackson.databind.ObjectMapper;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpMethod;
import org.springframework.http.ResponseEntity;
import org.springframework.stereotype.Service;
import vacademy.io.common.core.internal_api_wrapper.InternalClientUtils;

import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;

/**
 * Resolves an institute's lead tag (PROD|LEAD|TEST|FREE_TRIAL), which lives in admin-core, so the
 * institute read path can match LEAD_TAG-targeted widgets. Calls admin-core's internal HMAC endpoint
 * and caches the result with a short TTL (read-time resolution is always correct — institutes added
 * to or retagged into a group pick up broadcasts on the next cache miss).
 */
@Service
@Slf4j
public class LeadTagResolver {

    private static final long TTL_MILLIS = 5 * 60 * 1000L;

    @Autowired
    private InternalClientUtils internalClientUtils;
    @Autowired
    private ObjectMapper objectMapper;

    @Value("${spring.application.name}")
    private String clientName;

    @Value("${ADMIN_CORE_SERVICE_BASE_URL:http://admin-core-service:8072}")
    private String adminCoreBaseUrl;

    private final Map<String, CachedTag> cache = new ConcurrentHashMap<>();

    /** The institute's lead tag, or {@code null} if unknown / unreachable. Never throws. */
    public String resolve(String instituteId) {
        if (instituteId == null || instituteId.isBlank()) {
            return null;
        }
        CachedTag cached = cache.get(instituteId);
        if (cached != null && !cached.isExpired()) {
            return cached.tag;
        }
        String tag = fetch(instituteId);
        cache.put(instituteId, new CachedTag(tag, System.currentTimeMillis()));
        return tag;
    }

    private String fetch(String instituteId) {
        try {
            String route = "/admin-core-service/internal/institute/v1/" + instituteId + "/lead-tag";
            ResponseEntity<String> response = internalClientUtils.makeHmacRequest(
                    clientName, HttpMethod.GET.name(), adminCoreBaseUrl, route, null);
            if (response.getBody() == null) {
                return null;
            }
            Map<?, ?> body = objectMapper.readValue(response.getBody(), Map.class);
            Object tag = body.get("leadTag");
            return tag == null ? null : tag.toString();
        } catch (Exception e) {
            log.warn("Failed to resolve lead tag for institute {}: {}", instituteId, e.getMessage());
            return null;
        }
    }

    private static final class CachedTag {
        private final String tag;
        private final long fetchedAt;

        private CachedTag(String tag, long fetchedAt) {
            this.tag = tag;
            this.fetchedAt = fetchedAt;
        }

        private boolean isExpired() {
            return System.currentTimeMillis() - fetchedAt > TTL_MILLIS;
        }
    }
}
