package vacademy.io.admin_core_service.features.learner_offline.dto;

import com.fasterxml.jackson.databind.PropertyNamingStrategy;
import com.fasterxml.jackson.databind.annotation.JsonNaming;
import lombok.Data;

import java.util.List;

@Data
@JsonNaming(PropertyNamingStrategy.SnakeCaseStrategy.class)
public class OfflineDownloadUrlsRequest {
    /** Registration id (or stable client device id) of an ACTIVE offline device. Required. */
    private String deviceId;
    private String packageSessionId;
    private List<String> fileIds;
}
