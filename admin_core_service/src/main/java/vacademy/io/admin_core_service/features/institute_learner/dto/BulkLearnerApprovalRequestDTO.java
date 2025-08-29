package vacademy.io.admin_core_service.features.institute_learner.dto;

import com.fasterxml.jackson.databind.PropertyNamingStrategies;
import com.fasterxml.jackson.databind.PropertyNamingStrategy;
import com.fasterxml.jackson.databind.annotation.JsonNaming;
import lombok.Data;
import java.util.List;

@Data
@JsonNaming(PropertyNamingStrategies.SnakeCaseStrategy.class)
public class BulkLearnerApprovalRequestDTO {
    private List<LearnerApprovalItem> items;
    
    @Data
    public static class LearnerApprovalItem {
        private List<String> packageSessionIds;
        private String userId;
        private String enrollInviteId;
    }
}


