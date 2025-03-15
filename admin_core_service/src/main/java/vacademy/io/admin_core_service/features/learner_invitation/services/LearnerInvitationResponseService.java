package vacademy.io.admin_core_service.features.learner_invitation.services;

import jakarta.transaction.Transactional;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;
import org.springframework.util.StringUtils;
import vacademy.io.admin_core_service.features.learner_invitation.dto.LearnerInvitationResponseDTO;
import vacademy.io.admin_core_service.features.learner_invitation.entity.LearnerInvitationResponse;
import vacademy.io.admin_core_service.features.learner_invitation.repository.LearnerInvitationResponseRepository;
import vacademy.io.common.exceptions.VacademyException;

import java.util.Objects;

@Service
public class LearnerInvitationResponseService {
    @Autowired
    private LearnerInvitationResponseRepository learnerInvitationResponseRepository;

    @Transactional
    public String registerLearnerInvitationResponse(LearnerInvitationResponseDTO learnerInvitationResponseDTO) {
        validateRequest(learnerInvitationResponseDTO);
        LearnerInvitationResponse learnerInvitationResponse = new LearnerInvitationResponse(learnerInvitationResponseDTO);
        learnerInvitationResponse = learnerInvitationResponseRepository.save(learnerInvitationResponse);
        return learnerInvitationResponse.getId();
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
    }
}
