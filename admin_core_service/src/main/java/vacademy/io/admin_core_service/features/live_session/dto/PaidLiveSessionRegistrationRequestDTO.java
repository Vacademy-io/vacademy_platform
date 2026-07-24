package vacademy.io.admin_core_service.features.live_session.dto;

import com.fasterxml.jackson.databind.PropertyNamingStrategy;
import com.fasterxml.jackson.databind.annotation.JsonNaming;
import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.util.List;

/**
 * Registration request for a (possibly) paid live session — superset of
 * {@link GuestRegistrationRequestDTO} with the payer's display name, which is
 * needed to create the auth user that invoices are billed to.
 */
@Data
@NoArgsConstructor
@AllArgsConstructor
@JsonNaming(PropertyNamingStrategy.SnakeCaseStrategy.class)
public class PaidLiveSessionRegistrationRequestDTO {
    private String sessionId;
    private String email;
    private String mobileNumber;
    private String fullName;
    private List<GuestRegistrationRequestDTO.CustomFieldValueDTO> customFields;
}
