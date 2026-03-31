package vacademy.io.notification_service.features.events.service;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import vacademy.io.notification_service.features.events.dto.NotificationEventRequest;
import vacademy.io.notification_service.features.events.dto.NotificationEventResponse;
import vacademy.io.notification_service.features.send.dto.UnifiedSendRequest;
import vacademy.io.notification_service.features.send.dto.UnifiedSendResponse;
import vacademy.io.notification_service.features.send.service.UnifiedSendService;

import java.util.ArrayList;
import java.util.List;
import java.util.stream.Collectors;

/**
 * Processes notification events by converting each EventSend to a UnifiedSendRequest
 * and delegating to UnifiedSendService.
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class EventProcessorService {

    private final UnifiedSendService unifiedSendService;

    public NotificationEventResponse processEvent(NotificationEventRequest event) {
        log.info("Processing notification event: type={}, institute={}, sends={}",
                event.getEventType(), event.getInstituteId(),
                event.getSends() != null ? event.getSends().size() : 0);

        List<UnifiedSendResponse> sendResults = new ArrayList<>();
        int completed = 0;
        int failed = 0;

        if (event.getSends() == null || event.getSends().isEmpty()) {
            log.info("No sends configured for event {}", event.getEventType());
            return NotificationEventResponse.builder()
                    .eventType(event.getEventType())
                    .totalSends(0).completedSends(0).failedSends(0)
                    .sendResults(List.of())
                    .build();
        }

        for (NotificationEventRequest.EventSend send : event.getSends()) {
            try {
                UnifiedSendRequest request = convertToUnifiedRequest(event, send);
                UnifiedSendResponse response = unifiedSendService.send(request);
                sendResults.add(response);

                if ("COMPLETED".equals(response.getStatus())) {
                    completed++;
                } else if ("FAILED".equals(response.getStatus())) {
                    failed++;
                } else {
                    completed++; // PROCESSING or PARTIAL count as completed (accepted)
                }
            } catch (Exception e) {
                log.error("Failed to process event send: channel={}, template={}, error={}",
                        send.getChannel(), send.getTemplateName(), e.getMessage());
                failed++;
                sendResults.add(UnifiedSendResponse.builder()
                        .total(send.getRecipients() != null ? send.getRecipients().size() : 0)
                        .accepted(0).failed(send.getRecipients() != null ? send.getRecipients().size() : 0)
                        .status("FAILED")
                        .build());
            }
        }

        return NotificationEventResponse.builder()
                .eventType(event.getEventType())
                .totalSends(event.getSends().size())
                .completedSends(completed)
                .failedSends(failed)
                .sendResults(sendResults)
                .build();
    }

    private UnifiedSendRequest convertToUnifiedRequest(
            NotificationEventRequest event, NotificationEventRequest.EventSend send) {

        List<UnifiedSendRequest.Recipient> recipients = (send.getRecipients() != null ? send.getRecipients() : List.<NotificationEventRequest.EventRecipient>of()).stream()
                .map(r -> UnifiedSendRequest.Recipient.builder()
                        .phone(r.getPhone())
                        .email(r.getEmail())
                        .userId(r.getUserId())
                        .name(r.getName())
                        .variables(r.getVariables())
                        .build())
                .collect(Collectors.toList());

        UnifiedSendRequest.SendOptions options = UnifiedSendRequest.SendOptions.builder()
                .emailSubject(send.getEmailSubject())
                .emailBody(send.getEmailBody())
                .emailType(send.getEmailType())
                .headerType(send.getHeaderType())
                .headerUrl(send.getHeaderUrl())
                .source("event:" + event.getEventType())
                .sourceId(event.getSourceId())
                .build();

        return UnifiedSendRequest.builder()
                .instituteId(event.getInstituteId())
                .channel(send.getChannel())
                .templateName(send.getTemplateName())
                .languageCode(send.getLanguageCode() != null ? send.getLanguageCode() : "en")
                .recipients(recipients)
                .options(options)
                .build();
    }
}
