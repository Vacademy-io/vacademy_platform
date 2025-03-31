package vacademy.io.admin_core_service.features.learner.dto;

import com.fasterxml.jackson.databind.PropertyNamingStrategy;
import com.fasterxml.jackson.databind.annotation.JsonNaming;
import lombok.Data;
import vacademy.io.common.institute.dto.LevelDTO;
import vacademy.io.common.institute.dto.PackageDTO;
import vacademy.io.common.institute.dto.SessionDTO;

import java.util.Date;

@Data
@JsonNaming(PropertyNamingStrategy.SnakeCaseStrategy.class)
public class LearnerBatchDetail {
    private PackageDTO packageDetails;
    private SessionDTO session;
    private LevelDTO level;
    private String getEnrollmentNumber;
    private Date expiryDate;
    private Date enrollMentDate;
}
