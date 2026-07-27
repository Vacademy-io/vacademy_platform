package vacademy.io.assessment_service.features.assessment.service.marking_strategy;

import org.junit.jupiter.api.Test;
import vacademy.io.assessment_service.features.assessment.enums.QuestionResponseEnum;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.within;

/**
 * Unit tests for hidden-test-case based partial marking of coding questions.
 *
 * Marking rule under test:
 *   score = totalMark * (hiddenPassed / hiddenCount)
 *   no hidden tests -> fall back to samples
 *   authored test cases (in the correct-answer json) are the source of truth for
 *   the denominator; client results are matched by id, missing = failed.
 */
class CodingQuestionTypeBasedStrategyTest {

    private final CodingQuestionTypeBasedStrategy strategy = new CodingQuestionTypeBasedStrategy();

    private static final String MARKING_100_NEG10 =
            "{\"type\":\"CODING\",\"data\":{\"totalMark\":100,\"negativeMark\":10,\"partialMarking\":false}}";

    // 3 hidden (h1,h2,h3) + 2 samples (s1,s2)
    private static final String AUTHORED_3H_2S =
            "{\"type\":\"CODING\",\"data\":{\"testCases\":["
                    + "{\"id\":\"h1\",\"visible\":false},{\"id\":\"h2\",\"visible\":false},{\"id\":\"h3\",\"visible\":false},"
                    + "{\"id\":\"s1\",\"visible\":true},{\"id\":\"s2\",\"visible\":true}]}}";

    // only samples, no hidden
    private static final String AUTHORED_0H_2S =
            "{\"type\":\"CODING\",\"data\":{\"testCases\":["
                    + "{\"id\":\"s1\",\"visible\":true},{\"id\":\"s2\",\"visible\":true}]}}";

    private String response(String verdict, String testCaseResultsJson) {
        return "{\"responseData\":{\"type\":\"CODING\",\"language\":\"python\",\"sourceCode\":\"print(1)\","
                + "\"verdict\":\"" + verdict + "\","
                + "\"testCaseResults\":[" + testCaseResultsJson + "]}}";
    }

    private String tc(String id, boolean passed) {
        return "{\"id\":\"" + id + "\",\"passed\":" + passed + "}";
    }

    @Test
    void allHiddenPass_evenIfSamplesFail_awardsFullMarks() {
        String resp = response("PARTIAL",
                tc("h1", true) + "," + tc("h2", true) + "," + tc("h3", true) + ","
                        + tc("s1", false) + "," + tc("s2", false));
        double marks = strategy.calculateMarks(MARKING_100_NEG10, AUTHORED_3H_2S, resp);
        assertThat(marks).isEqualTo(100.0);
        assertThat(strategy.getAnswerStatus()).isEqualTo(QuestionResponseEnum.CORRECT.name());
    }

    @Test
    void twoOfThreeHiddenPass_awardsProportionalMarks() {
        String resp = response("PARTIAL",
                tc("h1", true) + "," + tc("h2", true) + "," + tc("h3", false) + ","
                        + tc("s1", true) + "," + tc("s2", true));
        double marks = strategy.calculateMarks(MARKING_100_NEG10, AUTHORED_3H_2S, resp);
        assertThat(marks).isCloseTo(66.666, within(0.01));
        assertThat(strategy.getAnswerStatus()).isEqualTo(QuestionResponseEnum.PARTIAL_CORRECT.name());
    }

    @Test
    void zeroHiddenPass_hardFailVerdict_appliesNegativeMark() {
        String resp = response("REJECTED",
                tc("h1", false) + "," + tc("h2", false) + "," + tc("h3", false));
        double marks = strategy.calculateMarks(MARKING_100_NEG10, AUTHORED_3H_2S, resp);
        assertThat(marks).isEqualTo(-10.0);
        assertThat(strategy.getAnswerStatus()).isEqualTo(QuestionResponseEnum.INCORRECT.name());
    }

