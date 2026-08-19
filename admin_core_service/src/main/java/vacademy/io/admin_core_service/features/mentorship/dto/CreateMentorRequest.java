package vacademy.io.admin_core_service.features.mentorship.dto;

import com.fasterxml.jackson.databind.PropertyNamingStrategies;
import com.fasterxml.jackson.databind.annotation.JsonNaming;
import java.util.List;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

/** Promote an existing user to a mentor within an institute. */
@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
@JsonNaming(PropertyNamingStrategies.SnakeCaseStrategy.class)
public class CreateMentorRequest {
    private String instituteId;
    private String userId;
    private String displayName;
    private String title;
    private String profileImageFileId;
    private String bio;
    private String subOrgId;
    /** Topics this mentor covers; stored comma-separated. */
    private List<String> expertiseTags;
    /** Capacity cap on ACTIVE mentees; null/0 = unlimited. */
    private Integer maxMentees;
    /** Opt this mentor into the learner-facing directory. Defaults to false. */
    private Boolean isDiscoverable;
}
