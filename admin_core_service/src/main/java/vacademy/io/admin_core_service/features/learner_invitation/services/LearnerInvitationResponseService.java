package vacademy.io.admin_core_service.features.learner_invitation.services;

import jakarta.transaction.Transactional;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;
import org.springframework.util.StringUtils;
import vacademy.io.admin_core_service.features.institute.repository.InstituteRepository;
import vacademy.io.admin_core_service.features.learner_invitation.dto.LearnerInvitationCustomFieldResponseDTO;
import vacademy.io.admin_core_service.features.learner_invitation.dto.LearnerInvitationResponseDTO;
import vacademy.io.admin_core_service.features.learner_invitation.entity.LearnerInvitation;
import vacademy.io.admin_core_service.features.learner_invitation.entity.LearnerInvitationCustomFieldResponse;
import vacademy.io.admin_core_service.features.learner_invitation.entity.LearnerInvitationResponse;
import vacademy.io.admin_core_service.features.learner_invitation.enums.LearnerInvitationResponseStatusEnum;
import vacademy.io.admin_core_service.features.learner_invitation.notification.LearnerInvitationNotification;
import vacademy.io.admin_core_service.features.learner_invitation.repository.LearnerInvitationCustomFieldRepository;
import vacademy.io.admin_core_service.features.learner_invitation.repository.LearnerInvitationCustomFieldResponseRepository;
import vacademy.io.admin_core_service.features.learner_invitation.repository.LearnerInvitationRepository;
import vacademy.io.admin_core_service.features.learner_invitation.repository.LearnerInvitationResponseRepository;
import vacademy.io.common.exceptions.VacademyException;
import vacademy.io.common.institute.entity.Institute;

import java.util.ArrayList;
import java.util.List;
import java.util.Objects;
import java.util.Optional;

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

    // This should run asycn
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
}
