package vacademy.io.admin_core_service.features.mentorship.dto;

import com.fasterxml.jackson.databind.PropertyNamingStrategies;
import com.fasterxml.jackson.databind.annotation.JsonNaming;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

/** Edit a mentor's profile. Null fields are left unchanged. */
@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
@JsonNaming(PropertyNamingStrategies.SnakeCaseStrategy.class)
public class UpdateMentorRequest {
    private String displayName;
    private String title;
    private String profileImageFileId;
    private String bio;
    private String status; // optional ACTIVE | INACTIVE
    private String bookingPageId;
}
