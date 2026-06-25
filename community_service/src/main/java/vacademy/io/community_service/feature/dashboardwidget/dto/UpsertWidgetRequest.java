package vacademy.io.community_service.feature.dashboardwidget.dto;

import lombok.Data;

import java.util.List;
import java.util.Map;

/**
 * Super-admin create/update body. On create, widgetType + targetType + targetValue + title are
 * required. On update, null fields are left unchanged (payload/visibleRoles replace when present).
 */
@Data
public class UpsertWidgetRequest {
    private String widgetType;            // ONBOARDING_TRACKER|INFO_CARD (required on create)
    private String targetType;            // INSTITUTE|LEAD_TAG (default INSTITUTE)
    private String targetValue;           // instituteId or lead tag (required on create)
    private List<String> visibleRoles;    // null => leave; [] => clear (ADMIN-only)
    private String title;
    private Map<String, Object> payload;  // type-specific
    private String status;                // DRAFT|PUBLISHED|ARCHIVED
    private Integer position;
}
