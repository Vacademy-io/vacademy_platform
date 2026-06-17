package vacademy.io.admin_core_service.features.audience.dto;

import com.fasterxml.jackson.databind.PropertyNamingStrategies;
import com.fasterxml.jackson.databind.annotation.JsonNaming;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.util.Map;

/**
 * DTO for a lead submitted from the public course catalogue / course-details
 * "Get Started" form. Unlike {@link SubmitLeadRequestDTO} the caller does not
 * know an audienceId — it only knows the institute. The service resolves (or
 * lazily creates) a per-institute "Course Catalogue Leads" audience and then
 * delegates to the normal v2 lead-submit pipeline so the lead shows up in
 * Audience Manager → Recent Leads and triggers any configured lead workflows.
 */
@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
@JsonNaming(PropertyNamingStrategies.SnakeCaseStrategy.class)
public class CatalogueLeadRequestDTO {

    private String instituteId;

    private String fullName;

    private String email;

    private String mobileNumber;

    /** Course package_session id (or any context id) the lead came from. Optional. */
    private String sourceId;

    /** Extra form fields keyed by field name/key (e.g. "city", "level"). Optional. */
    private Map<String, String> customFieldValues;
}
