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
                .createdAttempts((Long) assessment[22])
                .previewTime((Integer) assessment[23])
                .lastAttemptId((String) assessment[24])
                .assessmentUserRegistrationId((String) assessment[25])
                .distributionDuration((String) assessment[26])
                .canSwitchSection((Boolean) assessment[27])
                .canIncreaseTime((Boolean) assessment[28])
                .canAskForReattempt((Boolean) assessment[29])
                .omrMode((Boolean) assessment[30])
                .build();

        return dto;
    }
}
