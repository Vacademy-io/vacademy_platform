package vacademy.io.admin_core_service.features.faculty.dto;


import com.fasterxml.jackson.databind.PropertyNamingStrategy;
import com.fasterxml.jackson.databind.annotation.JsonNaming;
import lombok.Data;
import java.util.List;

@Data
@JsonNaming(PropertyNamingStrategy.SnakeCaseStrategy.class)
public class FacultyBatchSubjectUpdateRequest {
    private String facultyId;
    private List<BatchSubjectAssignment> batchSubjectAssignments;

    @Data
    @JsonNaming(PropertyNamingStrategy.SnakeCaseStrategy.class)
    public static class BatchSubjectAssignment {
        private String batchId;
        private List<SubjectAssignment> subjectAssignments;
    }

    @Data
    public static class SubjectAssignment {
        private String subjectId;
        private boolean isNewAssignment;
    }
}
