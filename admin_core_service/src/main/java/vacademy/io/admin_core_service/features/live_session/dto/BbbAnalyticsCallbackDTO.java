package vacademy.io.admin_core_service.features.live_session.dto;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import com.fasterxml.jackson.annotation.JsonProperty;
import lombok.Data;

import java.util.List;

/**
 * Maps the JSON body that BBB POSTs to meta_analytics-callback-url after a meeting ends.
 * See: https://docs.bigbluebutton.org/development/api/#analytics-callback
 */
@Data
@JsonIgnoreProperties(ignoreUnknown = true)
public class BbbAnalyticsCallbackDTO {

    @JsonProperty("meeting_id")
    private String meetingId;

    @JsonProperty("internal_meeting_id")
    private String internalMeetingId;

    @JsonProperty("meeting_name")
    private String meetingName;

    private Long duration; // meeting duration in seconds

    private List<Attendee> attendees;

    @Data
    @JsonIgnoreProperties(ignoreUnknown = true)
    public static class Attendee {

        @JsonProperty("ext_user_id")
        private String extUserId; // our userId (passed as userID in join URL)

        private String name;
        private Boolean moderator;
        private Long duration; // seconds in meeting

        private Engagement engagement;
    }

    @Data
    @JsonIgnoreProperties(ignoreUnknown = true)
    public static class Engagement {
        private Integer chats;
        private Integer talks;

        @JsonProperty("talk_time")
        private Integer talkTime; // seconds

        private Integer raisehand;
        private Integer emojis;

        @JsonProperty("poll_votes")
        private Integer pollVotes;
    }
}
