package vacademy.io.community_service.feature.onboarding.dto;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.util.Date;
import java.util.List;
import java.util.Map;

/** Create/update a link. {@code slug} is optional on create (auto-generated when blank). */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class UpsertLinkRequest {
    private String name;
    private String slug;
    private String linkType;
    private List<String> visibleQuestionKeys;
    private Map<String, Object> prefilledValues;
    private String forcedInstituteType;
    private String introHeading;
    private String introSubheading;
    private Boolean active;
    private Date expiresAt;
}
