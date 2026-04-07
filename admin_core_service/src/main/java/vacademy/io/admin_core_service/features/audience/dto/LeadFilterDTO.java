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

    // ── Status Filters ──
    private java.util.List<String> overallStatuses;    // ENQUIRY, APPLICATION, ADMITTED, etc.
    private java.util.List<String> enquiryStatuses;     // ACTIVE, CONVERTED, etc.

    // ── Dedup Filter ──
    private Boolean excludeDuplicates;      // True = hide duplicates (default behavior)

    // ── Search ──
    private String searchQuery;             // Searches parent name, email, mobile

    // Pagination
    private Integer page;
    private Integer size;
    private String sortBy;                  // SUBMITTED_AT, LEAD_SCORE, PARENT_NAME
    private String sortDirection;           // ASC, DESC
}

