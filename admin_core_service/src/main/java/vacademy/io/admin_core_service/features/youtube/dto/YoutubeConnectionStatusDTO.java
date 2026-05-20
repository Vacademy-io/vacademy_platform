package vacademy.io.admin_core_service.features.youtube.dto;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.util.Date;

@Data
@Builder
@AllArgsConstructor
@NoArgsConstructor
public class YoutubeConnectionStatusDTO {
    /** ACTIVE | INVALID | NOT_CONNECTED */
    private String status;
    private String channelId;
    private String channelTitle;
    private String channelThumbnailUrl;
    private String connectedByUserId;
    private Date connectedAt;
    private Date lastValidatedAt;
    private String lastError;
}
