package vacademy.io.notification_service.features.combot.dto;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import com.fasterxml.jackson.databind.PropertyNamingStrategies;
import com.fasterxml.jackson.databind.annotation.JsonNaming;
import lombok.Data;

import java.util.Map;

@Data
@JsonIgnoreProperties(ignoreUnknown = true)
@JsonNaming(PropertyNamingStrategies.SnakeCaseStrategy.class)
public class TrackingRequest {

    // Maps to 'notification_type' (Max 20 chars, e.g., "YOUTUBE_WATCH")
    private String type;

    // Maps to 'channel_id' (Required by DB). Use Phone/Email or Session ID.
    private String channelId;

    // Maps to 'user_id'. Optional.
    private String userId;

    // Maps to 'source' (e.g., "WEBSITE", "MOBILE_APP")
    private String source;

    // Maps to 'source_id' (e.g., Video ID "vid_123" or Page URL)
    private String sourceId;

    // Maps to 'body'. Can contain view_time, percentage, etc.
    private Map<String, Object> metadata;
}