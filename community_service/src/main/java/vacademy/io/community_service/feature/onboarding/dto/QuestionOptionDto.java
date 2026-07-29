package vacademy.io.community_service.feature.onboarding.dto;

import com.fasterxml.jackson.annotation.JsonInclude;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.util.List;

/**
 * One choice in a SELECT / MULTISELECT, or one group card in a FEATURE_GROUPS question.
 * Group cards carry an icon, a one-line summary and the features nested underneath them;
 * plain options leave those null and serialise exactly as before.
 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
@JsonInclude(JsonInclude.Include.NON_NULL)
public class QuestionOptionDto {
    private String value;
    private String label;

    /** Lucide icon name the FE renders on the card (e.g. "graduation-cap"). */
    private String icon;

    /** One-line summary shown under the label on a group card. */
    private String description;

    /** Features nested inside a group card; null for a plain option. */
    private List<QuestionOptionDto> children;

    public QuestionOptionDto(String value, String label) {
        this.value = value;
        this.label = label;
    }
}
