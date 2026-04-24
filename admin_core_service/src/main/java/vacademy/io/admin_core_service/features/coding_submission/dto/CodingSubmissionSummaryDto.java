package vacademy.io.admin_core_service.features.coding_submission.dto;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;
import vacademy.io.admin_core_service.features.coding_submission.entity.CodingSubmission;

import java.util.Date;

/**
 * Lightweight projection used for the list endpoint — omits source code and
 * the full testcase results JSON so we don't ship hundreds of KB per page.
 */
@Data
@Builder
@AllArgsConstructor
@NoArgsConstructor
public class CodingSubmissionSummaryDto {
    private String id;
    private String slideId;
    private String learnerId;
    private String language;
    private String verdict;
    private Integer passedCount;
    private Integer totalCount;
    private Double score;
    private Double maxPoints;
    private Integer totalTimeMs;
    private Integer peakMemoryKb;
    private Date submittedAt;

    public static CodingSubmissionSummaryDto from(CodingSubmission s) {
        return CodingSubmissionSummaryDto.builder()
                .id(s.getId())
                .slideId(s.getSlideId())
                .learnerId(s.getLearnerId())
                .language(s.getLanguage())
                .verdict(s.getVerdict())
                .passedCount(s.getPassedCount())
                .totalCount(s.getTotalCount())
                .score(s.getScore())
                .maxPoints(s.getMaxPoints())
                .totalTimeMs(s.getTotalTimeMs())
                .peakMemoryKb(s.getPeakMemoryKb())
                .submittedAt(s.getSubmittedAt())
                .build();
    }
}
