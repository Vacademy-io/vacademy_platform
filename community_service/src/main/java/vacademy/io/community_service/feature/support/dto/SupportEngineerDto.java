package vacademy.io.community_service.feature.support.dto;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class SupportEngineerDto {
    private String id;
    private String name;
    private String email;
    private String userId;
    private boolean active;
    /** How many institutes this engineer is the dedicated owner of (super-admin views only). */
    private Integer assignedInstituteCount;
    /** Set when the engineer is listed in an institute's assignment (super-admin config view). */
    private Boolean primary;
}
