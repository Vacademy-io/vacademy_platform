package vacademy.io.admin_core_service.features.live_session.dto;

import com.fasterxml.jackson.databind.PropertyNamingStrategies;
import com.fasterxml.jackson.databind.annotation.JsonNaming;
import lombok.Data;

/**
 * kind: RECORDING | UPLOAD_PDF | UPLOAD_VIDEO | YOUTUBE
 */
@Data
@JsonNaming(PropertyNamingStrategies.SnakeCaseStrategy.class)
public class ContentLinkSourceDTO {
    private String kind;
    private String recordingId;
    private String fileId;
    private String url;
}
