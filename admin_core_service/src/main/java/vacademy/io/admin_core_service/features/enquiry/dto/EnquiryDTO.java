package vacademy.io.admin_core_service.features.enquiry.dto;

import com.fasterxml.jackson.databind.PropertyNamingStrategies;
import com.fasterxml.jackson.databind.annotation.JsonNaming;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

/**
 * DTO for Enquiry information
 */
@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
@JsonNaming(PropertyNamingStrategies.SnakeCaseStrategy.class)
public class EnquiryDTO {

    private String checklist; // JSON structure for checklist items
    private String enquiryStatus;
    private String convertionStatus;
    private String referenceSource;
    private Boolean assignedUserId;
    private Boolean assignedVisitSessionId;
    private String feeRangeExpectation;
    private String transportRequirement;
    private String mode;
    private String enquiryTrackingId;
    private Integer interestScore;
    private String notes;
}
