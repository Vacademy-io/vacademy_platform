package vacademy.io.assessment_service.features.assessment.dto.evaluation_ai;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import com.fasterxml.jackson.annotation.JsonProperty;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class ExtractedAnswerDto {

        @JsonProperty("question_id")
        private String questionId;

        @JsonProperty("question_text")
        private String questionText;

        @JsonProperty("answer_html")
        private String answerHtml;

        @JsonProperty("status")
        private String status; // "ATTEMPTED" or "NOT_ATTEMPTED"

        @JsonProperty("student_question_number")
        private String studentQuestionNumber; // The Q number student wrote in their answer sheet
}
