package vacademy.io.admin_core_service.features.learner_offline.dto;

import com.fasterxml.jackson.databind.PropertyNamingStrategy;
import com.fasterxml.jackson.databind.annotation.JsonNaming;
import lombok.Getter;
import lombok.Setter;
import vacademy.io.admin_core_service.features.learner_offline.entity.OfflineSyncDiscrepancy;

import java.sql.Timestamp;

@Getter
@Setter
@JsonNaming(PropertyNamingStrategy.SnakeCaseStrategy.class)
public class OfflineSyncDiscrepancyDTO {
    private String id;
    private String clientEventId;
    private String activityId;
    private String userId;
    private String slideId;
    private String packageSessionId;
    private String questionId;
    private String field;
    private String clientValue;
    private String serverValue;
    private String status;
    private Timestamp createdAt;

    public static OfflineSyncDiscrepancyDTO from(OfflineSyncDiscrepancy d) {
        OfflineSyncDiscrepancyDTO dto = new OfflineSyncDiscrepancyDTO();
        dto.setId(d.getId());
        dto.setClientEventId(d.getClientEventId());
        dto.setActivityId(d.getActivityId());
        dto.setUserId(d.getUserId());
        dto.setSlideId(d.getSlideId());
        dto.setPackageSessionId(d.getPackageSessionId());
        dto.setQuestionId(d.getQuestionId());
        dto.setField(d.getField());
        dto.setClientValue(d.getClientValue());
        dto.setServerValue(d.getServerValue());
        dto.setStatus(d.getStatus());
        dto.setCreatedAt(d.getCreatedAt());
        return dto;
    }
}
