package vacademy.io.community_service.feature.session.dto.admin;

import com.fasterxml.jackson.annotation.JsonProperty;
import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.util.List;
import java.util.Map;

// Main request body DTO
@Data
@NoArgsConstructor
@AllArgsConstructor
public class EmailRequestDto {

    private String body;
    @JsonProperty("notification_type")
    private String notificationType;
    private String subject;
    private String source;
    @JsonProperty("source_id")
    private String sourceId;
    private List<EmailUserDto> users;

    /** Optional: attributes the send to a customer institute. Team alerts leave it null. */
    private String instituteId;

    /**
     * The original field order, kept so existing callers compile unchanged after instituteId
     * was added. Lombok's @AllArgsConstructor now takes seven arguments; this is the six.
     */
    public EmailRequestDto(String body, String notificationType, String subject, String source,
                           String sourceId, List<EmailUserDto> users) {
        this.body = body;
        this.notificationType = notificationType;
        this.subject = subject;
        this.source = source;
        this.sourceId = sourceId;
        this.users = users;
    }
}

// DTO for the user object within the request
