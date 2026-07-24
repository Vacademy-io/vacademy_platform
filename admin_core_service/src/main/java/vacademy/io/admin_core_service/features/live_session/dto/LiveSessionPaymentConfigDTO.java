package vacademy.io.admin_core_service.features.live_session.dto;

import com.fasterxml.jackson.databind.PropertyNamingStrategy;
import com.fasterxml.jackson.databind.annotation.JsonNaming;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

/**
 * Admin-facing payment configuration for a live session (wizard Step 2).
 * enabled=false (or null price) means the session is free — the legacy behaviour.
 * One price covers the whole session/series regardless of schedule count.
 */
@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
@JsonNaming(PropertyNamingStrategy.SnakeCaseStrategy.class)
public class LiveSessionPaymentConfigDTO {
    private Boolean enabled;
    private Double price;
    private String currency;
}
