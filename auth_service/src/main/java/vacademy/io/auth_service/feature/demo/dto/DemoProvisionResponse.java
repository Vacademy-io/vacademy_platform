package vacademy.io.auth_service.feature.demo.dto;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.sql.Timestamp;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class DemoProvisionResponse {
    private String instituteId;
    private String instituteName;
    private String adminUsername;
    private Timestamp expiresAt;
    /** Where the prospect signs in. */
    private String adminPortalUrl;
}
