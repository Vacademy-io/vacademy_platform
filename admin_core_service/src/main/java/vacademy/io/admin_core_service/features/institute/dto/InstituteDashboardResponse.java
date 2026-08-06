package vacademy.io.admin_core_service.features.institute.dto;


import com.fasterxml.jackson.databind.PropertyNamingStrategies;
import com.fasterxml.jackson.databind.annotation.JsonNaming;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@AllArgsConstructor
@NoArgsConstructor
@Builder
@JsonNaming(PropertyNamingStrategies.SnakeCaseStrategy.class)
public class InstituteDashboardResponse {
    private String id;
    private Integer profileCompletionPercentage;
    private Long batchCount;
    /** Actively-enrolled learners. Mirrors activeStudentCount; kept for existing clients. */
    private Long studentCount;
    // Status breakdown, matching the learner list's header badges. Each is a DISTINCT
    // learner count, so a learner ACTIVE in one batch and TERMINATED in another appears
    // in both — and the buckets need not sum to totalStudentCount.
    private Long totalStudentCount;
    private Long activeStudentCount;
    private Long inactiveStudentCount;
    private Long terminatedStudentCount;
    private Long courseCount;
    private Long levelCount;
    private Long subjectCount;
}
