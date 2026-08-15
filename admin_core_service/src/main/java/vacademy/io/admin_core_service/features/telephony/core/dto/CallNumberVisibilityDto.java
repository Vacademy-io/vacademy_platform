package vacademy.io.admin_core_service.features.telephony.core.dto;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import com.fasterxml.jackson.databind.PropertyNamingStrategies;
import com.fasterxml.jackson.databind.annotation.JsonNaming;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.util.Map;

/**
 * Persisted inside institute setting key {@code ROLE_DISPLAY_SETTINGS} at the
 * top-level field {@code callNumberVisibility} — sibling to
 * {@code audienceRoleAccess} and the per-role-UUID display config. Written by
 * the Display Settings → "Call Log phone numbers" card, read here by
 * {@link vacademy.io.admin_core_service.features.telephony.core.CallNumberVisibilityService}.
 *
 * <p>Role names are keyed UPPERCASE so the resolver can match JWT authorities
 * directly, exactly like {@code AudienceRoleAccessDto}.
 */
@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
@JsonNaming(PropertyNamingStrategies.SnakeCaseStrategy.class)
@JsonIgnoreProperties(ignoreUnknown = true)
public class CallNumberVisibilityDto {

    /** Map of role name (uppercase) → visibility rule. */
    private Map<String, RoleNumberVisibility> roles;

    @Data
    @NoArgsConstructor
    @AllArgsConstructor
    @Builder
    @JsonNaming(PropertyNamingStrategies.SnakeCaseStrategy.class)
    @JsonIgnoreProperties(ignoreUnknown = true)
    public static class RoleNumberVisibility {
        /** {@code FULL} (unmasked) | {@code MASKED}. Anything else ⇒ role is unconfigured. */
        private String mode;
    }
}
