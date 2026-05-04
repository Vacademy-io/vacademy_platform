package vacademy.io.assessment_service.features.assessment.dto.Questio_type_based_dtos.coding;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import lombok.AllArgsConstructor;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

import java.util.List;

@Getter
@Setter
@AllArgsConstructor
@NoArgsConstructor
@JsonIgnoreProperties(ignoreUnknown = true)
public class CodingResponseDto {
    private String questionId;
    private int questionDurationLeftInSeconds;
    private int timeTakenInSeconds;
    private Boolean isMarkedForReview;
    private Boolean isVisited;
    private ResponseData responseData;

    @Getter
    @Setter
    @AllArgsConstructor
    @NoArgsConstructor
    @JsonIgnoreProperties(ignoreUnknown = true)
    public static class ResponseData {
        private String type;
        private String language;
        private String sourceCode;
        // ACCEPTED | PARTIAL | REJECTED | ERROR | TIMED_OUT
        private String verdict;
        private Integer passedCount;
        private Integer totalCount;
        private Double score;
        private Long totalTimeMs;
        private Long peakMemoryKb;
        private Integer pasteAttemptCount;
        private List<TestCaseResult> testCaseResults;
    }

    @Getter
    @Setter
    @AllArgsConstructor
    @NoArgsConstructor
    @JsonIgnoreProperties(ignoreUnknown = true)
    public static class TestCaseResult {
        private String id;
        private String label;
        private Boolean visible;
        private Boolean passed;
        // for hidden tests, stdout/expected/stderr may be redacted before reaching non-privileged callers
        private String stdout;
        private String expected;
        private String stderr;
        private Long timeMs;
        private Long memoryKb;
        private String error;
    }
}
