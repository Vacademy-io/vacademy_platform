package vacademy.io.assessment_service.features.notification.dto.unified;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.util.List;
import java.util.Map;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class UnifiedSendRequest {
    private String instituteId;
    private String channel;
    private String templateName;
    private List<Recipient> recipients;
    private SendOptions options;

    @Data
    @Builder
    @NoArgsConstructor
    @AllArgsConstructor
    public static class Recipient {
        private String email;
        private String userId;
        private Map<String, String> variables;
        private List<Attachment> attachments;
    }

    @Data
    @Builder
    @NoArgsConstructor
    @AllArgsConstructor
    public static class Attachment {
        private String filename;
        private String contentBase64;
    }

    @Data
    @Builder
    @NoArgsConstructor
    @AllArgsConstructor
    public static class SendOptions {
        private String emailSubject;
        private String emailBody;
        private String emailType;
        private String source;
        private String sourceId;
    }
}
