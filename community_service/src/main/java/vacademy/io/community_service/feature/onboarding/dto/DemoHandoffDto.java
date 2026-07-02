package vacademy.io.community_service.feature.onboarding.dto;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

/**
 * The demo entry payload returned after a submission (or directly for a direct-demo link).
 * Carries the shared demo credentials and prebuilt login URLs that prefill the portal screens.
 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class DemoHandoffDto {
    private String instituteType;
    private String instituteTypeLabel;
    private String instituteId;
    private String displayName;

    private String adminUsername;
    private String adminPassword;
    private String adminLoginUrl;

    private String learnerUsername;
    private String learnerPassword;
    private String learnerLoginUrl;
}
