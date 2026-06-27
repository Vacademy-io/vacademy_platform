package vacademy.io.community_service.feature.onboarding.dto;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.util.List;

/** A single question in the master catalogue, consumed by the public form and the link builder. */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class QuestionDto {
    private String key;
    private String label;
    /** QuestionType name. */
    private String type;
    /** Section key for grouping in the wizard. */
    private String section;
    private String sectionLabel;
    private int sectionOrder;
    private boolean required;
    private String placeholder;
    private String helpText;
    private List<QuestionOptionDto> options;
    private boolean multi;
    /** Only show this question when {@code dependsOnKey}'s answer equals {@code dependsOnValue}. */
    private String dependsOnKey;
    private String dependsOnValue;
    /** True for the institute_type question that selects the demo account. */
    private boolean drivesDemo;
    /** If set, a "yes"/non-empty answer adds this flag to features_of_interest. */
    private String featureFlag;
}
