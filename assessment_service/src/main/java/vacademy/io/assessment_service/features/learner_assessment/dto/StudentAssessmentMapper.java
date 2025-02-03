package vacademy.io.assessment_service.features.learner_assessment.dto;

import java.util.Date;

public class StudentAssessmentMapper {

    public static StudentBasicAssessmentListItemDto toDto(Object[] assessment) {
        StudentBasicAssessmentListItemDto dto = StudentBasicAssessmentListItemDto.builder()
                .assessmentId((String) assessment[0])
                .name((String) assessment[1])
                .playMode((String) assessment[2])
                .evaluationType((String) assessment[3])
                .submissionType((String) assessment[4])
                .duration((Integer) assessment[5])
                .assessmentVisibility((String) assessment[6])
                .status((String) assessment[7])
                .registrationCloseDate((Date) assessment[8])
                .registrationOpenDate((Date) assessment[9])
                .expectedParticipants((Integer) assessment[10])
                .coverFileId((Integer) assessment[11])
                .boundStartTime((Date) assessment[12])
                .boundEndTime((Date) assessment[13])
                .aboutId((String) assessment[14])
                .instructionId((String) assessment[15])
                .createdAt((Date) assessment[16])
                .updatedAt((Date) assessment[17])
                .recentAttemptStatus((String) assessment[18])
                .recentAttemptStartDate((Date) assessment[19])
                .assessmentAttempts((Integer) assessment[20])
                .userAttempts((Integer) assessment[21])
                .previewTime((Integer) assessment[22])
                .lastAttemptId((String) assessment[23])
                .assessmentUserRegistrationId((String) assessment[24])
                .distributionDuration((String) assessment[25])
                .canSwitchSection((Boolean) assessment[26])
                .canIncreaseTime((Boolean) assessment[27])
                .canAskForReattempt((Boolean) assessment[28])
                .omrMode((Boolean) assessment[29])
                .build();

        return dto;
    }
}
