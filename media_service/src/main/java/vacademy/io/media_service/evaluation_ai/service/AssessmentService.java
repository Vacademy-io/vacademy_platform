package vacademy.io.media_service.evaluation_ai.service;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpMethod;
import org.springframework.http.ResponseEntity;
import org.springframework.stereotype.Service;
import vacademy.io.common.ai.dto.AiEvaluationMetadata;
import vacademy.io.common.core.internal_api_wrapper.InternalClientUtils;
import vacademy.io.common.exceptions.VacademyException;
import vacademy.io.media_service.evaluation_ai.constants.AssessmentServiceRoutes;

@Service
public class AssessmentService {

    @Autowired
    private InternalClientUtils internalClientUtils;

    @Value("${spring.application.name}")
    private String clientName;

    @Value("${assessmentServerBaseUrl.server.baseurl}")
    private String assessmentServerBaseUrl;

    public AiEvaluationMetadata getAssessmentMetadata(String assessmentId) {
        ResponseEntity<String> response = internalClientUtils.makeHmacRequest(
                clientName,
                HttpMethod.GET.name(),
                assessmentServerBaseUrl,
                AssessmentServiceRoutes.GET_ASSESSMENT_DETAILS_TO_EVALUATE + "/" + assessmentId,
                String.class
        );

        try {
            ObjectMapper objectMapper = new ObjectMapper();
            return objectMapper.readValue(response.getBody(), AiEvaluationMetadata.class);
        } catch (JsonProcessingException e) {
            throw new VacademyException("Failed to parse assessment metadata: " + e.getMessage());
        }
    }

}
