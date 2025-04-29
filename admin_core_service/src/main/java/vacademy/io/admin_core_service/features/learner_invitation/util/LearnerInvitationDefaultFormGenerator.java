package vacademy.io.admin_core_service.features.learner_invitation.util;

import vacademy.io.admin_core_service.features.learner_invitation.dto.AddLearnerInvitationDTO;
import vacademy.io.admin_core_service.features.learner_invitation.dto.LearnerInvitationCustomFieldDTO;
import vacademy.io.admin_core_service.features.learner_invitation.dto.LearnerInvitationDTO;
import vacademy.io.admin_core_service.features.learner_invitation.enums.CustomFieldStatusEnum;
import vacademy.io.admin_core_service.features.learner_invitation.enums.LearnerInvitationCodeStatusEnum;
import vacademy.io.admin_core_service.features.learner_invitation.enums.LearnerInvitationSourceTypeEnum;
import vacademy.io.common.institute.entity.session.PackageSession;

import java.sql.Date;
import java.util.ArrayList;
import java.util.List;

public class LearnerInvitationDefaultFormGenerator {

    public static AddLearnerInvitationDTO generateSampleInvitation(PackageSession packageSession, String instituteId) {

        String batchOptionsJson = generateBatchOptionsJson(packageSession);

        List<LearnerInvitationCustomFieldDTO> customFieldDTOS = new ArrayList<>();
        customFieldDTOS.add(createCustomField("Email", "TEXT", "", "Enter your email address", true, ""));
        customFieldDTOS.add(createCustomField("Mobile Number", "TEXT", "", "Enter your mobile number", true, ""));
        customFieldDTOS.add(createCustomField("Gender", "DROPDOWN", "", "Select your gender", true, "Male,Female,Other"));
        customFieldDTOS.add(createCustomField("Parent Contact Number", "TEXT", "", "Enter parent contact number", false, ""));
        customFieldDTOS.add(createCustomField("Guardian Contact Number", "TEXT", "", "Enter guardian contact number", false, ""));
        customFieldDTOS.add(createCustomField("School/College Name", "TEXT", "", "Enter School/College Name", false, ""));

        long hundredYearsInMillis = 100L * 365 * 24 * 60 * 60 * 1000;
        AddLearnerInvitationDTO addLearnerInvitationDTO = new AddLearnerInvitationDTO();
        addLearnerInvitationDTO.setLearnerInvitation(LearnerInvitationDTO.builder()
                .name(packageSession.getLevel().getLevelName() + " " + packageSession.getPackageEntity().getPackageName())
                .status(LearnerInvitationCodeStatusEnum.ACTIVE.name())
                .dateGenerated(new Date(System.currentTimeMillis()))
                .expiryDate(new Date(System.currentTimeMillis() + hundredYearsInMillis))
                .instituteId(instituteId)
                .batchOptionsJson(batchOptionsJson)
                .source(LearnerInvitationSourceTypeEnum.PACKAGE_SESSION.name())
                .sourceId(packageSession.getId())
                .customFields(customFieldDTOS)
                .build());
        return addLearnerInvitationDTO;
    }

    public static LearnerInvitationCustomFieldDTO createCustomField(
            String fieldName,
            String fieldType,
            String defaultValue,
            String description,
            boolean isMandatory,
            String commaSeparatedOptions
    ) {
        return LearnerInvitationCustomFieldDTO.builder()
                .fieldName(fieldName)
                .fieldType(fieldType)
                .defaultValue(defaultValue)
                .description(description)
                .isMandatory(isMandatory)
                .commaSeparatedOptions(commaSeparatedOptions)
                .status(CustomFieldStatusEnum.ACTIVE.name())
                .build();
    }

    private static String generateBatchOptionsJson(PackageSession packageSession) {
        String sessionId = packageSession.getSession().getId();
        String sessionName = packageSession.getSession().getSessionName();

        String levelId = packageSession.getLevel().getId();
        String levelName = packageSession.getLevel().getLevelName();

        String packageSessionId = packageSession.getId();
        String packageId = packageSession.getPackageEntity().getId();
        String packageName = packageSession.getPackageEntity().getPackageName();

        return String.format("""
        {
          "institute_assigned": true,
          "max_selectable_packages": 0,
          "pre_selected_packages": [
            {
              "id": "%s",
              "name": "%s",
              "institute_assigned": true,
              "max_selectable_sessions": 0,
              "pre_selected_session_dtos": [
                {
                  "id": "%s",
                  "name": "%s",
                  "institute_assigned": true,
                  "max_selectable_levels": 0,
                  "pre_selected_levels": [
                    {
                      "id": "%s",
                      "name": "%s",
                      "package_session_id": "%s"
                    }
                  ],
                  "learner_choice_levels": []
                }
              ],
              "learner_choice_sessions": []
            }
          ],
          "learner_choice_packages": []
        }
        """, packageId, packageName, sessionId, sessionName, levelId, levelName, packageSessionId);
    }
}
