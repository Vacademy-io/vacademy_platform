package vacademy.io.assessment_service.features.assessment.client;

import com.fasterxml.jackson.databind.JsonNode;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.http.client.reactive.JdkClientHttpConnector;
import org.springframework.stereotype.Component;
import org.springframework.web.reactive.function.client.WebClient;
import reactor.util.retry.Retry;
import vacademy.io.assessment_service.features.assessment.dto.evaluation_ai.CopyCheckGradeRequestDto;

import java.net.http.HttpClient;
import java.time.Duration;
import java.util.Map;

/**
 * WebClient wrapper for ai_service /copy-check/* endpoints. All calls send the
 * shared internal-service token so ai_service's require_internal_service_token
 * dependency accepts them.
 */
@Component
@Slf4j
public class AiServiceCopyCheckClient {

    private final WebClient webClient;
    private final String internalToken;

    public AiServiceCopyCheckClient(
            @Value("${ai.service.base.url:http://ai-service:8077}") String aiServiceBaseUrl,
            // The cluster already has a shared service-to-service secret in
            // INTERNAL_SERVICE_TOKEN (set on both assessment-service and
            // ai-service). Reuse it instead of introducing a separate one.
            @Value("${internal.service.token:${ai.service.internal.token:}}") String internalToken
    ) {
        this.internalToken = internalToken;
        // ai_service runs uvicorn (HTTP/1.1-only). The JDK HttpClient that
        // Spring uses under the hood defaults to HTTP/2 with an h2c upgrade
        // probe, which uvicorn's h11 parser logs as "Unsupported upgrade
        // request" + "Invalid HTTP request received" and drops the body.
        // Forcing HTTP/1.1 makes the POST land on the FastAPI route.
        HttpClient jdkClient = HttpClient.newBuilder()
                .version(HttpClient.Version.HTTP_1_1)
                .connectTimeout(Duration.ofSeconds(10))
                .build();
        this.webClient = WebClient.builder()
                .clientConnector(new JdkClientHttpConnector(jdkClient))
                .baseUrl(aiServiceBaseUrl.replaceAll("/$", "") + "/ai-service")
                .defaultHeader(HttpHeaders.CONTENT_TYPE, MediaType.APPLICATION_JSON_VALUE)
                .defaultHeader(HttpHeaders.ACCEPT, MediaType.APPLICATION_JSON_VALUE)
                .build();
    }

    /** POST /copy-check/grade — returns the assigned job_id. */
    public String submitGrade(CopyCheckGradeRequestDto body) {
        Map<String, Object> response = webClient.post()
                .uri("/copy-check/grade")
                .header("X-Internal-Service-Token", internalToken)
                .bodyValue(body)
                .retrieve()
                .bodyToMono(Map.class)
                .timeout(Duration.ofSeconds(30))
                .retryWhen(Retry.backoff(2, Duration.ofSeconds(1)))
                .block();
        if (response == null || response.get("job_id") == null) {
            throw new IllegalStateException("ai_service returned no job_id");
        }
        return String.valueOf(response.get("job_id"));
    }

    /** POST /copy-check/{job_id}/cancel — fire-and-forget. */
    public void cancel(String jobId) {
        try {
            webClient.post()
                    .uri("/copy-check/" + jobId + "/cancel")
                    .header("X-Internal-Service-Token", internalToken)
                    .retrieve()
                    .bodyToMono(JsonNode.class)
                    .timeout(Duration.ofSeconds(10))
                    .block();
        } catch (Exception e) {
            log.warn("Failed to forward cancel for job {} to ai_service: {}", jobId, e.getMessage());
        }
    }

    /**
     * Cancel by process_id. Closes the race where the user stops the
     * evaluation before ai_service has finished allocating its job_id and
     * echoed it back — the Python side indexes its in-memory cancellation
     * set by process_id as well as job_id, so this fires regardless of
     * timing.
     */
    public void cancelByProcessId(String processId) {
        try {
            webClient.post()
                    .uri("/copy-check/by-process/" + processId + "/cancel")
                    .header("X-Internal-Service-Token", internalToken)
                    .retrieve()
                    .bodyToMono(JsonNode.class)
                    .timeout(Duration.ofSeconds(10))
                    .block();
        } catch (Exception e) {
            log.warn("Failed to forward cancel for process {} to ai_service: {}",
                    processId, e.getMessage());
        }
    }

    /** GET /copy-check/rubric/{assessment_id} — returns null if 404. */
    public JsonNode getRubric(String assessmentId) {
        try {
            return webClient.get()
                    .uri("/copy-check/rubric/" + assessmentId)
                    .header("X-Internal-Service-Token", internalToken)
                    .retrieve()
                    .bodyToMono(JsonNode.class)
                    .timeout(Duration.ofSeconds(15))
                    .block();
        } catch (Exception e) {
            log.debug("getRubric({}) failed: {}", assessmentId, e.getMessage());
            return null;
        }
    }

    /** POST /copy-check/rubric — upsert. */
    public JsonNode upsertRubric(JsonNode body) {
        return webClient.post()
                .uri("/copy-check/rubric")
                .header("X-Internal-Service-Token", internalToken)
                .bodyValue(body)
                .retrieve()
                .bodyToMono(JsonNode.class)
                .timeout(Duration.ofSeconds(15))
                .block();
    }

    /** DELETE /copy-check/rubric/{assessment_id}. */
    public void deleteRubric(String assessmentId) {
        webClient.delete()
                .uri("/copy-check/rubric/" + assessmentId)
                .header("X-Internal-Service-Token", internalToken)
                .retrieve()
                .bodyToMono(JsonNode.class)
                .timeout(Duration.ofSeconds(15))
                .block();
    }

    /** PUT /copy-check/rubric/{assessment_id}/question/{question_id}. */
    public JsonNode upsertQuestionAnswer(String assessmentId, String questionId, JsonNode body) {
        return webClient.put()
                .uri("/copy-check/rubric/" + assessmentId + "/question/" + questionId)
                .header("X-Internal-Service-Token", internalToken)
                .bodyValue(body)
                .retrieve()
                .bodyToMono(JsonNode.class)
                .timeout(Duration.ofSeconds(15))
                .block();
    }

    /** DELETE /copy-check/rubric/{assessment_id}/question/{question_id}. */
    public void deleteQuestionAnswer(String assessmentId, String questionId) {
        webClient.delete()
                .uri("/copy-check/rubric/" + assessmentId + "/question/" + questionId)
                .header("X-Internal-Service-Token", internalToken)
                .retrieve()
                .bodyToMono(JsonNode.class)
                .timeout(Duration.ofSeconds(15))
                .block();
    }
}
