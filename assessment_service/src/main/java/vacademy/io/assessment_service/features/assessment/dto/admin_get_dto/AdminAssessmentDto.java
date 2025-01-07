package vacademy.io.assessment_service.features.assessment.dto.admin_get_dto;

import com.fasterxml.jackson.databind.PropertyNamingStrategies;
import com.fasterxml.jackson.databind.annotation.JsonNaming;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;
import vacademy.io.assessment_service.features.assessment.entity.AssessmentCustomField;
import vacademy.io.assessment_service.features.assessment.entity.AssessmentUserRegistration;
import vacademy.io.assessment_service.features.assessment.entity.Section;
import vacademy.io.assessment_service.features.rich_text.dto.AssessmentRichTextDataDTO;
import vacademy.io.assessment_service.features.rich_text.entity.AssessmentRichTextData;

import java.util.Date;
import java.util.List;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
@JsonNaming(PropertyNamingStrategies.SnakeCaseStrategy.class)
public class AdminAssessmentDto {
    private String id;
    private String name;
    private String aboutId;
    private AssessmentRichTextDataDTO instructions;
    private String playMode;
    private String evaluationType;
    private String submissionType;
    private Integer duration;
    private Integer previewTime;
    private String durationDistribution;
    private Boolean canSwitchSection;
    private Boolean canRequestReattempt;
    private Boolean canRequestTimeIncrease;
    private String assessmentVisibility;
    private String status;
    private Date registrationCloseDate;
    private Date registrationOpenDate;
    private Integer expectedParticipants;
    private Integer coverFileId;
    private Date boundStartTime;
    private Date boundEndTime;
    private List<SectionDto> sections;
    private Integer userRegistrations;
    private List<AssessmentCustomField> assessmentCustomFields;
    private Date createdAt;
    private Date updatedAt;
}
