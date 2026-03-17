package vacademy.io.admin_core_service.features.applicant.dto;

import com.fasterxml.jackson.annotation.JsonProperty;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class ApplicantFilterDTO {

    @JsonProperty("institute_id")
    private String instituteId;

    @JsonProperty("source")
    private String source;

    @JsonProperty("source_id")
    private String sourceId;

    @JsonProperty("overall_status")
    private String overallStatus;

    @JsonProperty("application_stage_id")
    private String applicationStageId;

    @JsonProperty("package_session_id")
    private String packageSessionId;

    private Integer page;
    private Integer size;
}
