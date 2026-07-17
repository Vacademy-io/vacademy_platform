package vacademy.io.assessment_service.features.learner_assessment.dto.internal;

import com.fasterxml.jackson.databind.PropertyNamingStrategies;
import com.fasterxml.jackson.databind.annotation.JsonNaming;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

/**
 * Per-user assessment summary inside {@link BatchAssessmentHistoryResponse}.
 *
 * A user only gets an entry when they have at least one ENDED attempt in the
 * window — callers treat absence as "no data", never as zeros.
 */
@Getter
@Setter
@Builder
@NoArgsConstructor
@AllArgsConstructor
@JsonNaming(PropertyNamingStrategies.LowerCamelCaseStrategy.class)
public class UserAssessmentSummaryDto {

    /** Number of ENDED (submitted) attempts in the window. Always >= 1 when present. */
    private Long attemptCount;

    /** ISO-8601 instant of the most recent attempt, or null. */
    private String lastAttemptAt;

    /**
     * Average score percentage (0-100) across attempts whose marks data allows a
     * reliable computation (earned marks present AND achievable section-marks sum > 0).
     * Null when no attempt in the window has computable marks — never a fabricated number.
     */
    private Double avgPercentage;

    /** Name of the assessment of the most recent attempt, or null. */
    private String lastAssessmentName;
}
