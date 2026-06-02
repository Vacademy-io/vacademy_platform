package vacademy.io.admin_core_service.features.notification_service.service;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Component;
import org.springframework.util.StringUtils;
import vacademy.io.admin_core_service.features.institute_learner.entity.Student;
import vacademy.io.admin_core_service.features.institute_learner.repository.InstituteStudentRepository;
import vacademy.io.admin_core_service.features.notification.dto.NotificationToUserDTO;
import vacademy.io.common.notification.dto.AttachmentUsersDTO;

import java.util.HashMap;
import java.util.List;
import java.util.Optional;

@Slf4j
@Component
@RequiredArgsConstructor
public class BillingContactRecipientResolver {

    private final InstituteStudentRepository instituteStudentRepository;

    public Optional<NotificationToUserDTO> buildBillingContactRecipient(
            String userId,
            String instituteId,
            String primaryEmail) {
        String billingEmail = resolveBillingEmail(userId, instituteId, primaryEmail);
        if (billingEmail == null) {
            return Optional.empty();
        }

        NotificationToUserDTO billingRecipient = new NotificationToUserDTO();
        billingRecipient.setUserId(userId);
        billingRecipient.setChannelId(billingEmail);
        billingRecipient.setPlaceholders(new HashMap<>());
        return Optional.of(billingRecipient);
    }

    /**
     * Same lookup, returning an {@link AttachmentUsersDTO} so the same PDF (or
     * other) attachment payload that goes to the learner is delivered to the
     * billing contact as well. Pass the primary recipient's attachments list
     * so we attach the exact same files — typically the invoice PDF.
     */
    public Optional<AttachmentUsersDTO> buildBillingContactAttachmentRecipient(
            String userId,
            String instituteId,
            String primaryEmail,
            List<AttachmentUsersDTO.AttachmentDTO> attachments) {
        String billingEmail = resolveBillingEmail(userId, instituteId, primaryEmail);
        if (billingEmail == null) {
            return Optional.empty();
        }

        AttachmentUsersDTO billingRecipient = new AttachmentUsersDTO();
        billingRecipient.setUserId(userId);
        billingRecipient.setChannelId(billingEmail);
        billingRecipient.setPlaceholders(new HashMap<>());
        billingRecipient.setAttachments(attachments);
        return Optional.of(billingRecipient);
    }

    private String resolveBillingEmail(String userId, String instituteId, String primaryEmail) {
        if (!StringUtils.hasText(userId) || !StringUtils.hasText(instituteId)) {
            return null;
        }

        List<Student> students = instituteStudentRepository.findByUserIdAndInstituteId(userId, instituteId);
        if (students == null || students.isEmpty()) {
            return null;
        }

        String billingEmail = students.stream()
                .map(Student::getBillingContactEmail)
                .filter(StringUtils::hasText)
                .findFirst()
                .orElse(null);

        if (billingEmail == null) {
            return null;
        }

        if (StringUtils.hasText(primaryEmail) && billingEmail.equalsIgnoreCase(primaryEmail)) {
            return null;
        }

        return billingEmail;
    }
}
