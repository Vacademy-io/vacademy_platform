package vacademy.io.notification_service.features.announcements.dto;

import lombok.AllArgsConstructor;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

import jakarta.validation.Valid;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;

@Getter
@Setter
@AllArgsConstructor
@NoArgsConstructor
public class MessageReplyRequest {
    
    @NotBlank(message = "Announcement ID is required")
    private String announcementId;
    
    private String parentMessageId; // null for top-level replies
    
    @NotBlank(message = "User ID is required")
    private String userId;
    
    @Size(max = 255, message = "User name must not exceed 255 characters")
    private String userName;
    
    @Size(max = 100, message = "User role must not exceed 100 characters")
    private String userRole;
    
    @NotNull(message = "Content is required")
    @Valid
    private RichTextDataRequest content;
    
    @Getter
    @Setter
    @AllArgsConstructor
    @NoArgsConstructor
    public static class RichTextDataRequest {
        
        @NotBlank(message = "Content type is required")
        @Pattern(regexp = "^(text|html|video|image)$", message = "Content type must be one of: text, html, video, image")
        private String type;
        
        @NotBlank(message = "Content is required")
        @Size(max = 5000, message = "Reply content must not exceed 5000 characters")
        private String content;
    }
}