package vacademy.io.assessment_service.features.assessment.service;

import jakarta.annotation.PostConstruct;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.*;
import org.springframework.http.client.SimpleClientHttpRequestFactory;
import org.springframework.scheduling.annotation.Async;
import org.springframework.stereotype.Service;
import org.springframework.web.client.RestTemplate;

import java.util.HashMap;
import java.util.Map;

/**
 * HTTP client to trigger workflows in admin_core_service.
 * Calls the internal workflow trigger endpoint for assessment-related events.
 *
 * Triggers run async and with short timeouts so a slow / unreachable
 * admin_core_service can never delay the assessment-create response.
 */
@Slf4j
@Service
public class WorkflowTriggerClient {

    private RestTemplate restTemplate;

    @Value("${admin.core.service.url:http://admin-core-service:8080}")
    private String adminCoreServiceUrl;

    @Value("${workflow.trigger.connect-timeout-ms:2000}")
    private int connectTimeoutMs;

    @Value("${workflow.trigger.read-timeout-ms:5000}")
    private int readTimeoutMs;

    @PostConstruct
    void init() {
        SimpleClientHttpRequestFactory factory = new SimpleClientHttpRequestFactory();
        factory.setConnectTimeout(connectTimeoutMs);
        factory.setReadTimeout(readTimeoutMs);
        this.restTemplate = new RestTemplate(factory);
    }

    /**
     * Fires a workflow trigger event in admin_core_service. Runs async and
     * fire-and-forget — failures are logged but never propagate to the caller.
     *
     * @param eventName   The trigger event name (e.g., ASSESSMENT_CREATE, ASSESSMENT_START)
     * @param eventId     The entity ID (e.g., assessmentId)
     * @param instituteId The institute scope
     * @param contextData Additional context data for the workflow
     */
    @Async
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
            // Don't let workflow trigger failure break the main assessment flow.
            log.warn("Failed to trigger workflow event {}: {}", eventName, e.getMessage());
        }
    }
}
