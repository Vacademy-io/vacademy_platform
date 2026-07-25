package vacademy.io.admin_core_service.features.parent_link.dto;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import com.fasterxml.jackson.databind.PropertyNamingStrategies;
import com.fasterxml.jackson.databind.annotation.JsonNaming;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

/**
 * Outcome of an explicit "share guardian credentials" action, so the UI can
 * report exactly where the mail went (or why it didn't).
 */
@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
@JsonNaming(PropertyNamingStrategies.SnakeCaseStrategy.class)
@JsonIgnoreProperties(ignoreUnknown = true)
public class ShareCredentialsResultDTO {
    private boolean sent;
    /** Which party was targeted — "STUDENT" or "GUARDIAN". */
    private String recipient;
    private String recipientEmail;
    /** Populated when {@code sent} is false, e.g. the chosen recipient has no email. */
    private String reason;
}
