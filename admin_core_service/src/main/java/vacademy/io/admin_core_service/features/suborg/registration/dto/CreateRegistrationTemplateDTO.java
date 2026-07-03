package vacademy.io.admin_core_service.features.suborg.registration.dto;

import com.fasterxml.jackson.databind.PropertyNamingStrategies;
import com.fasterxml.jackson.databind.annotation.JsonNaming;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;
import vacademy.io.admin_core_service.features.common.dto.InstituteCustomFieldDTO;

import java.util.List;

/** Admin request to create an open sub-org registration template (P0: FREE only). */
@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
@JsonNaming(PropertyNamingStrategies.SnakeCaseStrategy.class)
public class CreateRegistrationTemplateDTO {

    private String name;

    /** Fixed course grant: every spawned sub-org gets exactly these package sessions. */
    private List<String> packageSessionIds;

    /** Seat cap per spawned sub-org. */
    private Integer memberCount;

    private Integer validityInDays;

    private List<String> authRoles;
    private List<String> adminPermissions;
    private List<String> allowedTeamRoles;

    /** Media file id of the T&C PDF. Optional part of the TNC step. */
    private String tncFileId;

    /**
     * Consent statements (required checkboxes on the TNC step); inline links via
     * [label](url). TNC step is enabled when tncFileId OR these are provided.
     */
    private List<String> tncConsentItems;

    /** Max COMPLETED registrations through this link. Null = unlimited. */
    private Integer maxRegistrations;

    /** Stored for P1; ignored in P0 (always auto-approve). */
    private Boolean requiresApproval;

    /** Form fields for the CUSTOM_FIELDS step (same shape as invite custom fields). */
    private List<InstituteCustomFieldDTO> instituteCustomFields;

    // ---- P1a payment config. FREE (default) keeps the P0 fresh-FREE-option path. ----

    /** FREE | ONE_TIME | SUBSCRIPTION. Paid types require paymentOptionId + vendor. */
    private String paymentType;

    /** Institute-level PaymentOption to reuse (price/plans come from it, like the manual modal). */
    private String paymentOptionId;

    private String vendor;
    private String vendorId;
    private String currency;

    /**
     * DigiLocker KYC step config: ["AADHAAR"] or ["AADHAAR","PAN"]. Non-empty enables the
     * KYC step (must include AADHAAR). Empty/absent = no KYC.
     */
    private List<String> kycDocuments;
}
