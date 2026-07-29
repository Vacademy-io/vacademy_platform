package vacademy.io.admin_core_service.features.institute_pulse.dto;

import lombok.Builder;
import lombok.Data;

import java.util.Map;
import java.util.Set;

/** One meeting currently running on a BBB server, as reported by getMeetings. */
@Data
@Builder
public class BbbRunningMeetingDTO {

    private String meetingId;

    /** Live occupancy — who is in the room NOW, unlike our "ever joined" attendance count. */
    private int participantCount;

    private int moderatorCount;

    private int videoCount;

    private int voiceCount;

    /** Provider user ids currently in the room. Diffing this between polls yields join/leave. */
    private Set<String> attendeeIds;

    /**
     * Provider user id -> display name, straight from getMeetings.
     *
     * <p>BBB already tells us who each participant is, so join/leave events can name the person
     * rather than saying "a participant". Note a LEAVE has to be named from the PREVIOUS
     * snapshot — by the time we notice, they are gone from the current one.
     */
    private Map<String, String> attendeeNames;

    /** Provider user ids holding MODERATOR role — the host(s). */
    private Set<String> moderatorIds;
}
