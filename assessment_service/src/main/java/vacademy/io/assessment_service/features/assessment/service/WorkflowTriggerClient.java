package vacademy.io.assessment_service.features.assessment.service;

import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.*;
import org.springframework.stereotype.Service;
import org.springframework.web.client.RestTemplate;

import java.util.HashMap;
import java.util.Map;

/**
 * HTTP client to trigger workflows in admin_core_service.
 * Calls the internal workflow trigger endpoint for assessment-related events.
 */
@Slf4j
@Service
public class WorkflowTriggerClient {

    private final RestTemplate restTemplate = new RestTemplate();

    @Value("${admin.core.service.url:http://admin-core-service:8080}")
    private String adminCoreServiceUrl;

    /**
     * Fires a workflow trigger event in admin_core_service.
     *
     * @param eventName   The trigger event name (e.g., ASSESSMENT_CREATE, ASSESSMENT_START)
     * @param eventId     The entity ID (e.g., assessmentId)
     * @param instituteId The institute scope
     * @param contextData Additional context data for the workflow
     */
    public void triggerEvent(String eventName, String eventId, String instituteId, Map<String, Object> contextData) {
        try {
            String url = adminCoreServiceUrl + "/admin-core-service/internal/workflow/trigger";

            Map<String, Object> body = new HashMap<>();
            body.put("eventName", eventName);
            body.put("eventId", eventId);
            body.put("instituteId", instituteId);
            body.put("contextData", contextData != null ? contextData : new HashMap<>());

            HttpHeaders headers = new HttpHeaders();
            headers.setContentType(MediaType.APPLICATION_JSON);

            HttpEntity<Map<String, Object>> request = new HttpEntity<>(body, headers);
            restTemplate.postForEntity(url, request, Map.class);

            log.info("Triggered workflow event: {} for eventId: {} instituteId: {}", eventName, eventId, instituteId);
        } catch (Exception e) {
            // Don't let workflow trigger failure break the main assessment flow
            log.warn("Failed to trigger workflow event {}: {}", eventName, e.getMessage());
        }
    }
}
