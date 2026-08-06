package vacademy.io.community_service.feature.support.dto;

import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

/**
 * An institute-side person to notify when support replies. {@code userId} may be null for a
 * contact we only know by email — email still works, but an in-app system alert needs the id.
 */
@Data
@AllArgsConstructor
@NoArgsConstructor
public class SupportRecipientDto {
    private String userId;
    private String email;
    private String name;
}
