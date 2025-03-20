package vacademy.io.admin_core_service.features.learner_invitation.services;

import jakarta.transaction.Transactional;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;
import org.springframework.stereotype.Service;
import org.springframework.util.StringUtils;
import vacademy.io.admin_core_service.features.institute.repository.InstituteRepository;
import vacademy.io.admin_core_service.features.learner_invitation.dto.*;
import vacademy.io.admin_core_service.features.learner_invitation.entity.LearnerInvitation;
import vacademy.io.admin_core_service.features.learner_invitation.entity.LearnerInvitationCustomFieldResponse;
import vacademy.io.admin_core_service.features.learner_invitation.entity.LearnerInvitationResponse;
import vacademy.io.admin_core_service.features.learner_invitation.enums.CustomFieldStatusEnum;
import vacademy.io.admin_core_service.features.learner_invitation.enums.LearnerInvitationCodeStatusEnum;
import vacademy.io.admin_core_service.features.learner_invitation.enums.LearnerInvitationResponseStatusEnum;
import vacademy.io.admin_core_service.features.learner_invitation.notification.LearnerInvitationNotification;
import vacademy.io.admin_core_service.features.learner_invitation.repository.LearnerInvitationCustomFieldResponseRepository;
import vacademy.io.admin_core_service.features.learner_invitation.repository.LearnerInvitationRepository;
import vacademy.io.admin_core_service.features.learner_invitation.repository.LearnerInvitationResponseRepository;
import vacademy.io.common.auth.model.CustomUserDetails;
import vacademy.io.common.exceptions.VacademyException;
import vacademy.io.common.institute.entity.Institute;

import java.util.*;

@Service
public class LearnerInvitationResponseService {

    @Autowired
    private LearnerInvitationResponseRepository learnerInvitationResponseRepository;

    @Autowired
    private LearnerInvitationRepository learnerInvitationRepository;

    @Autowired
    private LearnerInvitationCustomFieldResponseRepository learnerInvitationCustomFieldResponseRepository;

    @Autowired
    private InstituteRepository instituteRepository;

    @Autowired
    private LearnerInvitationNotification notification;

    @Transactional
    public String registerLearnerInvitationResponse(LearnerInvitationResponseDTO learnerInvitationResponseDTO) {
        validateRequest(learnerInvitationResponseDTO);
        validateRegisterLearnerInvitationResponse(learnerInvitationResponseDTO);
        LearnerInvitation learnerInvitation = learnerInvitationRepository.findById(learnerInvitationResponseDTO.getLearnerInvitationId()).orElseThrow(() -> new VacademyException("Learner invitation not found"));
        LearnerInvitationResponse learnerInvitationResponse = new LearnerInvitationResponse(learnerInvitationResponseDTO,learnerInvitation);
        learnerInvitationResponse = learnerInvitationResponseRepository.save(learnerInvitationResponse);
        saveCustomFields(learnerInvitationResponseDTO.getCustomFieldsResponse(),learnerInvitationResponse);
        sendMailToLeaner(learnerInvitationResponse);
        return learnerInvitationResponse.getId();
    }

    private void sendMailToLeaner(LearnerInvitationResponse learnerInvitationResponse) {
        Institute institute = instituteRepository.findById(learnerInvitationResponse.getInstituteId()).orElseThrow(() -> new VacademyException("Institute not found"));
        notification.sendLearnerInvitationResponseNotification(learnerInvitationResponse.getEmail(),institute.getInstituteName(),learnerInvitationResponse.getId());
    }

    private void saveCustomFields(List<LearnerInvitationCustomFieldResponseDTO> learnerInvitationCustomFieldResponsesDTOs, LearnerInvitationResponse learnerInvitationResponse) {
        if (Objects.isNull(learnerInvitationCustomFieldResponsesDTOs) || learnerInvitationCustomFieldResponsesDTOs.isEmpty()){
            return;
        }
        List<LearnerInvitationCustomFieldResponse> learnerInvitationResponses = new ArrayList<>();
        for (LearnerInvitationCustomFieldResponseDTO learnerInvitationCustomFieldResponseDTO : learnerInvitationCustomFieldResponsesDTOs) {
            learnerInvitationResponses.add(new LearnerInvitationCustomFieldResponse(learnerInvitationCustomFieldResponseDTO,learnerInvitationResponse));
        }
        learnerInvitationCustomFieldResponseRepository.saveAll(learnerInvitationResponses);
    }
    private void validateRequest(LearnerInvitationResponseDTO learnerInvitationResponseDTO) {
        if (Objects.isNull(learnerInvitationResponseDTO)){
            throw new VacademyException("learnerInvitationResponseDTO is null");
        }
        if (!StringUtils.hasText(learnerInvitationResponseDTO.getEmail())){
            throw new VacademyException("Email is null or empty");
        }
        if (!StringUtils.hasText(learnerInvitationResponseDTO.getFullName())){
            throw new VacademyException("Full name is null or empty");
        }
        if (!StringUtils.hasText(learnerInvitationResponseDTO.getContactNumber())){
            throw new VacademyException("Contact number is null or empty");
        }
        if (!StringUtils.hasText(learnerInvitationResponseDTO.getInstituteId())){
            throw new VacademyException("Institute id is null or empty");
        }
        if (!StringUtils.hasText(learnerInvitationResponseDTO.getLearnerInvitationId())){
            throw new VacademyException("Learner invitation id is null or empty");
        }
    }

