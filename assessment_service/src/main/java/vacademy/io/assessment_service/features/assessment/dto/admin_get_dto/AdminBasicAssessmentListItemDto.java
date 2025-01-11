package vacademy.io.assessment_service.features.assessment.dto.admin_get_dto;

import com.fasterxml.jackson.databind.PropertyNamingStrategies;
import com.fasterxml.jackson.databind.annotation.JsonNaming;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;
import vacademy.io.assessment_service.features.assessment.entity.Assessment;
import vacademy.io.assessment_service.features.assessment.entity.AssessmentCustomField;
import vacademy.io.assessment_service.features.rich_text.dto.AssessmentRichTextDataDTO;

import java.util.ArrayList;
import java.util.Date;
import java.util.List;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
@JsonNaming(PropertyNamingStrategies.SnakeCaseStrategy.class)
public class AdminBasicAssessmentListItemDto {
    private String assessmentId;
    private String name;
    private AssessmentRichTextDataDTO about;
    private String playMode;
    private String evaluationType;
    private String submissionType;
    private Integer duration;
    private String assessmentVisibility;
    private String status;
    private Date registrationCloseDate;
    private Date registrationOpenDate;
    private Integer expectedParticipants;
    private Integer coverFileId;
    private Date boundStartTime;
    private Date boundEndTime;
    private Integer userRegistrations;
    private Integer batchRegistrations;
    private List<String> adminAccesses = new ArrayList<>();
    private Date createdAt;
    private Date updatedAt;

    public AdminBasicAssessmentListItemDto(Assessment assessment){
        this.assessmentId = assessment.getId();
        this.name = assessment.getName();
        this.about = assessment.getAbout().toDTO();
        this.playMode = assessment.getPlayMode();
        this.evaluationType = assessment.getEvaluationType();
        this.submissionType = assessment.getSubmissionType();
        this.duration = assessment.getDuration();
        this.assessmentVisibility = assessment.getAssessmentVisibility();
        this.status = assessment.getStatus();
        this.registrationCloseDate = assessment.getRegistrationCloseDate();
        this.registrationOpenDate = assessment.getRegistrationOpenDate();
        this.expectedParticipants = assessment.getExpectedParticipants();
        this.coverFileId = assessment.getCoverFileId();
        this.boundStartTime = assessment.getBoundStartTime();
        this.boundEndTime = assessment.getBoundEndTime();
        this.userRegistrations = assessment.getUserRegistrations().size();
        this.batchRegistrations = assessment.getBatchRegistrations().size();
        this.createdAt = assessment.getCreatedAt();
        this.updatedAt = assessment.getUpdatedAt();
    }
}
