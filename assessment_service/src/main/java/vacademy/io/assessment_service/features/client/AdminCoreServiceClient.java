package vacademy.io.assessment_service.features.client;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.stereotype.Service;
import vacademy.io.common.core.internal_api_wrapper.InternalClientUtils;

import java.util.Map;

/**
 * Client for communicating with Admin Core Service
 * Handles LLM activity analytics and other admin-core integrations
 */
@Service
@RequiredArgsConstructor
@Slf4j
public class AdminCoreServiceClient {

    private final InternalClientUtils internalClientUtils;

    @Value("${admin.core.service.baseurl:http://localhost:8072}")
    private String adminCoreServiceBaseUrl;

    @Value("${spring.application.name:assessment_service}")
    private String clientName;

    /**
     * Save assessment raw data for LLM analytics (Synchronous)
     * This will not block the user since assessment submission returns immediately
     * after saving attempt
     *
     * @param assessmentRawDataRequest The assessment submission data to be analyzed
     */
    public void saveAssessmentRawDataAsync(Map<String, Object> assessmentRawDataRequest) {
        try {
            String route = "/admin-core-service/llm-analytics/assessment";

            ResponseEntity<String> response = internalClientUtils.makeHmacRequest(
                    clientName,
                    "POST",
                    adminCoreServiceBaseUrl,
                    route,
                    assessmentRawDataRequest);

            if (response.getStatusCode() == HttpStatus.OK || response.getStatusCode() == HttpStatus.CREATED) {
                log.info("Assessment data sent successfully to admin-core service");
            } else {
                log.warn("Unexpected response status: {}", response.getStatusCode());
            }

        } catch (Exception e) {
            log.error("Error saving assessment data - continuing anyway. Error: {}", e.getMessage(), e);
            // Don't throw - we don't want to impact the main assessment flow
        }
    }
}