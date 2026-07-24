package vacademy.io.admin_core_service.features.parent_portal.dto;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

/**
 * A short "view as my child" session — a freshly minted token that <em>is</em> the
 * child (so the existing learner APIs work unchanged), returned only after the
 * guardian guard + the institute's {@code allowViewAsChild} gate have passed.
 * Read-only is enforced on the client; the parent's own token is never touched.
 */
@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class ParentViewSessionDTO {
    private String childUserId;
    private String childName;
    private String accessToken;
    private String refreshToken;
}
