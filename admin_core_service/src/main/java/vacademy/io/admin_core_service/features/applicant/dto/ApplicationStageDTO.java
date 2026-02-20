package vacademy.io.admin_core_service.features.applicant.dto;

import com.fasterxml.jackson.annotation.JsonProperty;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;
import vacademy.io.admin_core_service.features.applicant.entity.ApplicationStage;
import vacademy.io.admin_core_service.features.applicant.enums.ApplicantStageType;

@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class ApplicationStageDTO {

    private String id;

    @JsonProperty("stage_name")
    private String stageName;

    private String sequence;
    private String source;

    @JsonProperty("source_id")
    private String sourceId;

    @JsonProperty("institute_id")
    private String instituteId;

    @JsonProperty("config_json")
    private String configJson;

    private ApplicantStageType type;

    @JsonProperty("is_first")
    private Boolean isFirst;

    @JsonProperty("is_last")
    private Boolean isLast;

    public ApplicationStageDTO(ApplicationStage stage) {
        this.id = stage.getId().toString();
        this.stageName = stage.getStageName();
        this.sequence = stage.getSequence();
        this.source = stage.getSource();
        this.sourceId = stage.getSourceId();
        this.instituteId = stage.getInstituteId();
        this.configJson = stage.getConfigJson();
        this.type = stage.getType();
        this.isFirst = stage.getIsFirst();
        this.isLast = stage.getIsLast();
    }
}
