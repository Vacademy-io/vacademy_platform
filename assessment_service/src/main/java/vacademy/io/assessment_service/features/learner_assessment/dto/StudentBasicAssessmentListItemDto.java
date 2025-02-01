package vacademy.io.assessment_service.features.learner_assessment.dto;

import com.fasterxml.jackson.databind.PropertyNamingStrategies;
import com.fasterxml.jackson.databind.annotation.JsonNaming;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.util.Date;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
@JsonNaming(PropertyNamingStrategies.SnakeCaseStrategy.class)
public class StudentBasicAssessmentListItemDto {
    private String assessmentId;
    private String name;
    private String aboutId;
    private String instructionId;
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
    private Date createdAt;
    private Date updatedAt;
    private String recentAttemptStatus;
    private Date recentAttemptStartDate;
    private Integer assessmentAttempts;
    private Integer userAttempts;
    private Integer previewTime;
    private String lastAttemptId;
    private String assessmentUserRegistrationId;
    private String distributionDuration;
    private Boolean canSwitchSection;
    private Boolean canIncreaseTime;
    private Boolean canAskForReattempt;
    private Boolean omrMode;
}
