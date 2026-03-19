package vacademy.io.assessment_service.features.assessment.dto.evaluation_ai;

import com.fasterxml.jackson.annotation.JsonProperty;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.util.List;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class EvaluationProgressDto {

        @JsonProperty("attempt_id")
        private String attemptId;

        @JsonProperty("evaluation_process_id")
        private String evaluationProcessId;

        // Overall status
        @JsonProperty("overall_status")
        private String overallStatus;

        @JsonProperty("current_step")
        private String currentStep;

        // Progress tracking
        @JsonProperty("progress")
        private ProgressInfo progress;

        // Question results
        @JsonProperty("completed_questions")
        private List<QuestionEvaluationResultDto> completedQuestions;

        @JsonProperty("pending_questions")
        private List<PendingQuestionDto> pendingQuestions;

        // New fields for participant and assessment context
        @JsonProperty("participant_details")
        private ParticipantDetailsDto participantDetails;

        @JsonProperty("assessment_id")
        private String assessmentId;

        @JsonProperty("file_id")
        private String fileId;

        @Data
        @Builder
        @NoArgsConstructor
        @AllArgsConstructor
        public static class ProgressInfo {
                @JsonProperty("completed")
                private Integer completed;

                @JsonProperty("total")
                private Integer total;

                @JsonProperty("percentage")
                private Double percentage;
        }

        @Data
        @Builder
        @NoArgsConstructor
        @AllArgsConstructor
        public static class PendingQuestionDto {
                @JsonProperty("question_id")
                private String questionId;

                @JsonProperty("question_number")
                private Integer questionNumber;

                @JsonProperty("status")
                private String status;
        }
}
