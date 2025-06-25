package vacademy.io.community_service.feature.session.dto.admin;

import com.fasterxml.jackson.annotation.JsonProperty;
import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.util.Map;

@Data
@NoArgsConstructor
@AllArgsConstructor
public class EmailUserDto {
    @JsonProperty("user_id")
    private String userId;
    @JsonProperty("channel_id")
    private String channelId; // This will hold the email address
    private Map<String, String> placeholders; // Can be an empty map as per our logic
}