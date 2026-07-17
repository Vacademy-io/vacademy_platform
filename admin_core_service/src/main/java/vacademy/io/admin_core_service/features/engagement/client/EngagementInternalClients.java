package vacademy.io.admin_core_service.features.engagement.client;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpMethod;
import org.springframework.http.ResponseEntity;
import org.springframework.stereotype.Component;
import vacademy.io.common.core.internal_api_wrapper.InternalClientUtils;

import java.util.List;
import java.util.Map;

/**
 * The engagement feature's HMAC calls to sibling services, in one place. Every method THROWS
 * on failure — providers must defer, never fabricate "no data" (this codebase's catch→empty
 * pathology is what turns a sibling-service outage into "this learner ignored us").
 *
 * Endpoints (all batched — one call per cohort):
 * - notification_service POST /internal/v1/engagement/ledger-batch          (Phase 0)
 * - assessment_service   POST /internal/student-analysis/assessment-history/batch
 * - auth_service         POST /internal/v1/analytics/student-login-stats/batch
 */
@Component
@Slf4j
public class EngagementInternalClients {

    @Autowired
    private InternalClientUtils internalClientUtils;

    private final ObjectMapper objectMapper = new ObjectMapper();

    @Value("${spring.application.name}")
    private String clientName;

    @Value("${notification.server.baseurl}")
    private String notificationServerBaseUrl;

    @Value("${assessment.server.baseurl}")
    private String assessmentServerBaseUrl;

    @Value("${auth.server.baseurl}")
    private String authServerBaseUrl;

    /** subjects: [{key(memberId), userId?, phone?, email?}] → LedgerBatchResponse JSON. */
    public JsonNode ledgerBatch(String instituteId, List<Map<String, String>> subjects, int recentWindowDays) {
        Map<String, Object> body = Map.of(
                "instituteId", instituteId,
                "recentWindowDays", recentWindowDays,
                "subjects", subjects);
        return post(notificationServerBaseUrl,
                "/notification-service/internal/v1/engagement/ledger-batch", body, "ledger-batch");
    }

    public JsonNode assessmentHistoryBatch(String instituteId, List<String> userIds, int sinceDays) {
        Map<String, Object> body = Map.of(
                "instituteId", instituteId,
                "userIds", userIds,
                "sinceDays", sinceDays);
        return post(assessmentServerBaseUrl,
                "/assessment-service/internal/student-analysis/assessment-history/batch", body, "assessment-batch");
    }

    public JsonNode loginStatsBatch(List<String> userIds, int sinceDays) {
        Map<String, Object> body = Map.of(
                "userIds", userIds,
                "sinceDays", sinceDays);
        return post(authServerBaseUrl,
                "/auth-service/internal/v1/analytics/student-login-stats/batch", body, "login-stats-batch");
    }

    private JsonNode post(String baseUrl, String route, Object body, String what) {
        try {
            ResponseEntity<String> response = internalClientUtils.makeHmacRequest(
                    clientName, HttpMethod.POST.name(), baseUrl, route, body);
            if (response == null || !response.getStatusCode().is2xxSuccessful() || response.getBody() == null) {
                throw new IllegalStateException(what + " returned "
                        + (response != null ? response.getStatusCode() : "null response"));
            }
            return objectMapper.readTree(response.getBody());
        } catch (Exception e) {
            // Deliberate rethrow: the DataPointRegistry contract treats provider failure as
            // "defer these members", never as an empty payload.
            throw new IllegalStateException("Engagement internal call failed: " + what + " — " + e.getMessage(), e);
        }
    }
}
