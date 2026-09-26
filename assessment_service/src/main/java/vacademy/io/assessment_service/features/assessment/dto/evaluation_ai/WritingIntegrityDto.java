package vacademy.io.assessment_service.features.assessment.dto.evaluation_ai;

import com.fasterxml.jackson.annotation.JsonProperty;
import com.fasterxml.jackson.databind.JsonNode;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.util.List;

/**
 * How one typed answer was written, for the teacher's "Writing integrity" panel.
 * Evidence to look at, never a verdict: nothing here changes a mark.
 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class WritingIntegrityDto {

        @JsonProperty("question_id")
        private String questionId;

        @JsonProperty("question_number")
        private Integer questionNumber;

        @JsonProperty("words")
        private int words;

        @JsonProperty("time_taken_seconds")
        private Long timeTakenSeconds;

        /** Words per minute over the time spent on the question; null when unknown. */
        @JsonProperty("words_per_minute")
        private Double wordsPerMinute;

        /** False for attempts from an app version that did not record writing signals. */
        @JsonProperty("signals_available")
        private boolean signalsAvailable;

        /** Raw counts from the learner app (keystrokes, deletions, large_inserts, …). */
        @JsonProperty("signals")
        private JsonNode signals;

        /** The closest other learner's answer to the same question, if any overlaps. */
        @JsonProperty("similar_participant")
        private String similarParticipant;

        @JsonProperty("similarity_percent")
        private Double similarityPercent;

        /** The AI grader's machine-text hint: low | medium | high. */
        @JsonProperty("ai_style_level")
        private String aiStyleLevel;

        @JsonProperty("ai_style_reason")
        private String aiStyleReason;

        /** FAST_WRITING, LARGE_INSERTS, PASTE_ATTEMPTS, LEFT_WINDOW, FEW_CORRECTIONS, HIGH_SIMILARITY, AI_STYLE_HIGH. */
        @JsonProperty("flags")
        private List<String> flags;
}
