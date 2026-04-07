package vacademy.io.assessment_service.features.client;

import com.fasterxml.jackson.databind.ObjectMapper;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.cache.annotation.Cacheable;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.stereotype.Service;
import vacademy.io.assessment_service.features.learner_assessment.dto.ReportBrandingDto;
import vacademy.io.common.core.internal_api_wrapper.InternalClientUtils;

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

    @Cacheable(value = "reportBranding", key = "#instituteId", unless = "#result.primaryColor == null")
    public ReportBrandingDto getReportBranding(String instituteId) {
        try {
            String route = "/admin-core-service/internal/institute/v1/" + instituteId
                    + "/setting?settingKey=ASSESSMENT_SETTING";
            ResponseEntity<String> response = internalClientUtils.makeHmacRequest(
                    clientName, "GET", adminCoreServiceBaseUrl, route, null);

            if (response.getStatusCode() == HttpStatus.OK && response.getBody() != null) {
                Map<String, Object> settingData = objectMapper.readValue(response.getBody(), Map.class);
                Object brandingObj = settingData.get("reportBranding");
                if (brandingObj != null) {
                    return objectMapper.convertValue(brandingObj, ReportBrandingDto.class);
                }
            }
        } catch (Exception e) {
            log.warn("Failed to fetch report branding for institute {}: {}", instituteId, e.getMessage());
        }
        return ReportBrandingDto.builder().build();
    }
}
