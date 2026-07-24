package vacademy.io.admin_core_service.features.audience.dto;

import com.fasterxml.jackson.databind.PropertyNamingStrategies;
import com.fasterxml.jackson.databind.annotation.JsonNaming;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;
import vacademy.io.admin_core_service.features.common.dto.request.CustomFieldValueDto;
import vacademy.io.common.auth.dto.UserDTO;

import java.util.List;

/**
 * Request body for editing a lead's profile from the CRM (admin dashboard).
 *
 * <p>Deliberately scoped to exactly what a lead reads/round-trips:
 * <ul>
 *   <li>{@code user_details} → the lead's own auth user (name / email / mobile,
 *       plus any other {@link UserDTO} field if sent)</li>
 *   <li>{@code parent_*} → the guardian fields on the {@code audience_response} row</li>
 *   <li>{@code custom_field_values} → the lead's form answers (source AUDIENCE_RESPONSE)</li>
 * </ul>
 * It does NOT touch the {@code student} table — leads have no student row.</p>
 */
@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
@JsonNaming(PropertyNamingStrategies.SnakeCaseStrategy.class)
public class LeadProfileEditRequestDTO {

    /** Identity fields written back to the lead's auth user. */
    private UserDTO userDetails;

    /** Guardian fields written back to audience_response. */
    private String parentName;
    private String parentEmail;
    private String parentMobile;

    /** Lead form answers; each entry should carry source_type=AUDIENCE_RESPONSE and source_id=responseId. */
    private List<CustomFieldValueDto> customFieldValues;
}
