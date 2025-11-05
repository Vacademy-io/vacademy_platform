package vacademy.io.notification_service.controller;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import vacademy.io.common.notification.dto.AttachmentNotificationDTO;
import vacademy.io.common.notification.dto.GenericEmailRequest;
import vacademy.io.notification_service.dto.EmailRequest;
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
    public ResponseEntity<Boolean> sendEmail(@RequestBody GenericEmailRequest request,@RequestParam(name = "instituteId" , required = false)String instituteId) {
        return ResponseEntity.ok(inviteNewUserService.sendEmail(request.getTo(), request.getSubject(), request.getService(), request.getBody(),instituteId));
    }

    @PostMapping("/send-email-to-users")
    public ResponseEntity<String> sendEmailsToUsers(@RequestBody NotificationDTO emailToUsersDTO,@RequestParam(name = "instituteId" , required = false)String instituteId) {
        return ResponseEntity.ok(notificationService.sendNotification(emailToUsersDTO,instituteId));
    }

    @PostMapping("/send-attachment-notification")
    public ResponseEntity<Boolean> sendEmailsToUsers(@RequestBody List<AttachmentNotificationDTO> emailToUsersDTOs,@RequestParam(name = "instituteId" , required = false)String instituteId) {
        return ResponseEntity.ok(notificationService.sendAttachmentNotification(emailToUsersDTOs,instituteId));
    }

    @PostMapping("/send-email-to-users/multiple")
    public ResponseEntity<String> sendEmailsToUsersMultiple(@RequestBody List<NotificationDTO> emailToUsersDTO,@RequestParam(name = "instituteId" , required = false)String instituteId) {
        for (NotificationDTO notificationDTO:emailToUsersDTO){
            notificationService.sendNotification(notificationDTO,instituteId);
        }
        return ResponseEntity.ok("done!!!");
    }

}
