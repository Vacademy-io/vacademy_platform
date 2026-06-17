package vacademy.io.notification_service.features.chat.dto;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import com.fasterxml.jackson.annotation.JsonProperty;
import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.util.ArrayList;
import java.util.List;

/**
 * Community rules shape. Same structure is stored under settings.chat.community.rules (institute defaults)
 * and on chat_conversations.rules (in-channel override).
 */
@Data
@NoArgsConstructor
@AllArgsConstructor
@JsonIgnoreProperties(ignoreUnknown = true)
public class ChatRulesDto {

    private Guidelines guidelines;

    @JsonProperty("acknowledgement_required")
    private Boolean acknowledgementRequired = false;

    private Posting posting;

    @JsonProperty("auto_moderation")
    private AutoModeration autoModeration;

    @Data
    @NoArgsConstructor
    @AllArgsConstructor
    @JsonIgnoreProperties(ignoreUnknown = true)
    public static class Guidelines {
        private String title;
        private List<String> items = new ArrayList<>();
    }

    @Data
    @NoArgsConstructor
    @AllArgsConstructor
    @JsonIgnoreProperties(ignoreUnknown = true)
    public static class Posting {
        @JsonProperty("slow_mode_seconds")
        private Integer slowModeSeconds = 0;

        @JsonProperty("allow_links")
        private Boolean allowLinks = true;

        @JsonProperty("allow_attachments")
        private Boolean allowAttachments = true;

        @JsonProperty("new_member_readonly_minutes")
        private Integer newMemberReadonlyMinutes = 0;
    }

    @Data
    @NoArgsConstructor
    @AllArgsConstructor
    @JsonIgnoreProperties(ignoreUnknown = true)
    public static class AutoModeration {
        @JsonProperty("banned_keywords")
        private List<String> bannedKeywords = new ArrayList<>();

        private String action = "FLAG"; // ChatKeywordAction: BLOCK | FLAG
    }
}
