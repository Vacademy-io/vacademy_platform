package vacademy.io.admin_core_service.features.coding_submission.dto;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;
import vacademy.io.admin_core_service.features.coding_submission.entity.CodingSubmission;

import java.util.Date;

@Data
@Builder
@AllArgsConstructor
@NoArgsConstructor
public class CodingSubmissionDto {
    private String id;
    private String slideId;
    private String learnerId;
    private String packageSessionId;
    private String language;
    private String sourceCode;
    private String verdict;
    private Integer passedCount;
    private Integer totalCount;
    private Double score;
    private Double maxPoints;
    private String testcaseResultsJson;
    private Integer totalTimeMs;
    private Integer peakMemoryKb;
    private Date submittedAt;
    private Date sessionStartedAt;

    public static CodingSubmissionDto from(CodingSubmission s) {
        return CodingSubmissionDto.builder()
                .id(s.getId())
                .slideId(s.getSlideId())
                .learnerId(s.getLearnerId())
                .packageSessionId(s.getPackageSessionId())
                .language(s.getLanguage())
                .sourceCode(s.getSourceCode())
                .verdict(s.getVerdict())
                .passedCount(s.getPassedCount())
                .totalCount(s.getTotalCount())
                .score(s.getScore())
                .maxPoints(s.getMaxPoints())
                .testcaseResultsJson(s.getTestcaseResultsJson())
                .totalTimeMs(s.getTotalTimeMs())
                .peakMemoryKb(s.getPeakMemoryKb())
                .submittedAt(s.getSubmittedAt())
                .sessionStartedAt(s.getSessionStartedAt())
                .build();
    }
}
