package vacademy.io.admin_core_service.features.admission.dto;

import com.fasterxml.jackson.databind.PropertyNamingStrategies;
import com.fasterxml.jackson.databind.annotation.JsonNaming;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;
import vacademy.io.common.auth.dto.UserDTO;

import java.util.Date;

@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
@JsonNaming(PropertyNamingStrategies.SnakeCaseStrategy.class)
public class PipelineUserListResponseDTO {
    private String pipelineId;
    
    // Parent Details
    private String parentUserId;
    private String parentName;
    private String parentEmail;
    private String parentPhone;
    
    // Child/Student Details
    private String childUserId;
    private String studentName;
    
    // Pipeline specifics
    private String currentStage;
    private String sourceType;
    private Date enquiryDate;
    private Date applicationDate;
    private Date admissionDate;
    
    // Original IDs for tracking backward
    private String enquiryId;
    private String applicantId;
}
