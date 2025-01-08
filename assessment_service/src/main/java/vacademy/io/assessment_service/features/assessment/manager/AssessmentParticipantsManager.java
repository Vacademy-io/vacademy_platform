package vacademy.io.assessment_service.features.assessment.manager;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.ResponseEntity;
import org.springframework.stereotype.Component;
import org.springframework.util.ObjectUtils;
import vacademy.io.assessment_service.features.assessment.dto.AssessmentSaveResponseDto;
import vacademy.io.assessment_service.features.assessment.dto.RegistrationFieldDto;
import vacademy.io.assessment_service.features.assessment.dto.create_assessment.AssessmentRegistrationsDto;
import vacademy.io.assessment_service.features.assessment.entity.Assessment;
import vacademy.io.assessment_service.features.assessment.entity.AssessmentBatchRegistration;
import vacademy.io.assessment_service.features.assessment.entity.AssessmentCustomField;
import vacademy.io.assessment_service.features.assessment.entity.AssessmentUserRegistration;
import vacademy.io.assessment_service.features.assessment.repository.AssessmentCustomFieldRepository;
import vacademy.io.assessment_service.features.assessment.repository.AssessmentRepository;
import vacademy.io.assessment_service.features.assessment.repository.AssessmentUserRegistrationRepository;
import vacademy.io.assessment_service.features.assessment.service.assessment_get.AssessmentService;
import vacademy.io.assessment_service.features.assessment.service.bulk_entry_services.AssessmentBatchRegistrationService;
import vacademy.io.assessment_service.features.rich_text.entity.AssessmentRichTextData;
import vacademy.io.assessment_service.features.rich_text.enums.TextType;
import vacademy.io.common.auth.model.CustomUserDetails;
import vacademy.io.common.core.utils.DateUtil;
import vacademy.io.common.exceptions.VacademyException;
import vacademy.io.common.student.dto.BasicParticipantDTO;

import java.util.ArrayList;
import java.util.Date;
import java.util.List;
import java.util.Optional;

import static vacademy.io.common.auth.enums.CompanyStatus.ACTIVE;

@Component
public class AssessmentParticipantsManager {
    @Autowired
    AssessmentService assessmentService;

    @Autowired
    AssessmentRepository assessmentRepository;

    @Autowired
    AssessmentBatchRegistrationService assessmentBatchRegistrationService;

    @Autowired
    AssessmentUserRegistrationRepository assessmentUserRegistrationRepository;

    @Autowired
    AssessmentCustomFieldRepository assessmentCustomFieldRepository;

    public ResponseEntity<AssessmentSaveResponseDto> saveParticipantsToAssessment(CustomUserDetails user, AssessmentRegistrationsDto assessmentRegistrationsDto, String assessmentId, String instituteId, String type) {

        Optional<Assessment> assessmentOptional = assessmentService.getAssessmentWithActiveSections(assessmentId, instituteId);

        if (assessmentOptional.isEmpty()) {
            throw new VacademyException("Assessment not found");
        }

        preRegisterBatches(assessmentRegistrationsDto.getAddedPreRegisterBatchesDetails(), instituteId, assessmentOptional.get());
        preRegisterParticipant(user, assessmentRegistrationsDto.getAddedPreRegisterStudentsDetails(), instituteId, assessmentOptional);
        removeBatches(assessmentRegistrationsDto.getDeletedPreRegisterBatchesDetails(), instituteId, assessmentOptional.get());
        removeParticipants(assessmentRegistrationsDto.getDeletedPreRegisterStudentsDetails(), instituteId, assessmentOptional.get());
        handleOpenRegistration(assessmentRegistrationsDto.getOpenTestDetails(), assessmentOptional.get());
        handleJoinUrlChange(assessmentRegistrationsDto.getUpdatedJoinLink(), assessmentOptional.get(), instituteId);
        handleAssessmentParticipantNotification(assessmentRegistrationsDto.getNotifyStudent(), assessmentRegistrationsDto.getNotifyParent(), assessmentOptional.get(), instituteId);
        return ResponseEntity.ok(new AssessmentSaveResponseDto(assessmentOptional.get().getId(), assessmentOptional.get().getStatus()));
    }

    private void handleAssessmentParticipantNotification(AssessmentRegistrationsDto.NotifyStudent notifyStudent, AssessmentRegistrationsDto.NotifyParent notifyParent, Assessment assessment, String instituteId) {
        //TODO: handle notification
    }

    private void handleJoinUrlChange(String updatedJoinLink, Assessment assessment, String instituteId) {
        //TODO: handle join url change
    }

    private void preRegisterParticipant(CustomUserDetails user, List<BasicParticipantDTO> addedParticipants, String instituteId, Optional<Assessment> assessmentOptional) {
        List<AssessmentUserRegistration> userRegistrations = new ArrayList<>();
        for (BasicParticipantDTO participantDTO : addedParticipants) {
            userRegistrations.add(addUserToAssessment(participantDTO, user.getUserId(), instituteId, assessmentOptional.get()));
        }
        assessmentUserRegistrationRepository.saveAll(userRegistrations);
    }

