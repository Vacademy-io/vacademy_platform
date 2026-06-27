package vacademy.io.admin_core_service.features.student_analysis.dto.comprehensive;

import com.fasterxml.jackson.annotation.JsonInclude;
import com.fasterxml.jackson.databind.PropertyNamingStrategies;
import com.fasterxml.jackson.databind.annotation.JsonNaming;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

/**
 * A single achievement entry in the {@code achievements[]} list.
 * Can represent either a certificate or a synthetic streak badge.
 */
@Data
@Builder
@AllArgsConstructor
@NoArgsConstructor
@JsonNaming(PropertyNamingStrategies.SnakeCaseStrategy.class)
@JsonInclude(JsonInclude.Include.NON_NULL)
public class AchievementItem {

    /** Display title, e.g. "Algebra Foundations — Certificate of Completion" or "9-Day Study Streak". */
    private String title;

    /** ISO date string when issued/earned. */
    private String issuedAt;

    /** Course name — null for badge achievements. */
    private String courseName;

    /** Completion percentage — null for badge achievements. */
    private Integer completionPercentage;

    /** "CERTIFICATE" | "BADGE". Null defaults to CERTIFICATE for backwards compat. */
    private String type;
}
