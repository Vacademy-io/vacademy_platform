package vacademy.io.admin_core_service.features.audience.dto;

import com.fasterxml.jackson.databind.PropertyNamingStrategies;
import com.fasterxml.jackson.databind.annotation.JsonNaming;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.sql.Timestamp;

/**
 * DTO for filtering leads/responses
 */
@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
@JsonNaming(PropertyNamingStrategies.SnakeCaseStrategy.class)
public class LeadFilterDTO {

    private String audienceId;
    private String instituteId;
    private String sourceType; // WEBSITE, GOOGLE_ADS, WALK_IN, etc.
    private String sourceId;
    private Timestamp submittedFromLocal;
    private Timestamp submittedToLocal;

    // ── Lead Score Filters ──
    private Integer minLeadScore;           // Filter leads with score >= this
    private Integer maxLeadScore;           // Filter leads with score <= this
    private String leadTier;                // HOT / WARM / COLD

    // ── Counselor Filters ──
    private String assignedCounselorId;     // Filter by assigned counselor
    private Boolean isUnassigned;           // True = only unassigned leads

    // ── Pipeline status filter ──
    private String leadStatusId;            // Filter by lead_status.id (custom pipeline stage)

    // ── Status Filters ──
    private java.util.List<String> overallStatuses;    // ENQUIRY, APPLICATION, ADMITTED, etc.
    private java.util.List<String> enquiryStatuses;     // ACTIVE, CONVERTED, etc.

    // ── Dedup Filter ──
    private Boolean excludeDuplicates;      // True = hide duplicates (default behavior)

    // ── Search ──
    private String searchQuery;             // Searches parent name, email, mobile

    // ── Conversion-status filter ──
    // 'EXCLUDE_CONVERTED' (default) hides leads whose user_lead_profile.conversion_status
    // is CONVERTED — assignments to a course flip a lead to that state, and we
    // don't want them cluttering the active-leads view by default.
    // 'ONLY_CONVERTED' shows only converted leads. 'ALL' shows everything.
    private String conversionStatusFilter;

    // ── SLA-state filter ──
    // Filters by audience_response.tat_reminder_stage — the stage the SLA scheduler last
    // emitted for the lead. Same values shown in the leads-table badges:
    //   TAT_BEFORE | TAT_OVERDUE | FOLLOW_UP_DUE | FOLLOW_UP_OVERDUE
    // Plus 'ANY_OVERDUE' which matches TAT_OVERDUE OR FOLLOW_UP_OVERDUE. Null/empty = no filter.
    private String slaFilter;

    // ── Custom-field dropdown filters ──
    // Each entry narrows the result set so a response only matches when there
    // is a {custom_field_id, value} row in custom_field_values for it. Multiple
    // entries are AND-combined. Built specifically for the Lead List dropdown
    // filters (per-campaign), where the available fields and option values
    // come from the campaign's own custom_fields config.
    private java.util.List<CustomFieldFilter> customFieldFilters;

    // Pagination
    private Integer page;
    private Integer size;
    private String sortBy;                  // SUBMITTED_AT, LEAD_SCORE, PARENT_NAME
    private String sortDirection;           // ASC, DESC

    @Data
    @NoArgsConstructor
    @AllArgsConstructor
    @JsonNaming(PropertyNamingStrategies.SnakeCaseStrategy.class)
    public static class CustomFieldFilter {
        private String fieldId;
        private String value;
    }
}

