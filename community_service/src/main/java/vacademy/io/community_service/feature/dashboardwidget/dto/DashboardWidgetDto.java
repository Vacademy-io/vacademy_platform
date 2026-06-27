package vacademy.io.community_service.feature.dashboardwidget.dto;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.util.List;
import java.util.Map;

/** A widget as returned to both the super-admin authoring UI and the institute dashboard. */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class DashboardWidgetDto {
    private String id;
    private String widgetType;            // ONBOARDING_TRACKER|INFO_CARD
    private String targetType;            // INSTITUTE|LEAD_TAG
    private String targetValue;
    private List<String> visibleRoles;    // empty => ADMIN only
    private String title;
    private Map<String, Object> payload;  // type-specific (milestones[] | info card body)
    private String status;                // DRAFT|PUBLISHED|ARCHIVED
    private int position;
    private Long createdAt;               // epoch millis
    private Long updatedAt;
}
