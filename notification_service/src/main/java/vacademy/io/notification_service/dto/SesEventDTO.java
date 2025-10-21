package vacademy.io.notification_service.dto;

import com.fasterxml.jackson.annotation.JsonProperty;
import lombok.Data;

import java.util.Map;

@Data
public class SesEventDTO {
    
    @JsonProperty("eventType")
    private String eventType;
    
    @JsonProperty("mail")
    private MailDTO mail;
    
    @JsonProperty("bounce")
    private BounceDTO bounce;
    
    @JsonProperty("complaint")
    private ComplaintDTO complaint;
    
    @JsonProperty("delivery")
    private DeliveryDTO delivery;
    
    @JsonProperty("open")
    private OpenDTO open;
    
    @JsonProperty("click")
    private ClickDTO click;
    
    @JsonProperty("send")
    private SendDTO send;
    
    @Data
    public static class MailDTO {
        @JsonProperty("messageId")
        private String messageId;
        
        @JsonProperty("timestamp")
        private String timestamp;
        
        @JsonProperty("source")
        private String source;
        
        @JsonProperty("sourceArn")
        private String sourceArn;
        
        @JsonProperty("sourceIp")
        private String sourceIp;
        
        @JsonProperty("sendingAccountId")
        private String sendingAccountId;
        
        @JsonProperty("destination")
        private String[] destination;
        
        @JsonProperty("headersTruncated")
        private Boolean headersTruncated;
        
        @JsonProperty("headers")
        private HeaderDTO[] headers;
        
        @JsonProperty("commonHeaders")
        private CommonHeadersDTO commonHeaders;
        
        @JsonProperty("tags")
        private Map<String, String[]> tags;
    }
    
    @Data
    public static class HeaderDTO {
        @JsonProperty("name")
        private String name;
        
        @JsonProperty("value")
        private String value;
    }
    
    @Data
    public static class CommonHeadersDTO {
        @JsonProperty("from")
        private String[] from;
        
        @JsonProperty("to")
        private String[] to;
        
        @JsonProperty("cc")
        private String[] cc;
        
        @JsonProperty("bcc")
        private String[] bcc;
        
        @JsonProperty("sender")
        private String[] sender;
        
        @JsonProperty("replyTo")
        private String[] replyTo;
        
        @JsonProperty("returnPath")
        private String returnPath;
        
        @JsonProperty("messageId")
        private String messageId;
        
        @JsonProperty("date")
        private String date;
        
        @JsonProperty("subject")
        private String subject;
    }
    
    @Data
    public static class BounceDTO {
        @JsonProperty("bounceType")
        private String bounceType;
        
        @JsonProperty("bounceSubType")
        private String bounceSubType;
        
        @JsonProperty("bouncedRecipients")
        private BouncedRecipientDTO[] bouncedRecipients;
        
        @JsonProperty("timestamp")
        private String timestamp;
        
        @JsonProperty("feedbackId")
        private String feedbackId;
        
        @JsonProperty("reportingMTA")
        private String reportingMTA;
    }
    
    @Data
    public static class BouncedRecipientDTO {
        @JsonProperty("emailAddress")
        private String emailAddress;
        
        @JsonProperty("action")
        private String action;
        
        @JsonProperty("status")
        private String status;
        
        @JsonProperty("diagnosticCode")
        private String diagnosticCode;
    }
    
    @Data
    public static class ComplaintDTO {
        @JsonProperty("complainedRecipients")
        private ComplainedRecipientDTO[] complainedRecipients;
        
        @JsonProperty("timestamp")
        private String timestamp;
        
        @JsonProperty("feedbackId")
        private String feedbackId;
        
        @JsonProperty("userAgent")
        private String userAgent;
        
        @JsonProperty("complaintFeedbackType")
        private String complaintFeedbackType;
        
        @JsonProperty("arrivalDate")
        private String arrivalDate;
    }
    
    @Data
    public static class ComplainedRecipientDTO {
        @JsonProperty("emailAddress")
        private String emailAddress;
    }
    
    @Data
    public static class DeliveryDTO {
        @JsonProperty("timestamp")
        private String timestamp;
        
        @JsonProperty("processingTimeMillis")
        private Long processingTimeMillis;
        
        @JsonProperty("recipients")
        private String[] recipients;
        
        @JsonProperty("smtpResponse")
        private String smtpResponse;
        
        @JsonProperty("reportingMTA")
        private String reportingMTA;
    }
    
    @Data
    public static class OpenDTO {
        @JsonProperty("timestamp")
        private String timestamp;
        
        @JsonProperty("ipAddress")
        private String ipAddress;
        
        @JsonProperty("userAgent")
        private String userAgent;
    }
    
    @Data
    public static class ClickDTO {
        @JsonProperty("timestamp")
        private String timestamp;
        
        @JsonProperty("ipAddress")
        private String ipAddress;
        
        @JsonProperty("userAgent")
        private String userAgent;
        
        @JsonProperty("link")
        private String link;
    }
    
    @Data
    public static class SendDTO {
        @JsonProperty("timestamp")
        private String timestamp;
    }
}
