package vacademy.io.community_service.feature.onboarding.dto;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.util.Date;
import java.util.List;
import java.util.Map;

/** Super-admin view of a generated link, including the full shareable URL. */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class OnboardingLinkDto {
    private String id;
    private String slug;
    private String name;
    private String linkType;
    private List<String> visibleQuestionKeys;
    private Map<String, Object> prefilledValues;
    private String forcedInstituteType;
    private String introHeading;
    private String introSubheading;
    private boolean active;
    private Date expiresAt;
    private int submissionCount;
    private Date createdAt;
    /** Fully-qualified public URL to share. */
    private String shareUrl;
}
