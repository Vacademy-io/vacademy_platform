package vacademy.io.admin_core_service.features.parent_portal.dto;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.util.List;

/**
 * The child-home summary. Cheap counts computed here with per-module fault
 * isolation; the six tiles fetch their own LIVE detail from the per-domain
 * endpoints. A module that fails lands in {@code unavailableModules} and its
 * count stays null — never rendered as zero (a failed collector must not read
 * as "0% / no data").
 */
@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class ChildOverviewDTO {
    private ParentChildSummaryDTO child;

    private Integer badgeCount;
    private Integer certificateCount;
    private Integer invoiceCount;
    private Integer pendingInvoiceCount;
    private Integer reportCount;
    private ChildReportListItemDTO latestReport;

    // Headline numbers for the home tiles. Null when the module is off or its
    // collector failed — the UI shows a neutral hint, never a wrong zero.
    private Double attendancePercent;
    private Double courseCompletionPercent;
    private Integer upcomingSessionCount;
    private Integer assessmentCount;

    /** Module keys visible for this institute (echoes settings so the UI needn't re-read). */
    private List<String> availableModules;
    /** Module keys that were visible but whose collector failed this call. */
    private List<String> unavailableModules;
}
