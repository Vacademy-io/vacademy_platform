package vacademy.io.admin_core_service.features.mentorship.dto;

import com.fasterxml.jackson.databind.PropertyNamingStrategies;
import com.fasterxml.jackson.databind.annotation.JsonNaming;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.util.List;

/**
 * A learner's mentor request, for both the admin review queue and the learner's
 * own "my requests" list. Identity on both sides is hydrated from auth_service so
 * neither screen has to make a second call.
 */
@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
@JsonNaming(PropertyNamingStrategies.SnakeCaseStrategy.class)
public class MentorRequestDTO {
    private String id;
    private String instituteId;
    private String studentUserId;
    private String mentorId;      // null = "any available mentor"
    private String message;
    private String status;        // PENDING | APPROVED | DECLINED | CANCELLED
    private String decisionNote;
    private String assignmentId;
    private Long createdAt;       // epoch millis
    private Long decidedAt;       // epoch millis; null while PENDING

    // Requesting learner (hydrated).
    private String studentName;
    private String studentEmail;

    // Requested mentor (hydrated); null on an "any mentor" request.
    private String mentorName;
    private String mentorTitle;
    private String mentorProfileImageFileId;
    private List<String> mentorExpertiseTags;
    /** Mentor's remaining capacity at read time — null when the mentor has no cap. */
    private Integer mentorAvailableSlots;
}
