package vacademy.io.assessment_service.features.assessment.service.marking_strategy;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.ObjectMapper;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Component;
import vacademy.io.assessment_service.features.assessment.dto.AssessmentQuestionPreviewDto;
import vacademy.io.assessment_service.features.assessment.dto.Questio_type_based_dtos.coding.CodingCorrectAnswerDto;
import vacademy.io.assessment_service.features.assessment.dto.Questio_type_based_dtos.coding.CodingMarkingDto;
import vacademy.io.assessment_service.features.assessment.dto.Questio_type_based_dtos.coding.CodingResponseDto;
import vacademy.io.assessment_service.features.assessment.entity.Assessment;
import vacademy.io.assessment_service.features.assessment.enums.QuestionResponseEnum;
import vacademy.io.assessment_service.features.assessment.service.IQuestionTypeBasedStrategy;
import vacademy.io.assessment_service.features.learner_assessment.entity.QuestionWiseMarks;

import java.util.List;

@Slf4j
@Component
public class CodingQuestionTypeBasedStrategy extends IQuestionTypeBasedStrategy {

    private static final String VERDICT_ACCEPTED = "ACCEPTED";
    private static final String VERDICT_PARTIAL = "PARTIAL";
    private static final String VERDICT_REJECTED = "REJECTED";
    private static final String VERDICT_ERROR = "ERROR";
    private static final String VERDICT_TIMED_OUT = "TIMED_OUT";

    @Override
    public double calculateMarks(String markingJsonStr, String correctAnswerJsonStr, String responseJson) {
        try {
            CodingMarkingDto markingDto = (CodingMarkingDto) validateAndGetMarkingData(markingJsonStr);
            CodingResponseDto responseDto = (CodingResponseDto) validateAndGetResponseData(responseJson);

            if (markingDto == null || responseDto == null || responseDto.getResponseData() == null) {
                setAnswerStatus(QuestionResponseEnum.PENDING.name());
                return 0.0;
            }

            CodingResponseDto.ResponseData response = responseDto.getResponseData();
            CodingMarkingDto.DataFields markingData = markingDto.getData();
            if (markingData == null) {
                setAnswerStatus(QuestionResponseEnum.PENDING.name());
                return 0.0;
            }

            // No submission: pending (skipped)
            if (response.getSourceCode() == null || response.getSourceCode().isEmpty()) {
                setAnswerStatus(QuestionResponseEnum.PENDING.name());
                return 0.0;
            }

            double totalMarks = markingData.getTotalMark();
            double negativeMarks = markingData.getNegativeMark();

            int clientPassedCount = response.getPassedCount() == null ? 0 : response.getPassedCount();
            int clientTotalCount = response.getTotalCount() == null ? 0 : response.getTotalCount();
            int verifiedPassedCount = countPassedFromResults(response.getTestCaseResults());
            int verifiedTotalCount = response.getTestCaseResults() == null ? 0 : response.getTestCaseResults().size();

            // Defense in depth: trust the lower count between what the client declared and what we can verify
            int passed = Math.min(clientPassedCount, verifiedPassedCount);
            int total = clientTotalCount > 0 ? clientTotalCount : verifiedTotalCount;

            String verdict = response.getVerdict();
            String verdictNormalized = verdict == null ? "" : verdict.toUpperCase();

            // Map verdict -> answerStatus (drives downstream chart buckets)
            String answerStatus = mapVerdictToStatus(verdictNormalized, passed, total);
            setAnswerStatus(answerStatus);

            // Score
            if (markingData.isPartialMarking()) {
                if (total <= 0) {
                    return 0.0;
                }
                if (VERDICT_ACCEPTED.equals(verdictNormalized) && passed == total) {
                    return totalMarks;
                }
                if (passed > 0) {
                    return (totalMarks * passed) / total;
                }
                // No tests passed: apply negative marking only on hard-failure verdicts (not on submissions in progress)
                if (VERDICT_REJECTED.equals(verdictNormalized) || VERDICT_ERROR.equals(verdictNormalized) || VERDICT_TIMED_OUT.equals(verdictNormalized)) {
                    return -negativeMarks;
                }
                return 0.0;
            }

            // No partial credit: full marks only on a clean ACCEPTED with all tests passing
            if (VERDICT_ACCEPTED.equals(verdictNormalized) && total > 0 && passed == total) {
                return totalMarks;
            }
            if (VERDICT_REJECTED.equals(verdictNormalized) || VERDICT_ERROR.equals(verdictNormalized) || VERDICT_TIMED_OUT.equals(verdictNormalized)) {
                return -negativeMarks;
            }
            return 0.0;
        } catch (Exception e) {
            log.error("Error scoring coding answer: {}", e.getMessage(), e);
            setAnswerStatus(QuestionResponseEnum.PENDING.name());
            return 0.0;
        }
    }

    private int countPassedFromResults(List<CodingResponseDto.TestCaseResult> results) {
        if (results == null) return 0;
        int n = 0;
        for (CodingResponseDto.TestCaseResult r : results) {
            if (Boolean.TRUE.equals(r.getPassed())) n++;
        }
        return n;
    }

    private String mapVerdictToStatus(String verdict, int passed, int total) {
        if (VERDICT_ACCEPTED.equals(verdict) && total > 0 && passed == total) {
            return QuestionResponseEnum.CORRECT.name();
        }
        if (VERDICT_PARTIAL.equals(verdict) || (passed > 0 && passed < total)) {
            return QuestionResponseEnum.PARTIAL_CORRECT.name();
        }
        if (VERDICT_REJECTED.equals(verdict) || VERDICT_ERROR.equals(verdict) || VERDICT_TIMED_OUT.equals(verdict)) {
            return QuestionResponseEnum.INCORRECT.name();
        }
        return QuestionResponseEnum.PENDING.name();
    }

    @Override
    public Object validateAndGetMarkingData(String markingJson) throws JsonProcessingException {
        ObjectMapper objectMapper = new ObjectMapper();
        return objectMapper.readValue(markingJson, CodingMarkingDto.class);
    }

    @Override
    public Object validateAndGetCorrectAnswerData(String correctAnswerJson) throws JsonProcessingException {
        ObjectMapper objectMapper = new ObjectMapper();
        return objectMapper.readValue(correctAnswerJson, CodingCorrectAnswerDto.class);
    }

    @Override
    public Object validateAndGetResponseData(String responseJson) throws JsonProcessingException {
        ObjectMapper objectMapper = new ObjectMapper();
        return objectMapper.readValue(responseJson, CodingResponseDto.class);
    }

    @Override
    public Object validateAndGetSurveyData(Assessment assessment, AssessmentQuestionPreviewDto assessmentQuestionPreviewDto, List<QuestionWiseMarks> allRespondentData) {
        // Coding questions are not supported in surveys.
        return null;
    }
}
