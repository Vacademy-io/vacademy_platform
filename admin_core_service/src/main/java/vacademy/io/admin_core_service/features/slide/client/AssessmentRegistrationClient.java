package vacademy.io.admin_core_service.features.slide.client;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.stereotype.Service;
import vacademy.io.common.core.internal_api_wrapper.InternalClientUtils;

import java.util.List;
import java.util.Map;

/**
 * HMAC client that calls assessment_service's internal endpoint to register
 * existing assessments to additional batches.
 *
 * <p>Same {@link InternalClientUtils#makeHmacRequest} pattern as
 * {@code AssessmentServiceClient} (student-analysis). Best-effort: any failure is
 * logged and swallowed so it never breaks the chapter/course copy that triggered
 * it — the worst case is the pre-existing behaviour (assessment not yet visible
 * to the new batch), recoverable by re-running the copy.
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class AssessmentRegistrationClient {

    private static final String ROUTE =
            "/assessment-service/internal/assessment-registration/register-batches";

    private final InternalClientUtils internalClientUtils;

    @Value("${assessment.server.baseurl:http://localhost:8074}")
    private String assessmentServiceBaseUrl;

    @Value("${spring.application.name:admin_core_service}")
    private String clientName;

    /**
     * Register each assessment to the given batches (package_sessions).
     *
     * @param assessmentToBatchIds map of assessmentId -> batch (package_session) ids
     */
    public void registerAssessmentBatches(Map<String, ? extends List<String>> assessmentToBatchIds) {
        if (assessmentToBatchIds == null || assessmentToBatchIds.isEmpty()) {
            return;
        }
        try {
            AssessmentBatchRegistrationRequest body = new AssessmentBatchRegistrationRequest();
            assessmentToBatchIds.forEach((assessmentId, batchIds) -> {
                if (assessmentId != null && !assessmentId.isBlank() && batchIds != null && !batchIds.isEmpty()) {
                    body.getRegistrations().add(
                            new AssessmentBatchRegistrationRequest.AssessmentBatchEntry(assessmentId, batchIds));
                }
            });
            if (body.getRegistrations().isEmpty()) {
                return;
            }

            ResponseEntity<String> response = internalClientUtils.makeHmacRequest(
                    clientName, "POST", assessmentServiceBaseUrl, ROUTE, body);

            if (response.getStatusCode() != HttpStatus.OK) {
                log.warn("[AssessmentRegistrationClient] Non-200 registering assessment batches: {}",
                        response.getStatusCode());
            }
        } catch (Exception e) {
            log.warn("[AssessmentRegistrationClient] Failed to register assessment batches: {}", e.getMessage());
        }
    }
}
