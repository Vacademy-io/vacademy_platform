package vacademy.io.admin_core_service.features.translation.dto;

import com.fasterxml.jackson.annotation.JsonProperty;
import lombok.AllArgsConstructor;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

import java.util.Map;

/**
 * Translation status for one (packageSession, locale): counts of sidecar rows
 * grouped by state (RICH_TEXT + ENTITY_FIELD rows reachable from the package
 * session's slides) plus the maintained coverage counter that drives the
 * learner-facing available_languages list.
 */
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
public class TranslationStatusResponseDTO {

    @JsonProperty("package_session_id")
    private String packageSessionId;

    @JsonProperty("locale")
    private String locale;

    @JsonProperty("counts_by_state")
    private Map<String, Long> countsByState;

    @JsonProperty("coverage_published_count")
    private int coveragePublishedCount;
}
