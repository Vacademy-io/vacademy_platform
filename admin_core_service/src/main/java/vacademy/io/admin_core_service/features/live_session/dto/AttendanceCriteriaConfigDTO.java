package vacademy.io.admin_core_service.features.live_session.dto;

import com.fasterxml.jackson.annotation.JsonIgnore;
import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

/**
 * Minimum-attendance rule for a live session: a learner counts as PRESENT only
 * if they were actually in the class for at least {@code minDurationPercent} of
 * its scheduled length.
 *
 * <p>Copied onto each session from the institute's
 * {@code LIVE_SESSION_SETTING.defaultAttendanceCriteria} when it is scheduled,
 * so a class is judged by the rule it was created under. Disabled (or absent)
 * means today's behaviour: the join click alone decides.
 *
 * <p>A learner who never appears in the provider's roster is treated as zero
 * minutes attended, which is how "clicked Join but never entered the class"
 * falls out of the same rule rather than needing one of its own.
 */
@Data
@NoArgsConstructor
@AllArgsConstructor
@JsonIgnoreProperties(ignoreUnknown = true)
public class AttendanceCriteriaConfigDTO {

    private boolean enabled;

    /**
     * Share of the scheduled class length a learner must be present for, as a
     * whole percentage (e.g. 60). The rule is inert without a positive value —
     * at 0 everyone clears the bar, including learners who never showed up.
     */
    private Integer minDurationPercent;

    /** Derived, not stored — without this Jackson writes a bogus "active" key into the persisted rule. */
    @JsonIgnore
    public boolean isActive() {
        return enabled && minDurationPercent != null && minDurationPercent > 0;
    }

    public static AttendanceCriteriaConfigDTO off() {
        return new AttendanceCriteriaConfigDTO(false, null);
    }
}
