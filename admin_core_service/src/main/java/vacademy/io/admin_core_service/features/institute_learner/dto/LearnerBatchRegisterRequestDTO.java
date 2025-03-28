package vacademy.io.admin_core_service.features.institute_learner.dto;

import com.fasterxml.jackson.databind.PropertyNamingStrategy;
import com.fasterxml.jackson.databind.annotation.JsonNaming;
import lombok.Data;

import java.util.List;

@Data
@JsonNaming(PropertyNamingStrategy.SnakeCaseStrategy.class)
public class LearnerBatchRegisterRequestDTO {
    private List<String> userIds;
    private String instituteId;
    private List<LearnerBatchRegisterInfo>learnerBatchRegisterInfos;
    private Integer accessDays;

    @Data
    @JsonNaming(PropertyNamingStrategy.SnakeCaseStrategy.class)
    public static class LearnerBatchRegisterInfo{
        private String packageSessionId;
        private Integer accessDays;
    }
}
