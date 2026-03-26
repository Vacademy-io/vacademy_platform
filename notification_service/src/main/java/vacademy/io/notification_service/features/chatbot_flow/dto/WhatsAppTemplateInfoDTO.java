package vacademy.io.notification_service.features.chatbot_flow.dto;

import com.fasterxml.jackson.annotation.JsonInclude;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.util.List;

/**
 * Normalized template info returned by the template picker API.
 * Works across Meta, WATI, and COMBOT providers.
 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
@JsonInclude(JsonInclude.Include.NON_NULL)
public class WhatsAppTemplateInfoDTO {
    private String name;
    private String language;
    private String category;        // MARKETING, UTILITY, AUTHENTICATION
    private String status;          // APPROVED, PENDING, REJECTED
    private String headerType;      // none, text, image, video, document
    private String headerText;      // for text headers
    private String bodyText;        // template body with {{1}} placeholders
    private String footerText;
    private int bodyParamCount;     // number of {{N}} placeholders in body
    private List<ButtonInfo> buttons;

    @Data
    @Builder
    @NoArgsConstructor
    @AllArgsConstructor
    public static class ButtonInfo {
        private String type;        // QUICK_REPLY, URL, PHONE_NUMBER
        private String text;        // button display text
        private String url;         // for URL buttons (base URL)
        private boolean hasDynamicUrl; // true if URL has {{1}} suffix
    }
}
