package vacademy.io.admin_core_service.features.translation.dto;

import com.fasterxml.jackson.annotation.JsonProperty;
import lombok.AllArgsConstructor;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

import java.util.List;

/**
 * Locales with learner-visible translated content for a package session
 * (published_count > 0 in content_translation_coverage). Empty list when the
 * package session has no translations — canonical (source-locale) content only.
 */
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
public class AvailableLanguagesResponseDTO {

    @JsonProperty("package_session_id")
    private String packageSessionId;

    @JsonProperty("available_languages")
    private List<String> availableLanguages;
}
