package vacademy.io.admin_core_service.features.mentorship.dto;

import com.fasterxml.jackson.databind.PropertyNamingStrategies;
import com.fasterxml.jackson.databind.annotation.JsonNaming;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

/** A student assigned to a mentor, for the mentor's "My Mentorship" list. */
@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
@JsonNaming(PropertyNamingStrategies.SnakeCaseStrategy.class)
public class MenteeDTO {
    private String assignmentId;
    private String mentorId;
    private String studentUserId;
    private String packageSessionId;
    private String assignmentMethod;

    // Auth-hydrated identity.
    private String name;
    private String email;
    private String mobileNumber;
    private String profilePicFileId;
}
