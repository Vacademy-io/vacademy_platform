package vacademy.io.admin_core_service.features.course_pulse.dto;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

/**
 * One learner in the live Roster, as returned to the teacher UI.
 * {@code onSlideSeconds} is server-computed; the client ticks it up locally between
 * polls (measuring only deltas), so the displayed "reading for N min" stays skew-immune.
 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class PulseRosterRow {
    private String userId;
    private String fullName;
    private String slideId;
    private String slideTitle;
    private String slideType;
    private String chapterId;

    /** "reading for N min" anchor. */
    private long onSlideSeconds;

    /** NEEDS_HELP | ACTIVE | IDLE — derived from the two windows + stuck threshold. */
    private String state;
}
