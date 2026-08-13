package vacademy.io.admin_core_service.features.learner_offline.dto;

import com.fasterxml.jackson.databind.PropertyNamingStrategy;
import com.fasterxml.jackson.databind.annotation.JsonNaming;
import lombok.Data;
import vacademy.io.admin_core_service.features.learner_offline.enums.OfflineDownloadReason;

import java.util.List;

@Data
@JsonNaming(PropertyNamingStrategy.SnakeCaseStrategy.class)
public class OfflineManifestSlideDTO {
    private String slideId;
    private String slideType;
    private String title;
    private Integer slideOrder;
    private boolean downloadable;
    private OfflineDownloadReason reason;
    /** Reserved DRM/server-key hook — always null in v1 (see plan Part A3). */
    private String keyRef;
    /** Encrypted-on-device quiz/question/assignment JSON payload (no server-side encryption). */
    private Object inlinePayload;
    private List<OfflineAssetRefDTO> assets;
}
