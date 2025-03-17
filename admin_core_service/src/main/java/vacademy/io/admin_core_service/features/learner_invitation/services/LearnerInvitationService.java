package vacademy.io.admin_core_service.features.learner_invitation.services;

import jakarta.transaction.Transactional;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.scheduling.annotation.Async;
import org.springframework.stereotype.Service;
import org.springframework.util.StringUtils;
import vacademy.io.admin_core_service.features.institute.repository.InstituteRepository;
import vacademy.io.admin_core_service.features.learner_invitation.dto.LearnerInvitationCodeDTO;
import vacademy.io.admin_core_service.features.learner_invitation.entity.LearnerInvitation;
import vacademy.io.admin_core_service.features.learner_invitation.notification.LearnerInvitationNotification;
import vacademy.io.admin_core_service.features.learner_invitation.repository.LearnerInvitationRepository;
import vacademy.io.admin_core_service.features.learner_invitation.repository.LearnerInvitationCustomFieldRepository;
import vacademy.io.common.exceptions.VacademyException;
import vacademy.io.common.institute.entity.Institute;

import java.security.SecureRandom;
import java.util.List;
import java.util.Objects;
import java.util.concurrent.CompletableFuture;

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
    public String createLearnerInvitationCode(LearnerInvitationCodeDTO learnerInvitationCodeDTO) {
        validateRequest(learnerInvitationCodeDTO);
        learnerInvitationCodeDTO.setInviteCode(generateInviteCode());

        LearnerInvitation learnerInvitation = new LearnerInvitation(learnerInvitationCodeDTO);
        learnerInvitation = learnerInvitationRepository.save(learnerInvitation);

        Institute institute = instituteRepository.findById(learnerInvitationCodeDTO.getInstituteId())
                .orElseThrow(() -> new VacademyException("Institute not found with ID: " + learnerInvitationCodeDTO.getInstituteId()));

        List<String> emails = learnerInvitationCodeDTO.getEmailsToSendInvitation();
        if (emails != null && !emails.isEmpty()) {
            sendLearnerInvitationNotificationAsync(emails, institute.getInstituteName(), learnerInvitationCodeDTO.getInviteCode());
        }

        return learnerInvitation.getId();
    }

    public void sendLearnerInvitationNotificationAsync(List<String> emails, String instituteName, String invitationCode) {
        notification.sendLearnerInvitationNotification(emails, instituteName, invitationCode);
    }

    private void validateRequest(LearnerInvitationCodeDTO learnerInvitationCodeDTO) {
        if (Objects.isNull(learnerInvitationCodeDTO)) {
            throw new VacademyException("Invalid request: Learner invitation data is missing.");
        }
        if (!StringUtils.hasText(learnerInvitationCodeDTO.getName())) {
            throw new VacademyException("Invalid request: Name cannot be null or empty.");
        }
        if (!StringUtils.hasText(learnerInvitationCodeDTO.getStatus())) {
            throw new VacademyException("Invalid request: Status cannot be null or empty.");
        }
        if (!StringUtils.hasText(learnerInvitationCodeDTO.getInstituteId())) {
            throw new VacademyException("Invalid request: Institute ID cannot be null or empty.");
        }
        if (Objects.isNull(learnerInvitationCodeDTO.getExpiryDate())) {
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
}
