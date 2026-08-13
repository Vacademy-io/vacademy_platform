package vacademy.io.admin_core_service.features.learner_offline.dto;

import com.fasterxml.jackson.databind.PropertyNamingStrategy;
import com.fasterxml.jackson.databind.annotation.JsonNaming;
import lombok.Data;

import java.util.List;

@Data
@JsonNaming(PropertyNamingStrategy.SnakeCaseStrategy.class)
public class OfflineManifestDTO {
    private String packageSessionId;
    /**
     * Human-readable course name, so the learner app can say WHICH course changed.
     * Without it the Downloads screen could only manage "New content is available
     * for this course", which is meaningless when several courses are downloaded.
     */
    private String courseName;
    private long manifestVersion;
    private OfflineManifestSettingsDTO settings;
    private List<OfflineManifestSubjectDTO> subjects;
}
