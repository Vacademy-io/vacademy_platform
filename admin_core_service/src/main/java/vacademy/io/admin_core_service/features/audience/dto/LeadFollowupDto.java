package vacademy.io.admin_core_service.features.audience.dto;

import com.fasterxml.jackson.databind.PropertyNamingStrategies;
import com.fasterxml.jackson.databind.annotation.JsonNaming;
import lombok.*;
import vacademy.io.admin_core_service.features.audience.entity.LeadFollowup;

import java.sql.Timestamp;

@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
@JsonNaming(PropertyNamingStrategies.SnakeCaseStrategy.class)
public class LeadFollowupDto {

    private String id;
    private String audienceResponseId;
    private String instituteId;
    private String createdBy;
    private Timestamp scheduleTime;
    private String status;
    private Boolean isClosed;
    private String content;
    private String closerReason;
    private String closedBy;
    private Timestamp closedAt;
    private Timestamp createdAt;
    private Timestamp updatedAt;

    public static LeadFollowupDto from(LeadFollowup f) {
        return LeadFollowupDto.builder()
                .id(f.getId())
                .audienceResponseId(f.getAudienceResponseId())
                .instituteId(f.getInstituteId())
                .createdBy(f.getCreatedBy())
                .scheduleTime(f.getScheduleTime())
                .status(f.getStatus())
                .isClosed(f.getIsClosed())
                .content(f.getContent())
                .closerReason(f.getCloserReason())
                .closedBy(f.getClosedBy())
                .closedAt(f.getClosedAt())
                .createdAt(f.getCreatedAt())
                .updatedAt(f.getUpdatedAt())
                .build();
    }
}
