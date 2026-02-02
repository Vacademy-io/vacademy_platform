package vacademy.io.admin_core_service.features.applicant.dto;

import com.fasterxml.jackson.annotation.JsonProperty;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;
import vacademy.io.admin_core_service.features.applicant.entity.Applicant;

import java.sql.Timestamp;

@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class ApplicantDTO {

    private String id;

    @JsonProperty("application_stage_id")
    private String applicationStageId;

    @JsonProperty("application_stage_status")
    private String applicationStageStatus;

    @JsonProperty("overall_status")
    private String overallStatus;

    @JsonProperty("source")
    private String source;

    @JsonProperty("source_id")
    private String sourceId;

    @JsonProperty("data")
    private java.util.Map<String, Object> data;

    private Timestamp createdAt;
    private Timestamp updatedAt;

    public ApplicantDTO(Applicant applicant) {
        this.id = applicant.getId().toString();
        this.applicationStageId = applicant.getApplicationStageId();
        this.applicationStageStatus = applicant.getApplicationStageStatus();
        this.overallStatus = applicant.getOverallStatus();
        this.createdAt = applicant.getCreatedAt();
        this.updatedAt = applicant.getUpdatedAt();
    }

    public void setSourceDetails(String source, String sourceId) {
        this.source = source;
        this.sourceId = sourceId;
    }
}
