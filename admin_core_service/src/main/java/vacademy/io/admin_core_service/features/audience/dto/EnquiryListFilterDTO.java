package vacademy.io.admin_core_service.features.audience.dto;

import com.fasterxml.jackson.databind.PropertyNamingStrategies;
import com.fasterxml.jackson.databind.annotation.JsonNaming;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.sql.Timestamp;

/**
 * DTO for filtering enquiry list
 */
@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
@JsonNaming(PropertyNamingStrategies.SnakeCaseStrategy.class)
public class EnquiryListFilterDTO {

    private String audienceId;
    private String status; // enquiry_status
    private String source; // source_type from audience_response
    private String destinationPackageSessionId;
    private Timestamp createdFrom;
    private Timestamp createdTo;

    private String search;

    // ── New Phase 1 filters ──
    private String leadTier;                // HOT / WARM / COLD
    private String assignedCounselorId;     // filter by counselor
    private Boolean excludeDuplicates;      // hide duplicate leads
    private Integer minLeadScore;           // score >= this
    private Integer maxLeadScore;           // score <= this
    private java.util.List<String> overallStatuses; // filter by overall_status
    private String sortBy;                  // SUBMITTED_AT | LEAD_SCORE | PARENT_NAME
    private String sortDirection;           // ASC | DESC

    // Pagination
    private Integer page;
    private Integer size;
}
