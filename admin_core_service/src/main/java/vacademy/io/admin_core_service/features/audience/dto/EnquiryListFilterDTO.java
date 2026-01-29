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
    private String instituteId; // NEW: For global search when audienceId not provided
    private String status; // enquiry_status
    private String source; // source_type from audience_response
    private String destinationPackageSessionId;
    private Timestamp createdFrom;
    private Timestamp createdTo;

    // NEW: Search filters
    private String searchText; // Unified search across parent_name, parent_email, parent_mobile

    // NEW: Counsellor filters
    private String counsellorId; // Filter by assigned counsellor user ID
    private Boolean hasCounsellor; // Filter by whether counsellor is assigned (true/false/null)

    // Pagination
    private Integer page;
    private Integer size;
}
