package vacademy.io.admin_core_service.features.live_session.dto;

import com.fasterxml.jackson.databind.PropertyNamingStrategies;
import com.fasterxml.jackson.databind.annotation.JsonNaming;
import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.sql.Timestamp;

@Data
@NoArgsConstructor
@AllArgsConstructor
@JsonNaming(PropertyNamingStrategies.SnakeCaseStrategy.class)
public class LiveSessionContentLinkDTO {
    private String id;
    private String sessionId;
    private String scheduleId;
    private String recordingId;
    private String contentType;
    private String slideId;
    private String slideTitle;
    private String chapterId;
    private String chapterName;
    private String packageSessionId;
    private Timestamp createdAt;
}
