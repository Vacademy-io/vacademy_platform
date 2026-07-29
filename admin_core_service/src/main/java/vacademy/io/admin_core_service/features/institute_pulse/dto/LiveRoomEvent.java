package vacademy.io.admin_core_service.features.institute_pulse.dto;

import lombok.Builder;
import lombok.Data;

/**
 * A join or leave inferred by diffing consecutive BBB getMeetings polls.
 *
 * <p>Held in memory only — deliberately never written to the database. Persisting one row per
 * join/leave on every poll would add write load proportional to concurrent learners, which is
 * exactly the cost this feature is not allowed to introduce. The live feed only ever looks back
 * minutes, so a bounded in-memory buffer covers every read that exists.
 */
@Data
@Builder
public class LiveRoomEvent {

    private long occurredAtEpoch;

    private String instituteId;

    private String sessionId;

    private String scheduleId;

    private String sessionTitle;

    /** Provider participant id. Correlating it to our user id needs the deferred customerKey work. */
    private String providerUserId;

    /** Display name as BBB reported it. Null only if the provider sent no name. */
    private String participantName;

    /** True when this participant holds MODERATOR role — i.e. is hosting the class. */
    private boolean host;

    /** JOINED_ROOM or LEFT_ROOM. */
    private String eventType;
}
