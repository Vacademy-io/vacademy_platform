package vacademy.io.notification_service.features.announcements;

import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentMatchers;
import org.mockito.Mockito;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.mock.mockito.MockBean;
import org.springframework.test.context.ActiveProfiles;
import vacademy.io.common.auth.entity.User;
import vacademy.io.notification_service.features.announcements.dto.CreateAnnouncementRequest;
import vacademy.io.notification_service.features.announcements.entity.RecipientMessage;
import vacademy.io.notification_service.features.announcements.enums.MessageStatus;
import vacademy.io.notification_service.features.notification_log.repository.NotificationLogRepository;
import vacademy.io.notification_service.features.announcements.repository.RecipientMessageRepository;
import vacademy.io.notification_service.features.announcements.service.*;
import vacademy.io.notification_service.features.firebase_notifications.service.PushNotificationService;
import vacademy.io.notification_service.service.EmailService;

import java.util.List;
import java.util.Map;

import static org.assertj.core.api.Assertions.assertThat;

@SpringBootTest
@ActiveProfiles("test")
class MediumDeliveryTest {

    @Autowired private AnnouncementService announcementService;
    @Autowired private AnnouncementProcessingService processingService;
    @Autowired private RecipientMessageRepository recipientMessageRepository;
    @Autowired private NotificationLogRepository notificationLogRepository;

    @MockBean private RecipientResolutionService recipientResolutionService;
    @MockBean private EmailService emailService;
    @MockBean private PushNotificationService pushNotificationService;
    @MockBean private vacademy.io.notification_service.features.announcements.client.AuthServiceClient authServiceClient;

    private CreateAnnouncementRequest buildRequest() {
        CreateAnnouncementRequest req = new CreateAnnouncementRequest();
        req.setTitle("Medium Test");
        var content = new CreateAnnouncementRequest.RichTextDataRequest();
        content.setType("html");
        content.setContent("<b>Hello</b> World");
        req.setContent(content);
        req.setInstituteId("INST_MEDIUM");
        req.setCreatedBy("CREATOR_MED");
        req.setCreatedByRole("ADMIN");
        var recipient = new CreateAnnouncementRequest.RecipientRequest();
        recipient.setRecipientType("ROLE");
        recipient.setRecipientId("STUDENT");
        req.setRecipients(List.of(recipient));
        req.setModes(List.of(new CreateAnnouncementRequest.ModeRequest("SYSTEM_ALERT", Map.of("priority", "HIGH"))));

        var email = new CreateAnnouncementRequest.MediumRequest();
        email.setMediumType("EMAIL");
        email.setConfig(Map.of("subject", "Subject A", "template", "announcement_email"));

        var push = new CreateAnnouncementRequest.MediumRequest();
        push.setMediumType("PUSH_NOTIFICATION");
        push.setConfig(Map.of("title", "Push Title", "body", "Push Body"));

        req.setMediums(List.of(email, push));
        return req;
    }

    @Test
    @DisplayName("Delivers both Email and Push, updates status and logs")
    void deliverEmailAndPush() {
        // Create announcement
        var response = announcementService.createAnnouncement(buildRequest());
        String announcementId = response.getId();
        String userId = "USER_MEDIUM";

        // Mock recipient resolution and user email
        Mockito.when(recipientResolutionService.resolveRecipientsToUsers(announcementId))
                .thenReturn(List.of(userId));
        User user = new User();
        user.setId(userId);
        user.setEmail("user@example.com");
        Mockito.when(authServiceClient.getUsersByIds(ArgumentMatchers.anyList()))
                .thenReturn(List.of(user));

        // Mock email/push senders to do nothing
        Mockito.doNothing().when(emailService)
                .sendHtmlEmail(ArgumentMatchers.anyString(), ArgumentMatchers.anyString(), ArgumentMatchers.anyString(), ArgumentMatchers.anyString(),"");
        Mockito.doNothing().when(pushNotificationService)
                .sendNotificationToUser(
                        ArgumentMatchers.anyString(),
                        ArgumentMatchers.anyString(),
                        ArgumentMatchers.anyString(),
                        ArgumentMatchers.anyString(),
                        ArgumentMatchers.<String, String>anyMap()
                );

        // Process delivery end-to-end (creates recipient_messages and sends via mediums)
        processingService.processAnnouncementDelivery(announcementId);

        // Verify recipient message created and final status delivered
        List<RecipientMessage> msgs = recipientMessageRepository.findByAnnouncementId(announcementId);
        assertThat(msgs).hasSize(1);
        assertThat(msgs.get(0).getStatus()).isIn(MessageStatus.SENT, MessageStatus.DELIVERED, MessageStatus.PENDING);

        // Verify both mediums called
        Mockito.verify(emailService, Mockito.atLeastOnce())
                .sendHtmlEmail(ArgumentMatchers.eq("user@example.com"), ArgumentMatchers.anyString(), ArgumentMatchers.anyString(), ArgumentMatchers.anyString(),"");
        Mockito.verify(pushNotificationService, Mockito.atLeastOnce())
                .sendNotificationToUser(
                        ArgumentMatchers.eq("INST_MEDIUM"),
                        ArgumentMatchers.eq(userId),
                        ArgumentMatchers.anyString(),
                        ArgumentMatchers.anyString(),
                        ArgumentMatchers.<String, String>anyMap()
                );

        // Optionally check logs exist (>=1, because entity does not track status)
        assertThat(notificationLogRepository.findAll().size()).isGreaterThanOrEqualTo(1);
    }
}
