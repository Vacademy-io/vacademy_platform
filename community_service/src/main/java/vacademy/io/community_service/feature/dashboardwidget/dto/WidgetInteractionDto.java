package vacademy.io.community_service.feature.dashboardwidget.dto;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

/** An institute-side comment or milestone confirmation on a widget. */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class WidgetInteractionDto {
    private String id;
    private String widgetId;
    private String milestoneId;
    private String interactionType;   // COMMENT|CONFIRM
    private String message;
    private String userId;
    private String userName;
    private String instituteId;
    private Long createdAt;           // epoch millis
}
