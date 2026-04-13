package vacademy.io.admin_core_service.features.common.dto;

import com.fasterxml.jackson.databind.PropertyNamingStrategies;
import com.fasterxml.jackson.databind.annotation.JsonNaming;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

/**
 * One mapping row of {@code institute_custom_fields} flattened for the
 * cascade-delete dialog in Settings → Custom Fields. Contains everything the
 * admin needs to identify a single mapping (which feature instance it lives
 * on) and pick it for deletion.
 *
 * <p>Returned by {@code GET /admin-core-service/common/custom-fields/usages}.
 */
@Data
@Builder
@AllArgsConstructor
@NoArgsConstructor
@JsonNaming(PropertyNamingStrategies.SnakeCaseStrategy.class)
public class CustomFieldMappingUsageDTO {

    /** Primary key of the {@code institute_custom_fields} row. */
    private String mappingId;

    /** Custom field type — DEFAULT_CUSTOM_FIELD / ENROLL_INVITE / AUDIENCE_FORM / SESSION / ASSESSMENT. */
    private String type;

    /**
     * Id of the parent feature instance (enroll_invite.id, audience.id,
     * live_session.id, assessment.id). Null for DEFAULT_CUSTOM_FIELD.
     */
    private String typeId;

    /** Status of the mapping (always ACTIVE here, but kept for future use). */
    private String status;
}
