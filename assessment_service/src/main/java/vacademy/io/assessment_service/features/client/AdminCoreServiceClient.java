package vacademy.io.assessment_service.features.client;

import com.fasterxml.jackson.databind.ObjectMapper;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.cache.annotation.Cacheable;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.stereotype.Service;
import org.springframework.util.StringUtils;
import vacademy.io.assessment_service.features.learner_assessment.dto.ReportBrandingDto;
import vacademy.io.common.core.internal_api_wrapper.InternalClientUtils;

import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

@Service
@RequiredArgsConstructor
@Slf4j
public class AdminCoreServiceClient {

    private final InternalClientUtils internalClientUtils;
    private final ObjectMapper objectMapper;

    @Value("${admin.core.service.baseurl:http://localhost:8072}")
    private String adminCoreServiceBaseUrl;

    @Value("${spring.application.name:assessment_service}")
    private String clientName;

    public void saveAssessmentRawDataAsync(Map<String, Object> assessmentRawDataRequest) {
        try {
            String route = "/admin-core-service/llm-analytics/assessment";
            ResponseEntity<String> response = internalClientUtils.makeHmacRequest(
                    clientName, "POST", adminCoreServiceBaseUrl, route, assessmentRawDataRequest);
            if (response.getStatusCode() == HttpStatus.OK || response.getStatusCode() == HttpStatus.CREATED) {
                log.info("Assessment data sent successfully to admin-core service");
            } else {
                log.warn("Unexpected response status: {}", response.getStatusCode());
            }
        } catch (Exception e) {
            log.error("Error saving assessment data - continuing anyway. Error: {}", e.getMessage(), e);
        }
    }

    /**
     * Fetches report branding settings for an institute from admin-core-service.
     * Uses the internal HMAC-authenticated endpoint. Cached for 30 minutes per institute.
     */
    /**
     * Fetches processed AI report JSON from admin-core-service for a given user and assessment.
     * Returns null if not found or not yet processed.
     */
    public String getProcessedAIReport(String userId, String assessmentId) {
        try {
            String route = "/admin-core-service/llm-analytics/internal/processed-logs?userId="
                    + userId + "&sourceId=" + assessmentId;
            ResponseEntity<String> response = internalClientUtils.makeHmacRequest(
                    clientName, "GET", adminCoreServiceBaseUrl, route, null);

            if (response.getStatusCode() == HttpStatus.OK && response.getBody() != null) {
                Map<String, Object> body = objectMapper.readValue(response.getBody(), Map.class);
                java.util.List<?> logs = (java.util.List<?>) body.get("activity_logs");
                if (logs != null && !logs.isEmpty()) {
                    Map<String, Object> firstLog = (Map<String, Object>) logs.get(0);
                    Object processedJson = firstLog.get("processed_json");
                    return processedJson != null ? processedJson.toString() : null;
                }
            }
        } catch (Exception e) {
            log.warn("Failed to fetch AI report for user {} assessment {}: {}", userId, assessmentId, e.getMessage());
        }
        return null;
    }

    /**
     * Report branding for an institute, read from {@code ASSESSMENT_SETTING.reportBranding}.
     * <p>
     * Two things matter here beyond the plain fetch:
     * <ul>
     *   <li><b>Institute fallback.</b> Most admins set their logo and theme colour on the
     *       institute itself and never open Settings → Assessment → Report Branding, so
     *       {@code reportBranding} is absent (or still carries the untouched default colour).
     *       Falling back to the institute's own logo/theme means reports look branded without
     *       the admin having to configure branding twice.</li>
     *   <li><b>Never cache a failed lookup.</b> This used to return a fully-populated default
     *       DTO on any error, which {@code unless = "#result.primaryColor == null"} then happily
     *       cached — one blip pinned every report to the default palette for the whole TTL.
     *       We now return {@code null} on failure and let callers apply defaults; nulls are not
     *       cached.</li>
     * </ul>
     * Callers must treat {@code null} as "unbranded" (all of them already do).
     */
    @Cacheable(value = "reportBranding", key = "#instituteId", unless = "#result == null")
    public ReportBrandingDto getReportBranding(String instituteId) {
        ReportBrandingDto branding = null;
        try {
            String route = "/admin-core-service/internal/institute/v1/" + instituteId
                    + "/setting?settingKey=ASSESSMENT_SETTING";
            ResponseEntity<String> response = internalClientUtils.makeHmacRequest(
                    clientName, "GET", adminCoreServiceBaseUrl, route, null);

            if (response.getStatusCode() == HttpStatus.OK && response.getBody() != null
                    && !response.getBody().isBlank() && !"null".equals(response.getBody().trim())) {
                Map<String, Object> settingData = objectMapper.readValue(response.getBody(), Map.class);
                Object brandingObj = settingData.get("reportBranding");
                if (brandingObj != null) {
                    branding = objectMapper.convertValue(brandingObj, ReportBrandingDto.class);
                }
            }
        } catch (Exception e) {
            log.warn("Failed to fetch report branding for institute {}: {}", instituteId, e.getMessage());
            return null;
        }

        try {
            return applyInstituteFallback(branding, instituteId);
        } catch (Exception e) {
            log.warn("Failed to apply institute branding fallback for institute {}: {}", instituteId, e.getMessage());
            return branding;
        }
    }

