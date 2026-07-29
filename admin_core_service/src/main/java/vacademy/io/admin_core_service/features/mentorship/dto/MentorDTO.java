package vacademy.io.admin_core_service.features.mentorship.dto;

import com.fasterxml.jackson.databind.PropertyNamingStrategies;
import com.fasterxml.jackson.databind.annotation.JsonNaming;
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
    private String status;
    private Integer assignedStudentCount;

    // Auth-hydrated identity (fallbacks when the mentor profile omits its own).
    private String name;
    private String email;
    private String mobileNumber;
    private String profilePicFileId;
}
