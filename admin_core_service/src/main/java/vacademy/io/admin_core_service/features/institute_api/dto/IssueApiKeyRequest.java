package vacademy.io.admin_core_service.features.institute_api.dto;

import com.fasterxml.jackson.annotation.JsonAlias;
import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import com.fasterxml.jackson.annotation.JsonProperty;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.util.List;

/**
 * Body of a key issue (institute admin: POST /admin-core-service/v1/api-keys;
 * super-admin: POST /admin-core-service/super-admin/v1/institutes/{id}/api-keys).
 * snake_case per the spec, camelCase accepted as an alias.
 */
@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
@JsonIgnoreProperties(ignoreUnknown = true)
public class IssueApiKeyRequest {

    /** Institute admin route only (or ?instituteId=); the super-admin route takes it from the path. */
    @JsonProperty("institute_id")
    @JsonAlias("instituteId")
    private String instituteId;

    private String name;

    /** Defaults to evaluation:read + evaluation:write when empty. */
    private List<String> scopes;

    /** ISO-8601 instant, e.g. 2027-03-31T00:00:00Z. Optional; must be in the future. */
    @JsonProperty("expires_at")
    @JsonAlias("expiresAt")
    private String expiresAt;

    /** Optional per-key daily copy cap (>= 1). */
    @JsonProperty("daily_copy_cap")
    @JsonAlias("dailyCopyCap")
    private Integer dailyCopyCap;
}
