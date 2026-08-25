package vacademy.io.admin_core_service.features.learner_access.dto;

import com.fasterxml.jackson.databind.PropertyNamingStrategies;
import com.fasterxml.jackson.databind.annotation.JsonNaming;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;
import vacademy.io.admin_core_service.features.learner_access.entity.LearnerAccessLog;

import java.util.Date;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
@JsonNaming(PropertyNamingStrategies.SnakeCaseStrategy.class)
public class LearnerAccessLogDTO {

    private String id;
    private String userId;
    private String packageSessionId;
    private String mappingId;
    private String source;
    private String action;
    private Date previousExpiryDate;
    private Date newExpiryDate;
    private Integer daysDelta;
    private Integer accessDays;
    private String userPlanId;
    private String paymentPlanId;
    private String enrollInviteId;
    private String reason;
    private String actorId;
    private String actorName;
    private Date createdAt;

    public static LearnerAccessLogDTO from(LearnerAccessLog log) {
        return LearnerAccessLogDTO.builder()
                .id(log.getId())
                .userId(log.getUserId())
                .packageSessionId(log.getPackageSessionId())
                .mappingId(log.getMappingId())
                .source(log.getSource())
                .action(log.getAction())
                .previousExpiryDate(log.getPreviousExpiryDate())
                .newExpiryDate(log.getNewExpiryDate())
                .daysDelta(log.getDaysDelta())
                .accessDays(log.getAccessDays())
                .userPlanId(log.getUserPlanId())
                .paymentPlanId(log.getPaymentPlanId())
                .enrollInviteId(log.getEnrollInviteId())
                .reason(log.getReason())
                .actorId(log.getActorId())
                .actorName(log.getActorName())
                .createdAt(log.getCreatedAt())
                .build();
    }
}
