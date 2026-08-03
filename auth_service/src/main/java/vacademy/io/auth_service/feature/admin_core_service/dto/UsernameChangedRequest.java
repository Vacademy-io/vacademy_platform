package vacademy.io.auth_service.feature.admin_core_service.dto;

import com.fasterxml.jackson.databind.PropertyNamingStrategies;
import com.fasterxml.jackson.databind.annotation.JsonNaming;
import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

/**
 * Body of the username-rename fan-out sent to admin_core. Snake-cased on the
 * wire to match the receiving DTO.
 */
@Data
@NoArgsConstructor
@AllArgsConstructor
@JsonNaming(PropertyNamingStrategies.SnakeCaseStrategy.class)
public class UsernameChangedRequest {

    private String userId;
    private String oldUsername;
    private String newUsername;
}
