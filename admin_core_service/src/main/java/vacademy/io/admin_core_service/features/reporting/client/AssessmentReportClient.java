package vacademy.io.admin_core_service.features.reporting.client;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.stereotype.Component;
import vacademy.io.common.core.internal_api_wrapper.InternalClientUtils;

import java.time.LocalDate;

/**
 * Reads the institute-level assessment aggregate from assessment_service.
 *
 * Assessment data lives in another service's database, so it cannot be reached by
 * SQL from a report section. It is fetched in ONE call per report document, against
 * an endpoint built for exactly that — the pre-existing alternative was a
 * per-learner history call, which at 7,000 learners is 7,000 requests inside a
 * scheduled job.
 *
 * The query string is assembled raw and deliberately NOT pre-encoded:
 * {@link InternalClientUtils} runs the route through
 * {@code UriComponentsBuilder.toUriString()}, which encodes it, so encoding here
 * would double-encode and the parameters would arrive mangled.
 */
@Component
@Slf4j
public class AssessmentReportClient {

    private final InternalClientUtils internalClientUtils;
    private final ObjectMapper objectMapper;
    private final String assessmentServiceBaseUrl;
    private final String clientName;

    public AssessmentReportClient(
            InternalClientUtils internalClientUtils,
            ObjectMapper objectMapper,
            @Value("${assessment.server.baseurl:http://localhost:8074}") String assessmentServiceBaseUrl,
            @Value("${spring.application.name:admin_core_service}") String clientName) {
        this.internalClientUtils = internalClientUtils;
        this.objectMapper = objectMapper;
        this.assessmentServiceBaseUrl = assessmentServiceBaseUrl;
        this.clientName = clientName;
    }

    /**
     * @return the aggregate, or null when it could not be fetched. The caller
     *         decides what to do with null; this class never fabricates an empty
     *         result, because "no assessments happened" and "we could not ask" must
     *         not look identical in a report.
     */
    public JsonNode fetchSummary(String instituteId, LocalDate from, LocalDate to) {
        try {
            String route = "/assessment-service/internal/reporting/v1/assessment-summary"
                    + "?instituteId=" + instituteId
                    + "&from=" + from
                    + "&to=" + to;

            ResponseEntity<String> response = internalClientUtils.makeHmacRequest(
                    clientName, "GET", assessmentServiceBaseUrl, route, null);

            if (response.getStatusCode() == HttpStatus.OK && response.getBody() != null) {
                return objectMapper.readTree(response.getBody());
            }
            log.warn("[reporting] assessment summary returned {} for institute {}",
                    response.getStatusCode(), instituteId);
            return null;
        } catch (Exception e) {
            log.warn("[reporting] assessment summary failed for institute {}: {}",
                    instituteId, e.getMessage());
            return null;
        }
    }
}
