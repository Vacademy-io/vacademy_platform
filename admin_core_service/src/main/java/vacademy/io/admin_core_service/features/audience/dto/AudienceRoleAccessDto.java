package vacademy.io.admin_core_service.features.audience.dto;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import com.fasterxml.jackson.databind.PropertyNamingStrategies;
import com.fasterxml.jackson.databind.annotation.JsonNaming;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.util.List;
import java.util.Map;

/**
 * Persisted under institute setting key {@code AUDIENCE_ROLE_ACCESS}.
 *
 * <p>Per-role rules for what audience lists / responses a user with that role
 * can see in the Recent-Leads view, the per-campaign Lead List view, and the
 * audience-list cards page. Roles not present in {@link #roles} default to
 * {@code DEFAULT} (sees everything). Admin / root users always behave as
 * {@code DEFAULT} regardless of this config.
 */
@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
@JsonNaming(PropertyNamingStrategies.SnakeCaseStrategy.class)
@JsonIgnoreProperties(ignoreUnknown = true)
public class AudienceRoleAccessDto {

    /** Map of role name (uppercase) → access rule. */
    private Map<String, RoleAccessConfig> roles;

    @Data
    @NoArgsConstructor
    @AllArgsConstructor
    @Builder
    @JsonNaming(PropertyNamingStrategies.SnakeCaseStrategy.class)
    @JsonIgnoreProperties(ignoreUnknown = true)
    public static class RoleAccessConfig {
        /** {@code DEFAULT} | {@code COUNSELOR} | {@code AUDIENCE_LIST}. */
        private String mode;
        /** Only meaningful when {@code mode = AUDIENCE_LIST}. */
        private List<String> audienceIds;
    }
}
