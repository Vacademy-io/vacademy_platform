package vacademy.io.admin_core_service.features.live_session.provider.dto.google;

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
public class GoogleTestConnectionResponse {

    private boolean ok;

    /** Email of the connected Google account — confirms which account is authorized. */
    private String accountEmail;

    /** Populated when {@code ok = false}; safe for display to the admin. */
    private String error;
}
