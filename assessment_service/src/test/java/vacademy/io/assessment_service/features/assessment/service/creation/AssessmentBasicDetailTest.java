package vacademy.io.assessment_service.features.assessment.service.creation;

import org.junit.jupiter.api.Test;

import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.stream.Collectors;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * Step-1 field rules per assessment type. Each type's list decides which
 * fields the dashboard shows and which the step needs before it counts as
 * complete, so a type quietly inheriting another's list is a product bug -
 * a Survey demanded a live window like a manual-upload exam for months.
 */
class AssessmentBasicDetailTest {

    private static Set<String> keysFor(String type) {
        AssessmentBasicDetail step = new AssessmentBasicDetail();
        step.fillStepKeysBasedOnAssessmentType(type, "inst-1");
        List<Map<String, String>> keys = step.getStepKeys();
        return keys.stream().flatMap(m -> m.keySet().stream()).collect(Collectors.toSet());
    }

    @Test
    void aSurveyKeepsItsOwnFieldsAndNeedsNoLiveWindow() {
        Set<String> survey = keysFor("SURVEY");
        assertThat(survey).contains("assessment_visibility", "expected_participants", "reattempt_count");
        assertThat(survey).doesNotContain("boundation_start_date", "boundation_end_date", "result_type",
                "reattempt_consent");
    }

    @Test
    void aManualUploadExamStillNeedsItsLiveWindowAndResultType() {
        Set<String> manual = keysFor("MANUAL_UPLOAD_EXAM");
        assertThat(manual).contains("boundation_start_date", "boundation_end_date", "result_type");
    }

    @Test
    void mockAndPracticeNeverAskForALiveWindow() {
        assertThat(keysFor("MOCK")).doesNotContain("boundation_start_date", "boundation_end_date");
        assertThat(keysFor("PRACTICE")).doesNotContain("boundation_start_date", "boundation_end_date");
        assertThat(keysFor("EXAM")).contains("boundation_start_date", "boundation_end_date");
    }
}
