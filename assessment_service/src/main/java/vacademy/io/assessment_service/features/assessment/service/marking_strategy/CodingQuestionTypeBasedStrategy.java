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

import java.util.HashSet;
import java.util.List;
import java.util.Set;

/**
 * Coding questions are always graded partially, on the set of HIDDEN test cases:
 *   score = totalMark * (hiddenPassed / hiddenCount)
 *
 * If the question has no hidden test cases, we fall back to the SAMPLE (visible)
 * test cases so a question authored without hidden tests still yields a score.
 * (Admins are warned at authoring time that sample-only grading is gameable
 * because learners can see sample expected outputs.)
 *
 * The authored test cases in {@code correctAnswerJson} are the source of truth for
 * the denominator. Client-reported per-test results are matched to authored tests
 * by id; any authored test in the scoring set with no matching passed result counts
 * as failed. This prevents a crafted client from shrinking the denominator by
 * omitting hidden-test results.
 *
 * Legacy safety net: if the authored config is unreadable or carries no test cases
 * (older data), we fall back to the pre-existing client-count behaviour so
 * revaluation of historical attempts stays byte-identical.
 */
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

            String verdict = response.getVerdict();
            String verdictNormalized = verdict == null ? "" : verdict.toUpperCase();

            // Resolve the scoring set from the authored test cases (source of truth).
            Set<String> scoringIds = resolveScoringSet(correctAnswerJsonStr);

            if (scoringIds == null) {
                // Legacy path: authored config is unreadable or has no test cases
                // (older data). Preserve the pre-existing behaviour byte-for-byte so
                // revaluation of historical attempts is unaffected.
                return scoreLegacy(markingData, response, verdictNormalized, totalMarks, negativeMarks);
            }

            // Authored path: always partial, on the resolved scoring set (hidden, or
            // samples when no hidden exists). Denominator is the authored count; a
            // client result counts only when its id is in the set and it passed, so
            // omitting hidden-test results cannot shrink the denominator.
            int total = scoringIds.size();
            int passed = countPassedInScoringSet(response.getTestCaseResults(), scoringIds);

            // Status is derived from the scoring set, not the client verdict (the
            // client verdict is computed over ALL tests, so "all hidden pass, one
            // sample fails" would otherwise be mislabelled PARTIAL).
            setAnswerStatus(mapScoreToStatus(passed, total, verdictNormalized));

            if (total <= 0) {
                return 0.0;
            }
            if (passed >= total) {
                return totalMarks;
            }
            if (passed > 0) {
                return (totalMarks * passed) / total;
            }
            // No tests passed: apply negative marking only on hard-failure verdicts
            // (not on an in-progress / non-run submission).
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

    /**
     * The set of authored test-case ids that determine the score: hidden tests if
     * any exist, otherwise sample (visible) tests. Returns {@code null} when the
     * authored config is unreadable or carries no usable test cases, signalling the
     * caller to use the legacy client-count path.
     */
    private Set<String> resolveScoringSet(String correctAnswerJsonStr) {
        try {
            CodingCorrectAnswerDto correctAnswer = (CodingCorrectAnswerDto) validateAndGetCorrectAnswerData(correctAnswerJsonStr);
            if (correctAnswer == null || correctAnswer.getData() == null) return null;
            List<CodingCorrectAnswerDto.TestCase> testCases = correctAnswer.getData().getTestCases();
            if (testCases == null || testCases.isEmpty()) return null;

            Set<String> hidden = new HashSet<>();
            Set<String> sample = new HashSet<>();
            for (CodingCorrectAnswerDto.TestCase tc : testCases) {
                if (tc == null || tc.getId() == null) continue;
                if (Boolean.TRUE.equals(tc.getVisible())) {
                    sample.add(tc.getId());
                } else {
                    hidden.add(tc.getId());
                }
            }
            if (!hidden.isEmpty()) return hidden;
            if (!sample.isEmpty()) return sample;
            return null;
        } catch (Exception e) {
            log.warn("Could not parse coding correct-answer config, falling back to client counts: {}", e.getMessage());
            return null;
        }
    }

    private int countPassedInScoringSet(List<CodingResponseDto.TestCaseResult> results, Set<String> scoringIds) {
        if (results == null) return 0;
        Set<String> passedIds = new HashSet<>();
        for (CodingResponseDto.TestCaseResult r : results) {
            if (r == null || r.getId() == null) continue;
            if (Boolean.TRUE.equals(r.getPassed()) && scoringIds.contains(r.getId())) {
                passedIds.add(r.getId());
            }
        }
        return passedIds.size();
    }

    private int countPassedFromResults(List<CodingResponseDto.TestCaseResult> results) {
        if (results == null) return 0;
        int n = 0;
        for (CodingResponseDto.TestCaseResult r : results) {
            if (Boolean.TRUE.equals(r.getPassed())) n++;
        }
        return n;
    }

    /**
     * Original (pre hidden-based partial marking) scoring, retained verbatim for
     * attempts whose authored config can no longer be parsed. Behaviour here must
     * stay byte-identical to protect revaluation of historical data.
     */
    private double scoreLegacy(CodingMarkingDto.DataFields markingData,
                               CodingResponseDto.ResponseData response,
                               String verdictNormalized,
                               double totalMarks,
                               double negativeMarks) {
        int clientPassedCount = response.getPassedCount() == null ? 0 : response.getPassedCount();
        int clientTotalCount = response.getTotalCount() == null ? 0 : response.getTotalCount();
        int verifiedPassedCount = countPassedFromResults(response.getTestCaseResults());
        int verifiedTotalCount = response.getTestCaseResults() == null ? 0 : response.getTestCaseResults().size();

        // Defense in depth: trust the lower count between what the client declared and what we can verify
        int passed = Math.min(clientPassedCount, verifiedPassedCount);
        int total = clientTotalCount > 0 ? clientTotalCount : verifiedTotalCount;

        setAnswerStatus(mapVerdictToStatus(verdictNormalized, passed, total));

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
            if (VERDICT_REJECTED.equals(verdictNormalized) || VERDICT_ERROR.equals(verdictNormalized) || VERDICT_TIMED_OUT.equals(verdictNormalized)) {
                return -negativeMarks;
            }
            return 0.0;
        }

        if (VERDICT_ACCEPTED.equals(verdictNormalized) && total > 0 && passed == total) {
            return totalMarks;
        }
        if (VERDICT_REJECTED.equals(verdictNormalized) || VERDICT_ERROR.equals(verdictNormalized) || VERDICT_TIMED_OUT.equals(verdictNormalized)) {
            return -negativeMarks;
        }
        return 0.0;
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

    private String mapScoreToStatus(int passed, int total, String verdict) {
        if (total > 0 && passed >= total) {
            return QuestionResponseEnum.CORRECT.name();
        }
        if (passed > 0) {
            return QuestionResponseEnum.PARTIAL_CORRECT.name();
        }
        // Zero passed but the code was actually run (any terminal verdict) is an
        // attempt, not a skip -> INCORRECT. Only a submission with no run stays PENDING.
        if (isTerminalVerdict(verdict)) {
            return QuestionResponseEnum.INCORRECT.name();
        }
        return QuestionResponseEnum.PENDING.name();
    }

    private boolean isTerminalVerdict(String verdict) {
        return VERDICT_ACCEPTED.equals(verdict) || VERDICT_PARTIAL.equals(verdict)
                || VERDICT_REJECTED.equals(verdict) || VERDICT_ERROR.equals(verdict)
                || VERDICT_TIMED_OUT.equals(verdict);
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
