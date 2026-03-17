package vacademy.io.admin_core_service.features.applicant.dto;

import com.fasterxml.jackson.annotation.JsonProperty;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;
import vacademy.io.admin_core_service.features.applicant.entity.ApplicantStage;

import java.sql.Timestamp;

@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class ApplicantStageDTO {

    private String id;

    @JsonProperty("stage_id")
    private String stageId;

    @JsonProperty("stage_status")
    private String stageStatus;

    @JsonProperty("response_json")
    private String responseJson;

    @JsonProperty("applicant_id")
    private String applicantId;

    private Timestamp createdAt;
    private Timestamp updatedAt;

    public ApplicantStageDTO(ApplicantStage applicantStage) {
        this.id = applicantStage.getId().toString();
        this.stageId = applicantStage.getStageId().toString();
        this.stageStatus = applicantStage.getStageStatus();
        this.responseJson = applicantStage.getResponseJson();
        this.applicantId = applicantStage.getApplicantId().toString();
        this.createdAt = applicantStage.getCreatedAt();
        this.updatedAt = applicantStage.getUpdatedAt();
    }
}
