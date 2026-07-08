package vacademy.io.admin_core_service.features.learner.service;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ObjectNode;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.scheduling.annotation.Async;
import org.springframework.stereotype.Service;
import org.springframework.util.StringUtils;
import vacademy.io.admin_core_service.features.course_settings.service.PackageSettingService;
import vacademy.io.admin_core_service.features.institute.service.setting.InstituteSettingService;
import vacademy.io.admin_core_service.features.institute_learner.entity.StudentSessionInstituteGroupMapping;
import vacademy.io.admin_core_service.features.institute_learner.repository.StudentSessionRepository;

import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.nio.charset.StandardCharsets;
import java.time.Duration;
import java.util.Base64;
import java.util.LinkedHashMap;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;

/**
 * Pushes learner profile edits (name/email) to every WordPress LMS the
 * learner's courses are connected to, via the site's CRM plugin
 * ({@code /wp-json/crm/v1/edit-user}, Basic auth with the same
 * apiKey/apiSecret stored in LMS_SETTING). Best-effort and async: the
 * profile edit never fails because an LMS is unreachable, and a learner
 * missing on the LMS is the LMS's 4xx to log, not ours to surface.
 *
 * <p>Connection discovery mirrors what the enrolment workflow reads: each
 * enrolled package's {@code LMS_SETTING} (double-data envelope), falling back
 * to the institute-level setting only when no course-level config exists.
 * Only WordPress-shaped connections (apiUrl + apiKey + apiSecret) are synced —
 * Moodle has no crm/v1 plugin.</p>
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class LearnerLmsUserSyncService {

    private static final String LMS_SETTING_KEY = "LMS_SETTING";
    private static final List<String> ACTIVE_STATUSES = List.of("ACTIVE");

    private final StudentSessionRepository studentSessionRepository;
    private final PackageSettingService packageSettingService;
    private final InstituteSettingService instituteSettingService;
    private final ObjectMapper objectMapper;

    @Async
    public void syncProfileUpdate(String userId, String oldEmail, String newEmail, String newFullName) {
        try {
            doSync(userId, oldEmail, newEmail, newFullName);
        } catch (Exception e) {
            log.warn("LMS profile sync failed for user {}: {}", userId, e.getMessage());
        }
    }

    private void doSync(String userId, String oldEmail, String newEmail, String newFullName) {
        if (!StringUtils.hasText(oldEmail)) {
            log.debug("LMS profile sync skipped for user {}: no existing email to match on", userId);
            return;
        }

        List<StudentSessionInstituteGroupMapping> mappings = studentSessionRepository
                .findAllByUserIdAndStatusIn(userId, ACTIVE_STATUSES);
        if (mappings.isEmpty()) {
            return;
        }

        Set<String> packageIds = new LinkedHashSet<>();
        Set<String> instituteIds = new LinkedHashSet<>();
        for (StudentSessionInstituteGroupMapping m : mappings) {
            if (m.getPackageSession() != null && m.getPackageSession().getPackageEntity() != null) {
                packageIds.add(m.getPackageSession().getPackageEntity().getId());
            }
            if (m.getInstitute() != null && StringUtils.hasText(m.getInstitute().getId())) {
                instituteIds.add(m.getInstitute().getId());
            }
        }

        // Distinct WordPress connections across the learner's courses,
        // deduped by (normalized apiUrl, apiKey) so one site is called once.
        Map<String, JsonNode> connections = new LinkedHashMap<>();
        for (String packageId : packageIds) {
            collectWordpressConnections(readPackageLmsSetting(packageId), connections);
        }
        if (connections.isEmpty()) {
            for (String instituteId : instituteIds) {
                collectWordpressConnections(readInstituteLmsSetting(instituteId), connections);
            }
        }
        if (connections.isEmpty()) {
            log.debug("LMS profile sync: no WordPress LMS connections for user {}", userId);
            return;
        }

        ObjectNode payload = buildEditUserPayload(oldEmail, newEmail, newFullName);
        for (JsonNode conn : connections.values()) {
            pushEditUser(conn, payload, userId);
        }
    }

    private ObjectNode buildEditUserPayload(String oldEmail, String newEmail, String newFullName) {
        ObjectNode payload = objectMapper.createObjectNode();
        payload.put("email", oldEmail.trim());
        if (StringUtils.hasText(newEmail) && !newEmail.trim().equalsIgnoreCase(oldEmail.trim())) {
            payload.put("new_email", newEmail.trim());
        }
        if (StringUtils.hasText(newFullName)) {
            String[] parts = newFullName.trim().split("\\s+", 2);
            payload.put("first_name", parts[0]);
            payload.put("last_name", parts.length > 1 ? parts[1] : "");
        }
        return payload;
    }

    private void pushEditUser(JsonNode conn, ObjectNode payload, String userId) {
        String apiUrl = conn.path("apiUrl").asText("");
        String apiKey = conn.path("apiKey").asText("");
        String apiSecret = conn.path("apiSecret").asText("");
        String editUserUrl = deriveEditUserUrl(apiUrl);
        try {
            String basic = Base64.getEncoder()
                    .encodeToString((apiKey + ":" + apiSecret).getBytes(StandardCharsets.UTF_8));
            HttpClient client = HttpClient.newBuilder()
                    .connectTimeout(Duration.ofSeconds(8))
                    .followRedirects(HttpClient.Redirect.NORMAL)
                    .build();
            HttpRequest request = HttpRequest.newBuilder()
                    .uri(URI.create(editUserUrl))
                    .timeout(Duration.ofSeconds(15))
                    .header("Content-Type", "application/json")
                    .header("Authorization", "Basic " + basic)
                    .POST(HttpRequest.BodyPublishers.ofString(payload.toString()))
                    .build();
            HttpResponse<String> response = client.send(request, HttpResponse.BodyHandlers.ofString());
            if (response.statusCode() >= 200 && response.statusCode() < 300) {
                log.info("LMS profile sync ok for user {} at {}", userId, editUserUrl);
            } else {
                log.warn("LMS profile sync for user {} at {} returned HTTP {}: {}", userId, editUserUrl,
                        response.statusCode(), truncate(response.body()));
            }
        } catch (Exception e) {
            log.warn("LMS profile sync for user {} at {} failed: {}", userId, editUserUrl, e.getMessage());
        }
    }

    /**
     * The CRM plugin lives at {@code <site>/wp-json/crm/v1/edit-user}; the
     * stored apiUrl is usually {@code <site>/wp-json/wp/v2}, so cut back to
     * the /wp-json root before appending the plugin route.
     */
    private String deriveEditUserUrl(String apiUrl) {
        String url = apiUrl.trim();
        if (url.endsWith("/")) {
            url = url.substring(0, url.length() - 1);
        }
        int wpJson = url.indexOf("/wp-json");
        String base = wpJson >= 0 ? url.substring(0, wpJson + "/wp-json".length()) : url + "/wp-json";
        return base + "/crm/v1/edit-user";
    }

    /** Adds every WordPress-shaped connection in a setting node (top-level fields or connections[]). */
    private void collectWordpressConnections(JsonNode inner, Map<String, JsonNode> out) {
        if (inner == null || !inner.isObject()) {
            return;
        }
        if (isWordpressConnection(inner)) {
            out.putIfAbsent(connectionKey(inner), inner);
        }
        JsonNode list = inner.path("connections");
        if (list.isArray()) {
            for (JsonNode conn : list) {
                if (isWordpressConnection(conn)) {
                    out.putIfAbsent(connectionKey(conn), conn);
                }
            }
        }
    }

    private boolean isWordpressConnection(JsonNode node) {
        return StringUtils.hasText(node.path("apiUrl").asText(""))
                && StringUtils.hasText(node.path("apiKey").asText(""))
                && StringUtils.hasText(node.path("apiSecret").asText(""));
    }

    private String connectionKey(JsonNode node) {
        String url = node.path("apiUrl").asText("").trim().toLowerCase();
        if (url.endsWith("/")) {
            url = url.substring(0, url.length() - 1);
        }
        return url + "|" + node.path("apiKey").asText("").trim().toLowerCase();
    }

    /** Unwraps the package's LMS_SETTING double-data envelope to its inner config node. */
    private JsonNode readPackageLmsSetting(String packageId) {
        try {
            Object data = packageSettingService.getSettingData(packageId, LMS_SETTING_KEY);
            return unwrap(data);
        } catch (Exception e) {
            return null;
        }
    }

    private JsonNode readInstituteLmsSetting(String instituteId) {
        try {
            Object data = instituteSettingService.getSettingByInstituteIdAndKey(instituteId, LMS_SETTING_KEY);
            return unwrap(data);
        } catch (Exception e) {
            return null;
        }
    }

    private JsonNode unwrap(Object data) {
        if (data == null) {
            return null;
        }
        JsonNode node = objectMapper.convertValue(data, JsonNode.class);
        JsonNode inner = node.path("data");
        if (inner.isObject()) {
            return inner;
        }
        return node.isObject() ? node : null;
    }

    private static String truncate(String s) {
        if (s == null) {
            return null;
        }
        return s.length() > 300 ? s.substring(0, 300) + "…" : s;
    }
}
