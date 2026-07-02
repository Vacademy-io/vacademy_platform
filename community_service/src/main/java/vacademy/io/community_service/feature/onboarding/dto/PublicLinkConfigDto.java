package vacademy.io.community_service.feature.onboarding.dto;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.util.List;
import java.util.Map;

/** What the public form needs to render a link. Never carries demo passwords. */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class PublicLinkConfigDto {
    private String slug;
    private String linkType;
    private String introHeading;
    private String introSubheading;
    private boolean active;
    private boolean expired;
    /** Set when the institute type is pre-decided; the form then skips the type picker. */
    private String forcedInstituteType;
    /** Options for the institute-type picker (value + display label). */
    private List<QuestionOptionDto> instituteTypes;
    /** Visible, ordered questions for this link. */
    private List<QuestionDto> questions;
    /** Known answers to silently apply (keyed by question key). */
    private Map<String, Object> prefilled;
}
