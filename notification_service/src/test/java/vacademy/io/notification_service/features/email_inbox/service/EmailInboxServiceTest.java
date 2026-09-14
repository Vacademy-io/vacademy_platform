package vacademy.io.notification_service.features.email_inbox.service;

import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import vacademy.io.notification_service.features.announcements.service.EmailConfigurationService;
import vacademy.io.notification_service.features.email_inbox.dto.EmailConversationDTO;
import vacademy.io.notification_service.features.email_inbox.dto.EmailMessageDTO;
import vacademy.io.notification_service.features.notification_log.entity.NotificationLog;
import vacademy.io.notification_service.features.notification_log.repository.EmailAddressMappingRepository;
import vacademy.io.notification_service.features.notification_log.repository.NotificationLogRepository;
import vacademy.io.notification_service.features.send.service.UnifiedSendService;

import java.time.Instant;
import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyInt;
import static org.mockito.ArgumentMatchers.anyList;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.ArgumentMatchers.isNull;
import static org.mockito.Mockito.when;

/**
 * The shapes the Email Inbox UI renders, built from real prod row patterns
 * (institute ca3c4734-..., counterparty shreyash@vidyayatan.com).
 */
@ExtendWith(MockitoExtension.class)
class EmailInboxServiceTest {

    private static final String INSTITUTE = "ca3c4734-7913-48a8-b116-f8f7e0c60eba";
    private static final String COUNTERPARTY = "shreyash@vidyayatan.com";
    private static final String INSTITUTE_ADDRESS = "hello@vidyayatan.com";
    private static final String TITLE = "shreyash@vidyayatan.com";
    private static final String PARENT_LOG_ID = "F9E8AD65-A66F-4A53-A97B-E855B48ABD26";
    private static final Instant T0 = Instant.parse("2026-09-14T07:34:00Z");

    @Mock NotificationLogRepository notificationLogRepository;
    @Mock EmailAddressMappingRepository emailAddressMappingRepository;
    @Mock EmailConfigurationService emailConfigurationService;
    @Mock UnifiedSendService unifiedSendService;

    private EmailInboxService service;

    @BeforeEach
    void setUp() {
        service = new EmailInboxService(notificationLogRepository, emailAddressMappingRepository,
                emailConfigurationService, unifiedSendService, new ObjectMapper());
    }

    private static NotificationLog row(String id, String type, String counterparty, String source, String body, Instant at) {
        NotificationLog nl = new NotificationLog();
        nl.setId(id);
        nl.setNotificationType(type);
        nl.setChannelId(counterparty);
        nl.setSource(source);
        nl.setBody(body);
        nl.setNotificationDate(at);
        nl.setSenderBusinessChannelId(INSTITUTE_ADDRESS);
        nl.setInstituteId(INSTITUTE);
        return nl;
    }

    private void stubMessages(String counterparty, List<NotificationLog> rows) {
        when(notificationLogRepository.findEmailMessagesForConversation(
                eq(counterparty), eq(INSTITUTE), isNull(), anyList(), isNull(), anyInt()))
                .thenReturn(rows);
    }

    private List<EmailMessageDTO> messages(String counterparty) {
        return service.getMessages(INSTITUTE, counterparty, null, 50, null, null);
    }

    @Test
    @DisplayName("announcement twin pair renders as ONE outgoing campaign card with the title as subject")
    void twinPairIsOneCampaignMessage() {
        NotificationLog unified = row("u1", "EMAIL", COUNTERPARTY, "unified-send",
                "<html><body><div style=\"display:none\">96 shreyash@vidyayatan.com&#847; &#8199; &#65279; &#847;</div>"
                        + "<p>Hello there</p></body></html>", T0.plusSeconds(2));
        NotificationLog announcement = row("a1", "EMAIL", COUNTERPARTY, "announcement-service", TITLE, T0);
        stubMessages(COUNTERPARTY, List.of(unified, announcement));

        List<EmailMessageDTO> out = messages(COUNTERPARTY);

        assertThat(out).hasSize(1);
        EmailMessageDTO m = out.get(0);
        assertThat(m.getId()).isEqualTo("u1");
        assertThat(m.getDirection()).isEqualTo("OUTGOING");
        assertThat(m.getOrigin()).isEqualTo("CAMPAIGN");
        assertThat(m.getSubject()).isEqualTo(TITLE);
        assertThat(m.getBody()).startsWith("<html>");
        assertThat(m.getBodyPreview()).isEqualTo("Hello there");
        assertThat(m.isSystem()).isFalse();
        assertThat(m.getInReplyToId()).isNull();
        assertThat(m.getSource()).isEqualTo("unified-send");
    }

