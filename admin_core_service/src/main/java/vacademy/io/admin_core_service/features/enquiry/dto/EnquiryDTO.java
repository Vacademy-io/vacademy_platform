package vacademy.io.admin_core_service.features.enquiry.dto;

import com.fasterxml.jackson.databind.PropertyNamingStrategies;
import com.fasterxml.jackson.databind.annotation.JsonNaming;
import jakarta.validation.constraints.Size;
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

    private String checklist;

    @Size(max = 255, message = "Enquiry status must not exceed 255 characters")
    private String enquiryStatus;

    @Size(max = 255, message = "Conversion status must not exceed 255 characters")
    private String convertionStatus;

    @Size(max = 255, message = "Reference source must not exceed 255 characters")
    private String referenceSource;

    private Boolean assignedUserId;
    private Boolean assignedVisitSessionId;

    @Size(max = 255, message = "Fee range expectation must not exceed 255 characters")
    private String feeRangeExpectation;

    @Size(max = 255, message = "Transport requirement must not exceed 255 characters")
    private String transportRequirement;

    @Size(max = 255, message = "Mode must not exceed 255 characters")
    private String mode;

    private String enquiryTrackingId;
    private Integer interestScore;

    @Size(max = 2000, message = "Notes must not exceed 2000 characters")
    private String notes;

    @Size(max = 255, message = "Parent relation must not exceed 255 characters")
    private String parentRelationWithChild;
}
