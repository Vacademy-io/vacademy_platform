package vacademy.io.admin_core_service.features.live_session.dto;

import com.fasterxml.jackson.databind.PropertyNamingStrategy;
import com.fasterxml.jackson.databind.annotation.JsonNaming;
import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.util.List;
@Data
@NoArgsConstructor
@AllArgsConstructor
@JsonNaming(PropertyNamingStrategy.SnakeCaseStrategy.class)
public class LiveSessionStep2RequestDTO {
    private String sessionId; // id of the session to complete the draft info
    private String accessType; // "public" or "private"
    private List<String> packageSessionIds;
    private String joinLink;
    private NotifySettings notifySettings;

    @Data
    public static class NotifyBy {
        private boolean mail;
        private boolean whatsapp;
    }

    @Data
    @JsonNaming(PropertyNamingStrategy.SnakeCaseStrategy.class)
    public static class NotifySettings {
        private NotifyBy notifyBy;
        private boolean onCreate;
        private boolean onLive;
        private boolean beforeLive;
        private List<BeforeLiveTime> beforeLiveTime;

        @Data
        public static class BeforeLiveTime {
            private String time; // example: "10 min"
        }
    }
}
