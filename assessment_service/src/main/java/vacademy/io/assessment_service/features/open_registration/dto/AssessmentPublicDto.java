package vacademy.io.assessment_service.features.open_registration.dto;


import com.fasterxml.jackson.databind.PropertyNamingStrategies;
import com.fasterxml.jackson.databind.annotation.JsonNaming;
import lombok.AllArgsConstructor;
import lombok.Getter;
import lombok.Setter;
import vacademy.io.assessment_service.features.assessment.entity.Assessment;
import vacademy.io.assessment_service.features.rich_text.dto.AssessmentRichTextDataDTO;

import java.util.Date;

@Getter
@Setter
@JsonNaming(PropertyNamingStrategies.SnakeCaseStrategy.class)
@AllArgsConstructor
public class AssessmentPublicDto {

    private String assessmentId;
    private String assessmentName;
    private AssessmentRichTextDataDTO about;
    private String playMode;
    private String evaluationType;
    private String submissionType;
    private Integer duration;
    private String status;
    private Date registrationCloseDate;
    private Date registrationOpenDate;
    private Integer expectedParticipants;
    private Integer coverFileId;
    private Date boundStartTime;
    private Date boundEndTime;
    private Integer reattemptCount;
    private Date createdAt;
    private Date updatedAt;

    public AssessmentPublicDto(Assessment assessment) {

        this.assessmentId = assessment.getId();
        this.assessmentName = assessment.getName();
        this.about = new AssessmentRichTextDataDTO(assessment.getAbout());
        this.playMode = assessment.getPlayMode();
        this.evaluationType = assessment.getEvaluationType();
        this.submissionType = assessment.getSubmissionType();
        this.duration = assessment.getDuration();
        this.status = assessment.getStatus();
        this.registrationCloseDate = assessment.getRegistrationCloseDate();
        this.registrationOpenDate = assessment.getRegistrationOpenDate();
        this.expectedParticipants = assessment.getExpectedParticipants();
        this.coverFileId = assessment.getCoverFileId();
        this.boundStartTime = assessment.getBoundStartTime();
        this.boundEndTime = assessment.getBoundEndTime();
        this.reattemptCount = assessment.getReattemptCount();
        this.createdAt = assessment.getCreatedAt();
        this.updatedAt = assessment.getUpdatedAt();
    }
}
