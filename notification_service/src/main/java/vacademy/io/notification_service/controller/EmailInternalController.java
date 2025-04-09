package vacademy.io.notification_service.controller;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;
import vacademy.io.common.notification.dto.AttachmentNotificationDTO;
import vacademy.io.common.notification.dto.GenericEmailRequest;
import vacademy.io.notification_service.dto.NotificationDTO;
import vacademy.io.notification_service.features.email_otp.service.InviteNewUserService;
import vacademy.io.notification_service.service.NotificationService;

import java.util.List;

@RestController
@RequestMapping("notification-service/internal/common/v1")
public class EmailInternalController {

    @Autowired
    private InviteNewUserService inviteNewUserService;

    @Autowired
    private NotificationService notificationService;

    @PostMapping("/send-html-email")
    public ResponseEntity<Boolean> sendEmail(@RequestBody GenericEmailRequest request) {
        return ResponseEntity.ok(inviteNewUserService.sendEmail(request.getTo(), request.getSubject(), request.getService(), request.getBody()));
    }

    @PostMapping("/send-email-to-users")
    public ResponseEntity<String> sendEmailsToUsers(@RequestBody NotificationDTO emailToUsersDTO) {
        return ResponseEntity.ok(notificationService.sendNotification(emailToUsersDTO));
    }

    @PostMapping("/send-attachment-notification")
    public ResponseEntity<Boolean> sendEmailsToUsers(@RequestBody List<AttachmentNotificationDTO> emailToUsersDTOs) {
        return ResponseEntity.ok(notificationService.sendAttachmentNotification(emailToUsersDTOs));
    }
}