    /** Default primary colour baked into {@link ReportBrandingDto} — treated as "not configured". */
    private static final String DEFAULT_PRIMARY_COLOR = "#FF6B35";

    /**
     * Fills the logo and primary colour from the institute profile when report branding
     * leaves them unset. Anything the admin explicitly configured always wins.
     */
    private ReportBrandingDto applyInstituteFallback(ReportBrandingDto branding, String instituteId) {
        boolean logoMissing = branding == null || !StringUtils.hasText(branding.getLogoFileId());
        boolean colorMissing = branding == null || !StringUtils.hasText(branding.getPrimaryColor())
                || DEFAULT_PRIMARY_COLOR.equalsIgnoreCase(branding.getPrimaryColor());
        if (!logoMissing && !colorMissing) return branding;

        Map<String, Object> institute = getInstituteInfo(instituteId);
        if (institute == null || institute.isEmpty()) return branding;

        String themeCode = firstNonBlank(institute, "institute_theme_code", "instituteThemeCode");
        String logoFileId = firstNonBlank(institute, "institute_logo_file_id", "instituteLogoFileId");

        ReportBrandingDto result = branding != null ? branding : ReportBrandingDto.builder().build();
        if (logoMissing && StringUtils.hasText(logoFileId)) result.setLogoFileId(logoFileId);
        if (colorMissing && StringUtils.hasText(themeCode)) result.setPrimaryColor(themeCode);
        return result;
    }

    /** Institute profile as a raw map (naming strategy differs per environment, so read both forms). */
    private Map<String, Object> getInstituteInfo(String instituteId) {
        try {
            String route = "/admin-core-service/internal/institute/v1/" + instituteId;
            ResponseEntity<String> response = internalClientUtils.makeHmacRequest(
                    clientName, "GET", adminCoreServiceBaseUrl, route, null);
            if (response.getStatusCode() == HttpStatus.OK && response.getBody() != null) {
                return objectMapper.readValue(response.getBody(), Map.class);
            }
        } catch (Exception e) {
            log.warn("Failed to fetch institute {} for branding fallback: {}", instituteId, e.getMessage());
        }
        return null;
    }

    private static String firstNonBlank(Map<String, Object> map, String... keys) {
        for (String key : keys) {
            Object value = map.get(key);
            if (value != null && StringUtils.hasText(value.toString())) return value.toString();
        }
        return null;
    }

    private static final String STUDENT = "STUDENT";
    private static final String LEARNER = "LEARNER";

    /**
     * Reads {@code ASSESSMENT_SETTING.resultNotifications.roles} — a map of
     * role-name -> should-receive-result-notification — for an institute.
     * Returns an empty map when unset/unreadable (callers apply per-role defaults).
     * Not cached, so a Settings toggle takes effect on the next result release.
     */
    public Map<String, Boolean> getResultNotificationRoles(String instituteId) {
        Map<String, Boolean> roles = new HashMap<>();
        try {
            String route = "/admin-core-service/internal/institute/v1/" + instituteId
                    + "/setting?settingKey=ASSESSMENT_SETTING";
            ResponseEntity<String> response = internalClientUtils.makeHmacRequest(
                    clientName, "GET", adminCoreServiceBaseUrl, route, null);
            if (response.getStatusCode() == HttpStatus.OK && response.getBody() != null) {
                Map<String, Object> settingData = objectMapper.readValue(response.getBody(), Map.class);
                Object rn = settingData.get("resultNotifications");
                if (rn instanceof Map) {
                    Object rolesObj = ((Map<?, ?>) rn).get("roles");
                    if (rolesObj instanceof Map) {
                        for (Map.Entry<?, ?> e : ((Map<?, ?>) rolesObj).entrySet()) {
                            if (e.getKey() != null && e.getValue() instanceof Boolean) {
                                roles.put(e.getKey().toString(), (Boolean) e.getValue());
                            }
                        }
                    }
                }
            }
        } catch (Exception e) {
            log.warn("Failed to fetch result-notification roles for institute {}: {}", instituteId, e.getMessage());
        }
        return roles;
    }

    /**
     * Staff roles explicitly enabled to receive the "result released"/"reevaluated"
     * email (the learner audience is excluded — it's handled separately). Default
     * for every staff role (incl. ADMIN) is OFF, so this is simply the explicitly
     * enabled non-learner roles.
     */
    public List<String> enabledStaffResultRoles(String instituteId) {
        List<String> out = new ArrayList<>();
        for (Map.Entry<String, Boolean> e : getResultNotificationRoles(instituteId).entrySet()) {
            String role = e.getKey();
            if (role != null && Boolean.TRUE.equals(e.getValue())
                    && !STUDENT.equalsIgnoreCase(role) && !LEARNER.equalsIgnoreCase(role)) {
                out.add(role);
            }
        }
        return out;
    }

    /**
     * Whether learners should receive result/report notifications. Default ON
     * (current behaviour) — only disabled when an admin explicitly turns the
     * learner/student toggle off.
     */
    public boolean isLearnerResultNotificationEnabled(String instituteId) {
        for (Map.Entry<String, Boolean> e : getResultNotificationRoles(instituteId).entrySet()) {
            String role = e.getKey();
            if (role != null && (STUDENT.equalsIgnoreCase(role) || LEARNER.equalsIgnoreCase(role))) {
                return Boolean.TRUE.equals(e.getValue());
            }
        }
        return true;
    }
}
