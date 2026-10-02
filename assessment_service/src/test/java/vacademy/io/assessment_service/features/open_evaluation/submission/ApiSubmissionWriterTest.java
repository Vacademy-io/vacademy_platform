package vacademy.io.assessment_service.features.open_evaluation.submission;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.JsonNodeFactory;
import org.junit.jupiter.api.Test;
import vacademy.io.assessment_service.features.assessment.dto.offline_entry.OfflineResponseSubmitRequest;
import vacademy.io.assessment_service.features.assessment.entity.Assessment;
import vacademy.io.assessment_service.features.assessment.entity.StudentAttempt;
import vacademy.io.assessment_service.features.assessment.manager.AdminOfflineDataEntryManager;
import vacademy.io.assessment_service.features.learner_assessment.dto.status_json.QuestionAttemptData;
import vacademy.io.assessment_service.features.open_evaluation.submission.dto.SubmissionInputs;

import java.util.ArrayList;
import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verify;

class ApiSubmissionWriterTest {

    @Test
    void groups_answers_by_section_in_paper_order_with_the_database_type() {
        List<TypedAnswers.Resolved> resolved = TypedAnswers.resolve(TypedAnswersTest.paper(), List.of(
                new SubmissionInputs.AnswerInput("q5", null, "Energy is released.", null, null),
                new SubmissionInputs.AnswerInput("q1", null, null, List.of("C"), null),
                new SubmissionInputs.AnswerInput("q3", null, null, null, JsonNodeFactory.instance.numberNode(7))));

        OfflineResponseSubmitRequest request = ApiSubmissionWriter.request(resolved);

        assertThat(request.getSections()).hasSize(2);
        assertThat(request.getSections().get(0).getSectionId()).isEqualTo("sec-A");
        assertThat(request.getSections().get(0).getQuestions()).extracting("questionId").containsExactly("q1", "q3");
        assertThat(request.getSections().get(0).getQuestions().get(0).getType()).isEqualTo("MCQS");
        assertThat(request.getSections().get(0).getQuestions().get(0).getOptionIds()).containsExactly("o3");
        assertThat(request.getSections().get(0).getQuestions().get(1).getValidAnswer()).isEqualTo(7.0);
        assertThat(request.getSections().get(1).getQuestions().get(0).getAnswer()).isEqualTo("Energy is released.");
        assertThat(request.getSections().get(1).getQuestions().get(0).getType()).isEqualTo("LONG_ANSWER");
    }

    @Test
    void writes_through_the_offline_entry_path() {
        AdminOfflineDataEntryManager manager = mock(AdminOfflineDataEntryManager.class);
        StudentAttempt attempt = new StudentAttempt();
        Assessment assessment = new Assessment();

        new ApiSubmissionWriter(manager).writeTyped(attempt, assessment, new ArrayList<>());

        verify(manager).applyResponses(eq(attempt), eq(assessment), any(OfflineResponseSubmitRequest.class));
    }

    @Test
    void option_only_responses_serialize_exactly_as_before() throws Exception {
        ObjectMapper mapper = new ObjectMapper();
        QuestionAttemptData.OptionsJson options = QuestionAttemptData.OptionsJson.builder()
                .type("MCQS").optionIds(List.of("o1")).build();
        assertThat(mapper.writeValueAsString(options)).isEqualTo("{\"type\":\"MCQS\",\"optionIds\":[\"o1\"]}");

        QuestionAttemptData.OptionsJson typed = QuestionAttemptData.OptionsJson.builder()
                .type("LONG_ANSWER").optionIds(List.of()).answer("text").build();
        assertThat(mapper.readTree(mapper.writeValueAsString(typed)).path("answer").asText()).isEqualTo("text");
        assertThat(mapper.readTree(mapper.writeValueAsString(typed)).has("validAnswer")).isFalse();
    }
}
