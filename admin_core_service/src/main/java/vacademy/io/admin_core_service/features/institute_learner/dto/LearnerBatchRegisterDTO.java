package vacademy.io.admin_core_service.features.institute_learner.dto;

import com.fasterxml.jackson.databind.PropertyNamingStrategy;
import com.fasterxml.jackson.databind.annotation.JsonNaming;
import lombok.Data;

@Data
@JsonNaming(PropertyNamingStrategy.SnakeCaseStrategy.class)
public class LearnerBatchRegisterDTO {
    private String userId;
    private Integer expiryDays;
    private String instituteId;
    private String commaSeparatedPackageSessionIds;
}