    @Test
    void payloadSubjectWinsOverMergedTitle() {
        NotificationLog unified = row("u1", "EMAIL", COUNTERPARTY, "unified-send", "<p>Hi</p>", T0.plusSeconds(1));
        unified.setMessagePayload("{\"subject\":\"Batch starts Monday\"}");
        stubMessages(COUNTERPARTY, List.of(unified, row("a1", "EMAIL", COUNTERPARTY, "announcement-service", TITLE, T0)));

        List<EmailMessageDTO> out = messages(COUNTERPARTY);

        assertThat(out).hasSize(1);
        assertThat(out.get(0).getSubject()).isEqualTo("Batch starts Monday");
        assertThat(out.get(0).getOrigin()).isEqualTo("CAMPAIGN");
    }

    @Test
    void loneAnnouncementRowUsesItsBodyAsSubjectAndDropsBody() {
        stubMessages(COUNTERPARTY, List.of(row("a1", "EMAIL", COUNTERPARTY, "announcement-service", TITLE, T0)));

        List<EmailMessageDTO> out = messages(COUNTERPARTY);

        assertThat(out).hasSize(1);
        assertThat(out.get(0).getSubject()).isEqualTo(TITLE);
        assertThat(out.get(0).getBody()).isNull();
        assertThat(out.get(0).getBodyPreview()).isEqualTo(TITLE);
        assertThat(out.get(0).getOrigin()).isEqualTo("CAMPAIGN");
    }

    @Test
    @DisplayName("mailer-daemon bounce is INCOMING / BOUNCE / system")
    void bounceRow() {
        String daemon = "mailer-daemon@ap-south-1.amazonses.com";
        NotificationLog bounce = row("b1", "INBOUND_EMAIL", daemon, PARENT_LOG_ID,
                "Delivery Status Notification (Failure)", T0);
        bounce.setMessagePayload("{\"subject\":\"Delivery Status Notification (Failure)\",\"from\":\"" + daemon
                + "\",\"to\":\"" + INSTITUTE_ADDRESS + "\",\"body\":\"An error occurred while trying to deliver\",\"instituteId\":\""
                + INSTITUTE + "\"}");
        stubMessages(daemon, List.of(bounce));

        List<EmailMessageDTO> out = messages(daemon);

        assertThat(out).hasSize(1);
        EmailMessageDTO m = out.get(0);
        assertThat(m.getDirection()).isEqualTo("INCOMING");
        assertThat(m.getOrigin()).isEqualTo("BOUNCE");
        assertThat(m.isSystem()).isTrue();
        assertThat(m.getInReplyToId()).isEqualTo(PARENT_LOG_ID);
        assertThat(m.getSource()).isNull();
        assertThat(m.getBody()).isEqualTo("An error occurred while trying to deliver");
    }

    @Test
    @DisplayName("inbound reply linked to an outbound log: origin REPLY, UUID moves from source to inReplyToId")
    void inboundReplyRow() {
        NotificationLog reply = row("r1", "INBOUND_EMAIL", COUNTERPARTY, PARENT_LOG_ID, "Re: hello neeraj", T0);
        reply.setSenderName("Shreyash Jain");
        reply.setMessagePayload("{\"subject\":\"Re: hello neeraj\",\"from\":\"" + COUNTERPARTY + "\",\"to\":\""
                + INSTITUTE_ADDRESS + "\",\"body\":\"hello boss\\n\\nOn Mon wrote:\\n> hi\",\"instituteId\":\"" + INSTITUTE + "\"}");
        stubMessages(COUNTERPARTY, List.of(reply));

        List<EmailMessageDTO> out = messages(COUNTERPARTY);

        assertThat(out).hasSize(1);
        EmailMessageDTO m = out.get(0);
        assertThat(m.getDirection()).isEqualTo("INCOMING");
        assertThat(m.getOrigin()).isEqualTo("REPLY");
        assertThat(m.isSystem()).isFalse();
        assertThat(m.getSubject()).isEqualTo("Re: hello neeraj");
        assertThat(m.getInReplyToId()).isEqualTo(PARENT_LOG_ID);
        assertThat(m.getSource()).isNull();
        assertThat(m.getCounterpartyName()).isEqualTo("Shreyash Jain");
        assertThat(m.getBody()).startsWith("hello boss");
        assertThat(m.getBodyPreview()).isEqualTo("hello boss On Mon wrote: > hi");
    }

    @Test
    void unsolicitedInboundRowIsIncoming() {
        NotificationLog fresh = row("r2", "INBOUND_EMAIL", COUNTERPARTY, null, "Question", T0);
        fresh.setMessagePayload("{\"subject\":\"Question\",\"body\":\"Where is the class?\"}");
        stubMessages(COUNTERPARTY, List.of(fresh));

        EmailMessageDTO m = messages(COUNTERPARTY).get(0);

        assertThat(m.getOrigin()).isEqualTo("INCOMING");
        assertThat(m.getInReplyToId()).isNull();
        assertThat(m.getSource()).isNull();
    }

