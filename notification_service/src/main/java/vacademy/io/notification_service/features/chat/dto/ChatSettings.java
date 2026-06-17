package vacademy.io.notification_service.features.chat.dto;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import com.fasterxml.jackson.annotation.JsonProperty;
import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.util.HashMap;
import java.util.Map;

/**
 * The {@code chat} block of institute settings. Stored under
 * {@code institute_announcement_settings.settings.chat} and round-tripped via the
 * existing settings Request/Response DTOs. All flags default to "open" so an absent
 * block means chat is fully permitted.
 */
@Data
@NoArgsConstructor
@AllArgsConstructor
@JsonIgnoreProperties(ignoreUnknown = true)
public class ChatSettings {

    private Boolean enabled = false; // OFF by default — institutes opt in explicitly

    @JsonProperty("batch_group")
    private BatchGroupSettings batchGroup;

    private CommunityChatSettings community;

    private DirectSettings direct;

    private AttachmentSettings attachments;

    @Data
    @NoArgsConstructor
    @AllArgsConstructor
    @JsonIgnoreProperties(ignoreUnknown = true)
    public static class BatchGroupSettings {
        @JsonProperty("students_can_post")
        private Boolean studentsCanPost = true;
        @JsonProperty("teachers_can_post")
        private Boolean teachersCanPost = true;
    }

    @Data
    @NoArgsConstructor
    @AllArgsConstructor
    @JsonIgnoreProperties(ignoreUnknown = true)
    public static class CommunityChatSettings {
        // Community channel visibility. On by default — an institute can flag it off to keep DMs +
        // batch groups while hiding the all-institute community channel.
        private Boolean enabled = true;
        @JsonProperty("students_can_post")
        private Boolean studentsCanPost = true;
        @JsonProperty("teachers_can_post")
        private Boolean teachersCanPost = true;
        @JsonProperty("admins_can_post")
        private Boolean adminsCanPost = true;
        private ChatRulesDto rules;
    }

    @Data
    @NoArgsConstructor
    @AllArgsConstructor
    @JsonIgnoreProperties(ignoreUnknown = true)
    public static class DirectSettings {
        private Boolean enabled = true;
        // sender role -> target role -> allowed. Roles: student | teacher | admin
        private Map<String, Map<String, Boolean>> matrix = new HashMap<>();
    }

    @Data
    @NoArgsConstructor
    @AllArgsConstructor
    @JsonIgnoreProperties(ignoreUnknown = true)
    public static class AttachmentSettings {
        @JsonProperty("images_enabled")
        private Boolean imagesEnabled = true;
        @JsonProperty("files_enabled")
        private Boolean filesEnabled = true;
        @JsonProperty("max_file_size_mb")
        private Integer maxFileSizeMb = 25;
    }
}
