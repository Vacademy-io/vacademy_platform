package vacademy.io.admin_core_service.features.mentorship.dto;

import com.fasterxml.jackson.databind.PropertyNamingStrategies;
import com.fasterxml.jackson.databind.annotation.JsonNaming;
import java.util.List;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

/**
 * A mentor for admin/mentor/student views. Carries the mentor profile plus
 * auth-hydrated identity ({@code name}/{@code email}/...) resolved from
 * auth_service by user id. {@code assignedStudentCount} is populated for the
 * admin management/dashboard lists and may be null elsewhere.
 */
@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
@JsonNaming(PropertyNamingStrategies.SnakeCaseStrategy.class)
public class MentorDTO {
    private String id;
    private String instituteId;
    private String userId;
    private String displayName;
    private String title;
    private String profileImageFileId;
    private String bio;
    private String bookingPageId;
    private String bookingPageSlug; // resolved from booking_page; null when unset — Book is gated on this
    private String googleAccountId;
    private Boolean googleConnected; // has the mentor connected their own Google account
    private String googleEmail;      // the connected account's email (for display)
    private String status;
    private Integer assignedStudentCount;

    /** Topics this mentor covers, exploded from the comma-separated column. */
    private List<String> expertiseTags;
    /** Max ACTIVE mentees; null = unlimited. */
    private Integer maxMentees;
    /** Remaining capacity; null when {@code maxMentees} is null. */
    private Integer availableSlots;
    /** True when assignment would exceed {@code maxMentees} — assignment skips this mentor. */
    private Boolean atCapacity;
    /** Whether learners can find and request this mentor. */
    private Boolean isDiscoverable;

    /** Mean of this mentor's session ratings (1 decimal); null when nobody has rated them. */
    private Double averageRating;
    /** How many ratings that average is based on. */
    private Integer ratingCount;

    // Auth-hydrated identity (fallbacks when the mentor profile omits its own).
    private String name;
    private String email;
    private String mobileNumber;
    private String profilePicFileId;
}
