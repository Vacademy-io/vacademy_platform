package vacademy.io.admin_core_service.features.suborg.registration.dto;

import com.fasterxml.jackson.databind.PropertyNamingStrategies;
import com.fasterxml.jackson.databind.annotation.JsonNaming;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;
import vacademy.io.admin_core_service.features.common.dto.InstituteCustomFieldDTO;

import java.util.List;

/**
 * Admin read-back of a registration template, shaped to round-trip into the
 * edit form (same fields as {@link CreateRegistrationTemplateDTO} plus
 * id/inviteCode/status).
 */
@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
@JsonNaming(PropertyNamingStrategies.SnakeCaseStrategy.class)
public class TemplateDetailDTO {

    private String templateId;
    private String name;
    private String inviteCode;
    private String status;

    /** Fixed course grant: ACTIVE package sessions linked to this template. */
    private List<String> packageSessionIds;

    private Integer memberCount;
    private Integer validityInDays;

    private List<String> authRoles;
    private List<String> adminPermissions;
    private List<String> allowedTeamRoles;

    private String tncFileId;
    private List<String> tncConsentItems;

    private Integer maxRegistrations;

    /** ["AADHAAR"] or ["AADHAAR","PAN"]; null when no KYC step. */
    private List<String> kycDocuments;

    /** FREE | ONE_TIME | SUBSCRIPTION. Payment config is immutable after create. */
    private String paymentType;
    private String paymentOptionId;
    private String vendor;
    private String currency;

    /**
     * Same rows the public /template endpoint returns (outer snake_case,
     * nested custom_field camelCase).
     */
    private List<InstituteCustomFieldDTO> instituteCustomFields;
}
