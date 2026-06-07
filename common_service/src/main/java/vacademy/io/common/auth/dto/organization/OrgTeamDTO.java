package vacademy.io.common.auth.dto.organization;

import com.fasterxml.jackson.databind.PropertyNamingStrategies;
import com.fasterxml.jackson.databind.annotation.JsonNaming;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.sql.Timestamp;

/**
 * Wire shape of an organization_team row. Lives in common_service so both
 * auth_service (owner) and admin_core_service (consumer via HMAC) can use
 * the same type.
 */
@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
@JsonNaming(PropertyNamingStrategies.SnakeCaseStrategy.class)
public class OrgTeamDTO {
    private String id;
    private String instituteId;
    private String parentId;
    private String name;
    private String description;
    private String headUserId;
    private String status;
    private Integer sortOrder;
    private Long memberCount;
    private Timestamp createdAt;
    private Timestamp updatedAt;
}
