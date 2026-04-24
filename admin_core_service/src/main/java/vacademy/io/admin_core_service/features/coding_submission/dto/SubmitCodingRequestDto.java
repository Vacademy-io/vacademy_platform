package vacademy.io.admin_core_service.features.coding_submission.dto;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.util.Date;

/**
 * Payload from the learner client when a coding-question is submitted.
 * In v1 the verdict / per-test results are computed in the browser (Judge0
 * runs there) and posted here. Server-side re-judging is future work.
 */
@Data
@Builder
@AllArgsConstructor
@NoArgsConstructor
public class SubmitCodingRequestDto {
    private String slideId;
    private String packageSessionId;
    private String language;
    private String sourceCode;
    private String verdict;
    private Integer passedCount;
    private Integer totalCount;
    private Double score;
    private Double maxPoints;
    /** Pre-stringified JSON of per-testcase results. */
    private String testcaseResultsJson;
    private Integer totalTimeMs;
    private Integer peakMemoryKb;
    private Date sessionStartedAt;
}
