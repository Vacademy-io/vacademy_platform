package vacademy.io.admin_core_service.features.onboarding.dto;

import com.fasterxml.jackson.databind.PropertyNamingStrategies;
import com.fasterxml.jackson.databind.annotation.JsonNaming;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

/**
 * One FORM step field, resolved for a specific caller role (STUDENT/PARENT): the field is
 * already filtered by view permission (a field the role can't view is simply absent from the
 * response, not sent with canView=false) and carries whether the caller may edit it, plus its
 * already-submitted value if any -- so the learner app can render editable / read-only fields
 * correctly instead of showing everything as an editable text input regardless of role.
 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
@JsonNaming(PropertyNamingStrategies.SnakeCaseStrategy.class)
public class OnboardingResolvedFieldDTO {
    private String instituteCustomFieldId;
    private String fieldName;
    private Integer fieldOrder;
    private Boolean isMandatory;
    private Boolean canEdit;
    private String value;
}
