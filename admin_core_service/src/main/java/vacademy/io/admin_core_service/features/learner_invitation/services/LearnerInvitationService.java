package vacademy.io.admin_core_service.features.learner_invitation.services;

import jakarta.transaction.Transactional;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;
import org.springframework.stereotype.Service;
import org.springframework.util.StringUtils;
import vacademy.io.admin_core_service.features.institute.repository.InstituteRepository;
import vacademy.io.admin_core_service.features.learner_invitation.dto.InvitationDetailProjection;
import vacademy.io.admin_core_service.features.learner_invitation.dto.LearnerInvitationDTO;
import vacademy.io.admin_core_service.features.learner_invitation.dto.LearnerInvitationDetailFilterDTO;
import vacademy.io.admin_core_service.features.learner_invitation.entity.LearnerInvitation;
import vacademy.io.admin_core_service.features.learner_invitation.enums.LearnerInvitationResponseStatusEnum;
import vacademy.io.admin_core_service.features.learner_invitation.notification.LearnerInvitationNotification;
import vacademy.io.admin_core_service.features.learner_invitation.repository.LearnerInvitationRepository;
import vacademy.io.admin_core_service.features.learner_invitation.repository.LearnerInvitationCustomFieldRepository;
import vacademy.io.common.auth.model.CustomUserDetails;
import vacademy.io.common.exceptions.VacademyException;
import vacademy.io.common.institute.entity.Institute;

import java.security.SecureRandom;
import java.util.List;
import java.util.Objects;

@Service
public class LearnerInvitationService {

    @Autowired
    private LearnerInvitationCustomFieldRepository learnerInvitationCustomFieldRepository;

    @Autowired
    private LearnerInvitationRepository learnerInvitationRepository;

    @Autowired
    private InstituteRepository instituteRepository;

    @Autowired
    private LearnerInvitationNotification notification;

    @Transactional
    public String createLearnerInvitationCode(LearnerInvitationDTO learnerInvitationDTO, CustomUserDetails user) {
        validateRequest(learnerInvitationDTO);
        learnerInvitationDTO.setInviteCode(generateInviteCode());

        LearnerInvitation learnerInvitation = new LearnerInvitation(learnerInvitationDTO);
        learnerInvitation = learnerInvitationRepository.save(learnerInvitation);

        Institute institute = instituteRepository.findById(learnerInvitationDTO.getInstituteId())
                .orElseThrow(() -> new VacademyException("Institute not found with ID: " + learnerInvitationDTO.getInstituteId()));

        List<String> emails = learnerInvitationDTO.getEmailsToSendInvitation();
        if (emails != null && !emails.isEmpty()) {
            sendLearnerInvitationNotificationAsync(emails, institute.getInstituteName(), learnerInvitationDTO.getInviteCode());
        }

        return learnerInvitation.getId();
    }

    public void sendLearnerInvitationNotificationAsync(List<String> emails, String instituteName, String invitationCode) {
        notification.sendLearnerInvitationNotification(emails, instituteName, invitationCode);
    }

    private void validateRequest(LearnerInvitationDTO learnerInvitationDTO) {
        if (Objects.isNull(learnerInvitationDTO)) {
            throw new VacademyException("Invalid request: Learner invitation data is missing.");
        }
        if (!StringUtils.hasText(learnerInvitationDTO.getName())) {
            throw new VacademyException("Invalid request: Name cannot be null or empty.");
        }
        if (!StringUtils.hasText(learnerInvitationDTO.getStatus())) {
            throw new VacademyException("Invalid request: Status cannot be null or empty.");
        }
        if (!StringUtils.hasText(learnerInvitationDTO.getInstituteId())) {
            throw new VacademyException("Invalid request: Institute ID cannot be null or empty.");
        }
        if (Objects.isNull(learnerInvitationDTO.getExpiryDate())) {
            throw new VacademyException("Invalid request: Expiry Date cannot be null.");
        }
    }

    private String generateInviteCode() {
        String chars = "ABC0D1E2F3G4H5I6JK7L8M9NOPQR0STUVWXYZ";
        SecureRandom random = new SecureRandom();
        StringBuilder inviteCode = new StringBuilder(5);

        for (int i = 0; i < 5; i++) {
            inviteCode.append(chars.charAt(random.nextInt(chars.length())));
        }

        return inviteCode.toString();
    }

    public Page<InvitationDetailProjection> getInvitationDetails(String instituteId, LearnerInvitationDetailFilterDTO filter, int pageNo, int pageSize, CustomUserDetails user) {
        Pageable pageable = PageRequest.of(pageNo, pageSize);
        if (StringUtils.hasText(filter.getName())){
            return learnerInvitationRepository.findInvitationsWithAcceptedCountByName(instituteId,
                    filter.getStatus(),
                    List.of(LearnerInvitationResponseStatusEnum.ACTIVE.name(),
                            LearnerInvitationResponseStatusEnum.ACCEPTED.name()),
                    filter.getName(),pageable);
        }
        return learnerInvitationRepository.findInvitationsWithAcceptedCount(
               instituteId, filter.getStatus(),
               List.of(LearnerInvitationResponseStatusEnum.ACTIVE.name(),
                       LearnerInvitationResponseStatusEnum.ACCEPTED.name()),
               pageable);
    }
}
