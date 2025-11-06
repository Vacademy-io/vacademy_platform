package vacademy.io.notification_service.service;

import com.fasterxml.jackson.databind.ObjectMapper;
import io.awspring.cloud.sqs.annotation.SqsListener;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.stereotype.Service;
import vacademy.io.notification_service.dto.SesEventDTO;

@Service
@ConditionalOnProperty(name = "aws.sqs.enabled", havingValue = "true", matchIfMissing = false)
public class SqsEmailEventListener {

    private static final Logger log = LoggerFactory.getLogger(SqsEmailEventListener.class);

    @Autowired
    private EmailEventService emailEventService;
    
    @Autowired
    private ObjectMapper objectMapper;

    @SqsListener("vacademy-ses-events")
    public void handleSesEvent(String message) {
        try {
            // Reduced logging: Changed from INFO to DEBUG to prevent log flooding
            // With 50 emails/second, this would generate 50+ log lines per second
            log.debug("Received SQS message for SES events");
            
            // Parse the message directly as SES event (no SNS wrapper)
            SesEventDTO sesEvent = objectMapper.readValue(message, SesEventDTO.class);
            
            log.debug("Processing SES event: {} for message ID: {}", 
                sesEvent.getEventType(), 
                sesEvent.getMail() != null ? sesEvent.getMail().getMessageId() : "unknown");
            
            // Process the email event
            emailEventService.processEmailEvent(sesEvent);
            
            log.debug("Successfully processed SES event: {}", sesEvent.getEventType());
            
        } catch (Exception e) {
            log.error("Error processing SQS message for SES events: {}", e.getMessage(), e);
            // In a production environment, you might want to send this to a DLQ
            // or implement retry logic
        }
    }
}
