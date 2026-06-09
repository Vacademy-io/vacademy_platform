package vacademy.io.admin_core_service.features.sales_dashboard.dto;

import com.fasterxml.jackson.databind.PropertyNamingStrategies;
import com.fasterxml.jackson.databind.annotation.JsonNaming;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.sql.Timestamp;

@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
@JsonNaming(PropertyNamingStrategies.SnakeCaseStrategy.class)
public class FollowupRowDTO {
    private String followupId;
    private String leadId;
    /** Lead's auth-service user_id — drives the leadName hydration. */
    private String leadUserId;
    private String leadName;
    private String counsellorUserId;
    private String counsellorName;
    private Timestamp scheduleTime;
    private String status;
    private String content;
    /** Negative for missed/overdue, positive for upcoming. */
    private Long minutesUntilDue;
}