    @Test
    void otpRowIsOtp() {
        stubMessages(COUNTERPARTY, List.of(row("o1", "EMAIL", COUNTERPARTY, "OTP_SERVICE", "<p>Your OTP is 123456</p>", T0)));

        EmailMessageDTO m = messages(COUNTERPARTY).get(0);

        assertThat(m.getDirection()).isEqualTo("OUTGOING");
        assertThat(m.getOrigin()).isEqualTo("OTP");
        assertThat(m.getSubject()).isNull();
        assertThat(m.getBodyPreview()).isEqualTo("Your OTP is 123456");
    }

    @Test
    void otherOutboundOrigins() {
        NotificationLog inboxReply = row("x1", "EMAIL", COUNTERPARTY, "EMAIL_INBOX", "<p>Sure</p>", T0.plusSeconds(3));
        inboxReply.setMessagePayload("{\"subject\":\"Re: hello\"}");
        stubMessages(COUNTERPARTY, List.of(
                inboxReply,
                row("x2", "EMAIL", COUNTERPARTY, "ENGAGEMENT_ENGINE", "<p>Auto</p>", T0.plusSeconds(2)),
                row("x3", "EMAIL", COUNTERPARTY, "event:LEARNER_BATCH_ENROLLMENT", "<p>Welcome</p>", T0.plusSeconds(1)),
                row("x4", "EMAIL", COUNTERPARTY, "unified-send", "<p>Plain</p>", T0)));

        List<EmailMessageDTO> out = messages(COUNTERPARTY);

        assertThat(out).extracting(EmailMessageDTO::getOrigin)
                .containsExactly("INBOX_REPLY", "AUTOMATION", "AUTOMATION", "EMAIL");
        assertThat(out.get(0).getSubject()).isEqualTo("Re: hello");
        assertThat(out).allMatch(m -> !m.isSystem());
    }

    @Test
    @DisplayName("conversation row from a bounce is flagged system")
    void conversationFromBounceIsSystem() {
        String daemon = "mailer-daemon@ap-south-1.amazonses.com";
        NotificationLog bounce = row("b1", "INBOUND_EMAIL", daemon, PARENT_LOG_ID,
                "Delivery Status Notification (Failure)", T0);
        bounce.setMessagePayload("{\"subject\":\"Delivery Status Notification (Failure)\",\"body\":\"x\"}");
        when(notificationLogRepository.findEmailConversationsForInbox(eq(INSTITUTE), isNull(), anyList(), anyInt(), anyInt()))
                .thenReturn(List.of(bounce));
        when(notificationLogRepository.batchCountUnreadEmailMessages(any())).thenReturn(List.of());

        List<EmailConversationDTO> out = service.getConversations(INSTITUTE, 0, 30, null, null);

        assertThat(out).hasSize(1);
        assertThat(out.get(0).isSystem()).isTrue();
        assertThat(out.get(0).getLastMessageDirection()).isEqualTo("INCOMING");
        assertThat(out.get(0).getLastMessageSubject()).isEqualTo("Delivery Status Notification (Failure)");
        assertThat(out.get(0).getLastMessagePreview()).isEqualTo("Delivery Status Notification (Failure)");
    }

    @Test
    void conversationFromAnnouncementRowUsesTitleAsSubject() {
        NotificationLog announcement = row("a1", "EMAIL", COUNTERPARTY, "announcement-service", TITLE, T0);
        announcement.setSenderName("Shreyash Jain");
        when(notificationLogRepository.findEmailConversationsForInbox(eq(INSTITUTE), isNull(), anyList(), anyInt(), anyInt()))
                .thenReturn(List.of(announcement));
        when(notificationLogRepository.batchCountUnreadEmailMessages(any())).thenReturn(List.of());

        EmailConversationDTO c = service.getConversations(INSTITUTE, 0, 30, null, null).get(0);

        assertThat(c.isSystem()).isFalse();
        assertThat(c.getName()).isEqualTo("Shreyash Jain");
        assertThat(c.getLastMessageDirection()).isEqualTo("OUTGOING");
        assertThat(c.getLastMessageSubject()).isEqualTo(TITLE);
        assertThat(c.getLastMessagePreview()).isEqualTo(TITLE);
    }

    @Test
    void conversationFromHtmlRowWithoutSubjectGetsCleanPreview() {
        NotificationLog unified = row("u1", "EMAIL", COUNTERPARTY, "unified-send",
                "<div style=\"display:none\">96 x&#847; &#8199;</div><p>Hello&nbsp;there</p>", T0);
        when(notificationLogRepository.findEmailConversationsForInbox(eq(INSTITUTE), isNull(), anyList(), anyInt(), anyInt()))
                .thenReturn(List.of(unified));
        when(notificationLogRepository.batchCountUnreadEmailMessages(any())).thenReturn(List.of());

        EmailConversationDTO c = service.getConversations(INSTITUTE, 0, 30, null, null).get(0);

        assertThat(c.getLastMessageSubject()).isNull();
        assertThat(c.getLastMessagePreview()).isEqualTo("Hello there");
    }
}
