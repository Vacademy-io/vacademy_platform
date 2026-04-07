package vacademy.io.admin_core_service.features.audience.dto;

import com.fasterxml.jackson.databind.PropertyNamingStrategies;
import com.fasterxml.jackson.databind.annotation.JsonNaming;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

/**
 * Simplified walk-in registration DTO.
 * Minimal fields for speed at events/fairs — auto-maps to SubmitLeadWithEnquiryRequestDTO internally.
 */
@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
@JsonNaming(PropertyNamingStrategies.SnakeCaseStrategy.class)
public class WalkInRegistrationDTO {

    /** Campaign/audience to register under (REQUIRED) */
    private String audienceId;

    // ── Parent Info ──────────────────────────────
    /** Parent/guardian full name (REQUIRED) */
    private String parentName;

    /** Parent phone number (REQUIRED) */
    private String parentMobile;

    /** Parent email (optional but recommended) */
    private String parentEmail;

    // ── Child Info ───────────────────────────────
    /** Child/student name (REQUIRED) */
    private String childName;

    /** Child gender (optional: MALE/FEMALE/OTHER) */
    private String childGender;

    // ── Academic Info ────────────────────────────
    /** Target class/session (optional — maps to destinationPackageSessionId) */
    private String destinationPackageSessionId;

    /** Any initial notes from the registering counselor */
    private String notes;
}
