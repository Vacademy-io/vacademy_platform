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
}

// DTO for the user object within the request
