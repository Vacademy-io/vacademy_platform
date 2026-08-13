package vacademy.io.admin_core_service.features.learner_offline.dto;

import com.fasterxml.jackson.databind.PropertyNamingStrategy;
import com.fasterxml.jackson.databind.annotation.JsonNaming;
import lombok.Data;

import java.util.List;

@Data
@JsonNaming(PropertyNamingStrategy.SnakeCaseStrategy.class)
public class OfflineManifestSubjectDTO {
    private String subjectId;
    private String subjectName;
    private Integer subjectOrder;
    private List<OfflineManifestModuleDTO> modules;
}