    @Test
    void samplesPassButZeroHidden_scoresZeroAndIncorrect() {
        // Student passed both visible samples but no hidden tests -> 0 marks, no negative.
        String resp = response("PARTIAL",
                tc("h1", false) + "," + tc("h2", false) + "," + tc("h3", false) + ","
                        + tc("s1", true) + "," + tc("s2", true));
        double marks = strategy.calculateMarks(MARKING_100_NEG10, AUTHORED_3H_2S, resp);
        assertThat(marks).isEqualTo(0.0);
        assertThat(strategy.getAnswerStatus()).isEqualTo(QuestionResponseEnum.INCORRECT.name());
    }

    @Test
    void omittingHiddenResults_countsThemAsFailed() {
        // Client only reports the sample results (omits hidden) trying to shrink the
        // denominator. Denominator stays 3 (authored hidden), passed = 0.
        String resp = response("ACCEPTED", tc("s1", true) + "," + tc("s2", true));
        double marks = strategy.calculateMarks(MARKING_100_NEG10, AUTHORED_3H_2S, resp);
        assertThat(marks).isEqualTo(0.0);
    }

    @Test
    void noHiddenTests_fallsBackToSamples_allSamplesPass_full() {
        String resp = response("ACCEPTED", tc("s1", true) + "," + tc("s2", true));
        double marks = strategy.calculateMarks(MARKING_100_NEG10, AUTHORED_0H_2S, resp);
        assertThat(marks).isEqualTo(100.0);
        assertThat(strategy.getAnswerStatus()).isEqualTo(QuestionResponseEnum.CORRECT.name());
    }

    @Test
    void noHiddenTests_fallsBackToSamples_halfPass_half() {
        String resp = response("PARTIAL", tc("s1", true) + "," + tc("s2", false));
        double marks = strategy.calculateMarks(MARKING_100_NEG10, AUTHORED_0H_2S, resp);
        assertThat(marks).isEqualTo(50.0);
        assertThat(strategy.getAnswerStatus()).isEqualTo(QuestionResponseEnum.PARTIAL_CORRECT.name());
    }

    @Test
    void noSubmission_isPendingWithZero() {
        String resp = "{\"responseData\":{\"type\":\"CODING\",\"language\":\"python\",\"sourceCode\":\"\",\"verdict\":\"\",\"testCaseResults\":[]}}";
        double marks = strategy.calculateMarks(MARKING_100_NEG10, AUTHORED_3H_2S, resp);
        assertThat(marks).isEqualTo(0.0);
        assertThat(strategy.getAnswerStatus()).isEqualTo(QuestionResponseEnum.PENDING.name());
    }

    private String responseWithCounts(String verdict, int passedCount, int totalCount, String testCaseResultsJson) {
        return "{\"responseData\":{\"type\":\"CODING\",\"language\":\"python\",\"sourceCode\":\"print(1)\","
                + "\"verdict\":\"" + verdict + "\",\"passedCount\":" + passedCount + ",\"totalCount\":" + totalCount + ","
                + "\"testCaseResults\":[" + testCaseResultsJson + "]}}";
    }

    @Test
    void legacyUnparseableAuthoredConfig_usesClientCounts_allOrNothing() {
        // No authored testCases -> legacy path. Marking has partialMarking=false, so
        // only a clean ACCEPTED with all client tests passing yields full marks.
        String legacyAuthored = "{\"type\":\"CODING\",\"data\":{}}";
        String resp = responseWithCounts("ACCEPTED", 2, 2, tc("a", true) + "," + tc("b", true));
        double marks = strategy.calculateMarks(MARKING_100_NEG10, legacyAuthored, resp);
        assertThat(marks).isEqualTo(100.0);
    }

    @Test
    void legacyPath_partialVerdict_allOrNothing_scoresZero() {
        String legacyAuthored = "{\"type\":\"CODING\",\"data\":{}}";
        String resp = response("PARTIAL", tc("a", true) + "," + tc("b", false));
        double marks = strategy.calculateMarks(MARKING_100_NEG10, legacyAuthored, resp);
        assertThat(marks).isEqualTo(0.0);
    }
}