    private void validateRegisterLearnerInvitationResponse(LearnerInvitationResponseDTO learnerInvitationResponseDTO) {
        Optional<LearnerInvitationResponse>learnerInvitationResponse = learnerInvitationResponseRepository.findByEmailAndLearnerInvitationIdAndStatusIn(learnerInvitationResponseDTO.getEmail(),learnerInvitationResponseDTO.getLearnerInvitationId(), List.of(LearnerInvitationResponseStatusEnum.ACTIVE.name(),LearnerInvitationResponseStatusEnum.ACCEPTED.name()));
        if (learnerInvitationResponse.isPresent()){
            throw new VacademyException("Learner with email id "+learnerInvitationResponseDTO.getEmail()+" have been already requested for this invitation");
        }
    }

    public LearnerInvitationFormDTO getInvitationFormByInviteCodeAndInstituteId(String instituteId, String inviteCode){
        LearnerInvitation learnerInvitation = learnerInvitationRepository.findByInstituteIdAndInviteCodeAndStatus(instituteId,inviteCode,List.of(LearnerInvitationCodeStatusEnum.ACTIVE.name()),List.of(CustomFieldStatusEnum.ACTIVE.name())).orElseThrow(()->new VacademyException("This invite link is closed. Please contact to institute for further support or reopen the link."));
        if (learnerInvitation.getExpiryDate().before(new Date())){
            throw new VacademyException("This invite code is expired. Please contact to institute for further support.");
        }
        Institute institute = instituteRepository.findById(instituteId).orElseThrow(()->new VacademyException("Institute not found"));
        LearnerInvitationFormDTO learnerInvitationFormDTO = new LearnerInvitationFormDTO();
        learnerInvitationFormDTO.setLearnerInvitation(learnerInvitation.mapToDTO());
        learnerInvitationFormDTO.setInstituteName(institute.getInstituteName());
        learnerInvitationFormDTO.setInstituteLogoFileId(institute.getLogoFileId());
        return learnerInvitationFormDTO;
    }

    public Page<OneLearnerInvitationResponse> getLearnerInvitationResponses(LearnerInvitationResponsesFilterDTO filterDTO, String instituteId, int pageNo, int pageSize, CustomUserDetails user) {
        Pageable pageable = PageRequest.of(pageNo, pageSize);
        Page<LearnerInvitationResponse> learnerInvitationResponses = learnerInvitationResponseRepository.findByInstituteIdAndStatusWithCustomFields(instituteId,filterDTO.getStatus(),List.of(CustomFieldStatusEnum.ACTIVE.name()),pageable);
        return learnerInvitationResponses.map(LearnerInvitationResponse::mapToOneLearnerInvitationResponse);
    }

    @Transactional
    public String updateLearnerInvitationResponseStatus(LearnerInvitationRequestStatusChangeDTO statusChangeDTO, CustomUserDetails user){
        if (Objects.isNull(statusChangeDTO) || Objects.isNull(statusChangeDTO.getLearnerInvitationResponseIds()) || statusChangeDTO.getLearnerInvitationResponseIds().isEmpty() || !StringUtils.hasText(statusChangeDTO.getStatus())){
            throw new VacademyException("Invalid request!!!");
        }
        List<LearnerInvitationResponse>responses = learnerInvitationResponseRepository.findAllById(statusChangeDTO.getLearnerInvitationResponseIds());
        List<String>emails = new ArrayList();
        for (LearnerInvitationResponse response : responses) {
            response.setStatus(statusChangeDTO.getStatus());
            response.setMessageByInstitute(statusChangeDTO.getDescription());
            emails.add(response.getEmail());
        }
        learnerInvitationResponseRepository.saveAll(responses);
        if (responses.size() > 0){
            sendStatusUpdateMail(emails,responses.get(0).getInstituteId());
        }
        return "Status updated successfully!!!";
    }

    private void sendStatusUpdateMail(List<String>emails,String instituteId){
        Institute institute = instituteRepository.findById(instituteId).orElseThrow(()->new VacademyException("Institute not found"));
        notification.sendStatusUpdateNotification(emails,institute.getInstituteName(),instituteId);
    }
}
