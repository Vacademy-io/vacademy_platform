package vacademy.io.admin_core_service.features.admission.dto;

import com.fasterxml.jackson.databind.PropertyNamingStrategies;
import com.fasterxml.jackson.databind.annotation.JsonNaming;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.sql.Timestamp;
import java.util.Date;

@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
@JsonNaming(PropertyNamingStrategies.SnakeCaseStrategy.class)
public class AdmissionResponsesListItemDTO {

    // Stable row identifier for detail API
    private String admissionId; // audience_response.id

    private String destinationPackageSessionId; // audience_response.destination_package_session_id
    private String enquiryId; // audience_response.enquiry_id
    private String applicantId; // audience_response.applicant_id

    // Table columns (admission-focused)
    private String applyingForClass; // "Class" column
    private String studentName;
    private String gender;
    private Date dateOfBirth;

    private String parentName;
    private String parentEmail;
    private String parentMobile;

    private String trackingId; // applicant.tracking_id (if applicant exists)
    private String status; // audience_response.overall_status
    private String source; // audience_response.source_type

    private Timestamp createdAt; // audience_response.created_at
}

