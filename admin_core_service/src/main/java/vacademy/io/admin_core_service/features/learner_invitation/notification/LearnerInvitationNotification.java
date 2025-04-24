package vacademy.io.admin_core_service.features.learner_invitation.notification;

import org.springframework.scheduling.annotation.Async;
import org.springframework.stereotype.Service;
import vacademy.io.admin_core_service.features.notification.dto.NotificationDTO;
import vacademy.io.admin_core_service.features.notification.dto.NotificationToUserDTO;
import vacademy.io.admin_core_service.features.notification.enums.CommunicationType;
import vacademy.io.admin_core_service.features.notification.service.NotificationService;
import vacademy.io.common.notification.dto.GenericEmailRequest;

import java.util.HashMap;
import java.util.List;
import java.util.concurrent.CompletableFuture;

@Service
public class LearnerInvitationNotification {

    private final NotificationService notificationService;

    public LearnerInvitationNotification(NotificationService notificationService) {
        this.notificationService = notificationService;
    }

    public void sendLearnerInvitationNotification(List<String> emails, String instituteName,String instituteId, String invitationCode) {
        CompletableFuture.runAsync(() -> {
            try {
                NotificationDTO notificationDTO = new NotificationDTO();
                notificationDTO.setNotificationType(CommunicationType.EMAIL.name());
                notificationDTO.setSubject("Invitation to join " + instituteName);
                notificationDTO.setSource("LEARNER_INVITATION");
                notificationDTO.setSourceId(invitationCode);
                notificationDTO.setBody(LearnerInvitationEmailBody.getLearnerInvitationEmailBody(instituteName,instituteId, invitationCode));

                List<NotificationToUserDTO> users = emails.stream().map(email -> {
                    NotificationToUserDTO notificationToUserDTO = new NotificationToUserDTO();
                    notificationToUserDTO.setUserId(email);
                    notificationToUserDTO.setChannelId(email);
                    notificationToUserDTO.setPlaceholders(new HashMap<>());
                    return notificationToUserDTO;
                }).toList();

                notificationDTO.setUsers(users);
                notificationService.sendEmailToUsers(notificationDTO);
            } catch (Exception e) {
                System.err.println("Error sending invitation emails: " + e.getMessage());
            }
        });
    }

    @Async
    public void sendLearnerInvitationResponseNotification(String email, String instituteName, String responseId) {
        CompletableFuture.runAsync(() -> {
            try {
                GenericEmailRequest genericEmailRequest = new GenericEmailRequest();
                genericEmailRequest.setSubject("Response recorded for " + instituteName);
                genericEmailRequest.setTo(email);
                genericEmailRequest.setBody(LearnerInvitationEmailBody.getLearnerStatusUpdateEmailBody(instituteName));
                notificationService.sendGenericHtmlMail(genericEmailRequest);
            } catch (Exception e) {
                System.err.println("Error sending invitation response email: " + e.getMessage());
            }
        });
    }

    public void sendStatusUpdateNotification(List<String> emails, String instituteName,String instituteId) {
        CompletableFuture.runAsync(() -> {
            try {
                NotificationDTO notificationDTO = new NotificationDTO();
                notificationDTO.setNotificationType(CommunicationType.EMAIL.name());
                notificationDTO.setSubject("Status updated for your request to " + instituteName);
                notificationDTO.setSource("LEARNER_INVITATION");
                notificationDTO.setSourceId(instituteId);
                notificationDTO.setBody(LearnerInvitationEmailBody.getLearnerStatusUpdateByInstituteEmailBody(instituteName));

                List<NotificationToUserDTO> users = emails.stream().map(email -> {
                    NotificationToUserDTO notificationToUserDTO = new NotificationToUserDTO();
                    notificationToUserDTO.setUserId(email);
                    notificationToUserDTO.setChannelId(email);
                    notificationToUserDTO.setPlaceholders(new HashMap<>());
                    return notificationToUserDTO;
                }).toList();

                notificationDTO.setUsers(users);
                notificationService.sendEmailToUsers(notificationDTO);
            } catch (Exception e) {
                System.err.println("Error sending invitation emails: " + e.getMessage());
            }
        });
    }
}
