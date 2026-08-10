package vacademy.io.admin_core_service.features.learner_offline.dto;

import com.fasterxml.jackson.databind.PropertyNamingStrategy;
import com.fasterxml.jackson.databind.annotation.JsonNaming;
import lombok.Data;

import java.util.List;

@Data
@JsonNaming(PropertyNamingStrategy.SnakeCaseStrategy.class)
public class OfflineManifestDTO {
    private String packageSessionId;
    private long manifestVersion;
    private OfflineManifestSettingsDTO settings;
    private List<OfflineManifestSubjectDTO> subjects;
}
