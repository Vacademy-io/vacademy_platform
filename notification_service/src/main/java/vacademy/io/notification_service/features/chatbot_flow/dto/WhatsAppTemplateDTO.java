package vacademy.io.notification_service.features.chatbot_flow.dto;

import com.fasterxml.jackson.annotation.JsonInclude;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.util.List;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
@JsonInclude(JsonInclude.Include.NON_NULL)
public class WhatsAppTemplateDTO {
    private String id;
    private String instituteId;
    private String metaTemplateId;
    private String name;
    private String language;
    private String category;       // MARKETING, UTILITY, AUTHENTICATION
    private String status;         // DRAFT, PENDING, APPROVED, REJECTED, DISABLED, DELETED
    private String rejectionReason;

    private String headerType;     // NONE, TEXT, IMAGE, VIDEO, DOCUMENT
    private String headerText;
    private String headerSampleUrl;

    private String bodyText;
    private String footerText;

    private List<TemplateButton> buttons;
    private List<String> bodySampleValues;
    private List<String> bodyVariableNames;  // semantic names: ["name", "course_name"]
    private List<String> headerSampleValues;

    private boolean createdViaVacademy;
    private String createdBy;
    private String createdAt;
    private String submittedAt;
    private String approvedAt;

    @Data
    @Builder
    @NoArgsConstructor
    @AllArgsConstructor
    public static class TemplateButton {
        private String type;       // QUICK_REPLY, URL, PHONE_NUMBER
        private String text;
        private String url;        // For URL buttons (base URL, may contain {{1}})
        private String phoneNumber;
        private List<String> example; // Sample values for dynamic URL params
    }
}
