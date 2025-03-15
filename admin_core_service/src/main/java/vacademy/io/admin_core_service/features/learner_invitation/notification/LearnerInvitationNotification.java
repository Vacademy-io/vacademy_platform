package vacademy.io.admin_core_service.features.learner_invitation.notification;

import vacademy.io.admin_core_service.features.notification.dto.NotificationDTO;
import vacademy.io.admin_core_service.features.notification.dto.NotificationToUserDTO;
import vacademy.io.admin_core_service.features.notification.enums.NotificationType;

import java.util.List;

public class LearnerInvitationNotification {



   public static void sendLearnerInvitationNotification(List<String>emails,String instituteName, String invitationCode) {
       NotificationDTO notificationDTO = new NotificationDTO();
       notificationDTO.setNotificationType(NotificationType.EMAIL.name());
       notificationDTO.setSubject("Invitation to join " + instituteName);
       notificationDTO.setSource("LEARNER_INVITATION");
       notificationDTO.setSourceId(invitationCode);
       notificationDTO.setBody(LearnerInvitationEmailBody.getLearnerInvitationEmailBody(instituteName, invitationCode));
       List<NotificationToUserDTO>users = emails.stream().map(email ->{
           NotificationToUserDTO notificationToUserDTO = new NotificationToUserDTO();
           notificationToUserDTO.setUserId(email);
           notificationToUserDTO.setChannelId(email);
           return notificationToUserDTO;
       }).toList();
   }
}
