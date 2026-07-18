package vacademy.io.admin_core_service.features.parent_portal.dto;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.util.Date;

/**
 * One row in the parent's "reports" list — metadata only. The full report is
 * fetched via the existing {@code /v1/student-analysis/report/{processId}}
 * (now parent-accessible through the canAccess guardian leg). Parents never
 * trigger generation, so this only ever lists staff-generated reports.
 */
@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class ChildReportListItemDTO {
    private String processId;
    private String name;
    private String status;
    private Date createdAt;
}
