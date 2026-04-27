package vacademy.io.notification_service.service;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import io.awspring.cloud.sqs.annotation.SqsListener;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.stereotype.Service;

import java.net.URLDecoder;
import java.nio.charset.StandardCharsets;

@Service
@ConditionalOnProperty(name = "aws.inbound.email.enabled", havingValue = "true", matchIfMissing = false)
public class SqsInboundEmailListener {

    private static final Logger log = LoggerFactory.getLogger(SqsInboundEmailListener.class);

    @Autowired
    private InboundEmailService inboundEmailService;

    @Autowired
    private ObjectMapper objectMapper;

    // Direct S3 → SQS (no SNS wrapper). Message is a standard S3 event notification JSON.
    @SqsListener(value = "${aws.inbound.sqs.queue-name}", factory = "inboundEmailContainerFactory")
    public void handleInboundEmail(String message) {
        try {
            log.debug("Received S3 event notification for inbound email");

            JsonNode root = objectMapper.readTree(message);
            JsonNode records = root.path("Records");

            if (records.isMissingNode() || !records.isArray() || records.isEmpty()) {
                log.debug("No Records in S3 event notification, skipping");
                return;
            }

            JsonNode record = records.get(0);
            String bucket = record.path("s3").path("bucket").path("name").asText();
            String key = record.path("s3").path("object").path("key").asText();

            if (bucket.isBlank() || key.isBlank()) {
                log.warn("Missing bucket or key in S3 event notification");
                return;
            }

            // S3 event notification URL-encodes the object key
            key = URLDecoder.decode(key, StandardCharsets.UTF_8);

            log.debug("Processing inbound email from S3: {}/{}", bucket, key);
            inboundEmailService.processInboundEmail(bucket, key);

        } catch (Exception e) {
            // Don't rethrow — prevents infinite SQS retry loops for malformed messages
            log.error("Error processing inbound email SQS message: {}", e.getMessage(), e);
        }
    }
}
