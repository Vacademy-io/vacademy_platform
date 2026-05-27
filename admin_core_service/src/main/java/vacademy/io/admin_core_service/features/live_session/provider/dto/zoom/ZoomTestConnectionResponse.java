package vacademy.io.admin_core_service.features.live_session.provider.dto.zoom;

import com.fasterxml.jackson.annotation.JsonInclude;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
@JsonInclude(JsonInclude.Include.NON_NULL)
public class ZoomTestConnectionResponse {

    private boolean ok;

    /** Email of the Zoom account owner — confirms which account the credentials belong to. */
    private String accountEmail;

    /** Zoom plan type (e.g. "Pro", "Business") — useful sanity check for free-tier limits. */
    private String planType;

    /** Populated when {@code ok = false}; safe for display to the admin. */
    private String error;
}