    private void handleOpenRegistration(AssessmentRegistrationsDto.OpenTestDetails openTestDetails, Assessment assessment) {
        if (ObjectUtils.isEmpty(openTestDetails)) return;

        if (!ObjectUtils.isEmpty(openTestDetails.getRegistrationStartDate())) {
            assessment.setRegistrationOpenDate(DateUtil.convertStringToUTCDate(openTestDetails.getRegistrationStartDate()));
        }

        if (!ObjectUtils.isEmpty(openTestDetails.getRegistrationEndDate())) {
            assessment.setRegistrationCloseDate(DateUtil.convertStringToUTCDate(openTestDetails.getRegistrationEndDate()));
        }

        if (!ObjectUtils.isEmpty(openTestDetails.getInstructionsHtml())) {
            assessment.setInstructions(new AssessmentRichTextData(null, TextType.HTML.name(), openTestDetails.getInstructionsHtml()));
            assessmentRepository.save(assessment);
        }

        if (!ObjectUtils.isEmpty(openTestDetails.getRegistrationFormDetails())) {
            addCustomRegistrationFieldsToAsessment(openTestDetails, assessment);
            removeAddedFieldsIfAny(openTestDetails, assessment);
        }

    }

    private void removeAddedFieldsIfAny(AssessmentRegistrationsDto.OpenTestDetails openTestDetails, Assessment assessment) {
        List<String> deletedFieldKeys = openTestDetails.getRegistrationFormDetails().getRemovedCustomAddedFields().stream().map(RegistrationFieldDto::getKey).toList();
        if (!deletedFieldKeys.isEmpty()) {
            assessmentCustomFieldRepository.softDeleteByAssessmentIdAndFieldKeys(assessment.getId(), deletedFieldKeys);
        }
    }

    private void addCustomRegistrationFieldsToAsessment(AssessmentRegistrationsDto.OpenTestDetails openTestDetails, Assessment assessment) {
        List<AssessmentCustomField> customFields = new ArrayList<>();
        for (RegistrationFieldDto registrationFieldDto : openTestDetails.getRegistrationFormDetails().getAddedCustomAddedFields()) {
            customFields.add(createRegistrationField(registrationFieldDto, assessment));
        }
        assessmentCustomFieldRepository.saveAll(customFields);
    }

    private AssessmentCustomField createRegistrationField(RegistrationFieldDto registrationFieldDto, Assessment assessment) {
        AssessmentCustomField assessmentCustomField = new AssessmentCustomField();
        assessmentCustomField.setAssessment(assessment);
        assessmentCustomField.setFieldKey(registrationFieldDto.getName().toLowerCase().trim().replace(" ", "_"));
        assessmentCustomField.setFieldName(registrationFieldDto.getName().trim());
        assessmentCustomField.setFieldType(registrationFieldDto.getType().trim());
        assessmentCustomField.setIsMandatory(registrationFieldDto.getIsMandatory());
        assessmentCustomField.setStatus(ACTIVE.name());
        assessmentCustomField.setCommaSeparatedOptions(registrationFieldDto.getCommaSeparatedOptions());
        return assessmentCustomField;
    }

    private void preRegisterBatches(List<String> addedBatches, String instituteId, Assessment assessment) {
        List<AssessmentBatchRegistration> batchRegistrations = new ArrayList<>();
        for (String batchId : addedBatches) {
            batchRegistrations.add(addBatchToAssessment(instituteId, batchId, assessment));
        }
        assessmentBatchRegistrationService.addMultipleRegistrations(batchRegistrations);
    }

    private void removeBatches(List<String> deletedBatches, String instituteId, Assessment assessment) {
        if (deletedBatches.isEmpty()) return;
        assessmentBatchRegistrationService.softDeleteRegistrationsByIds(deletedBatches, instituteId, assessment.getId());
    }

    private void removeParticipants(List<BasicParticipantDTO> deletedParticipants, String instituteId, Assessment assessment) {
        if (deletedParticipants.isEmpty()) return;
        assessmentUserRegistrationRepository.softDeleteByAssessmentIdAndUserIdsAndInstituteId(assessment.getId(), deletedParticipants.stream().map(BasicParticipantDTO::getUserId).toList(), instituteId);
    }

    AssessmentBatchRegistration addBatchToAssessment(String instituteId, String batchId, Assessment assessment) {
        AssessmentBatchRegistration assessmentBatchRegistration = new AssessmentBatchRegistration();
        assessmentBatchRegistration.setAssessment(assessment);
        assessmentBatchRegistration.setBatchId(batchId);
        assessmentBatchRegistration.setInstituteId(instituteId);
        assessmentBatchRegistration.setStatus(ACTIVE.name());
        assessmentBatchRegistration.setRegistrationTime(new Date());
        return assessmentBatchRegistration;
    }


    AssessmentUserRegistration addUserToAssessment(BasicParticipantDTO basicParticipantDTO, String adminUserId, String instituteId, Assessment assessment) {
        AssessmentUserRegistration assessmentParticipantRegistration = new AssessmentUserRegistration();
        assessmentParticipantRegistration.setAssessment(assessment);
        assessmentParticipantRegistration.setUserId(basicParticipantDTO.getUserId());
        assessmentParticipantRegistration.setUserEmail(basicParticipantDTO.getUsername());
        assessmentParticipantRegistration.setParticipantName(basicParticipantDTO.getFullName());
        assessmentParticipantRegistration.setPhoneNumber(basicParticipantDTO.getMobileNumber());
        assessmentParticipantRegistration.setFaceFileId(basicParticipantDTO.getFileId());
        assessmentParticipantRegistration.setUserEmail(basicParticipantDTO.getEmail());
        assessmentParticipantRegistration.setInstituteId(instituteId);
        assessmentParticipantRegistration.setStatus(ACTIVE.name());
        assessmentParticipantRegistration.setSource("ADMIN_PRE_REGISTRATION");
        assessmentParticipantRegistration.setSourceId(adminUserId);
        assessmentParticipantRegistration.setRegistrationTime(new Date());
        return assessmentParticipantRegistration;
    }

}
