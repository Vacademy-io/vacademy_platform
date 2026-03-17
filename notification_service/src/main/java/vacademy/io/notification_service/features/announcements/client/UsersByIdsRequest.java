package vacademy.io.notification_service.features.announcements.client;

import lombok.AllArgsConstructor;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

import java.util.List;

/**
 * Request DTO for getting users by IDs
 * Matches the format expected by auth service endpoint
 */
@Getter
@Setter
@AllArgsConstructor
@NoArgsConstructor
public class UsersByIdsRequest {
    private List<String> userIds;
}

