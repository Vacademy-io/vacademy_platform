package vacademy.io.admin_core_service.features.faculty.dto;

import com.fasterxml.jackson.databind.PropertyNamingStrategy;
import com.fasterxml.jackson.databind.annotation.JsonNaming;
import lombok.Data;
import vacademy.io.common.auth.dto.UserDTO;

import java.util.List;

@JsonNaming(PropertyNamingStrategy.SnakeCaseStrategy.class)
@Data
public class AddFacultyToSubjectAndBatchDTO {
    private UserDTO user;
    private boolean isNewUser;
    private List<BatchSubjectMapping> batchSubjectMappings;

    @Data
    @JsonNaming(PropertyNamingStrategy.SnakeCaseStrategy.class)
    public static class BatchSubjectMapping {
        private String batchId;
        private List<String> subjectIds;
    }
}
