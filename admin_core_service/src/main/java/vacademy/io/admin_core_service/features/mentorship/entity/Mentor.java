package vacademy.io.admin_core_service.features.mentorship.entity;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;
import org.hibernate.annotations.UuidGenerator;

import java.sql.Timestamp;

/**
 * A user promoted to "mentor" within an institute, with a mentor-facing
 * display name / title / profile image. A user can be a mentor in an institute
 * at most once (partial unique index on institute_id + user_id). The auth-side
 * MENTOR role is granted separately via add-user-roles; this row carries the
 * mentor profile and the optional link to their booking page.
 */
@Entity
@Table(name = "mentor")
@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class Mentor {

    @Id
    @UuidGenerator
    @Column(name = "id", nullable = false, unique = true)
    private String id;

    @Column(name = "institute_id", nullable = false)
    private String instituteId;

    /** The promoted platform (auth) user id. */
    @Column(name = "user_id", nullable = false)
    private String userId;

    @Column(name = "display_name")
    private String displayName;

    @Column(name = "title")
    private String title;

    /** media_service file id for the mentor's profile image. */
    @Column(name = "profile_image_file_id")
    private String profileImageFileId;

    @Column(name = "bio")
    private String bio;

    /** Optional Calendly-style booking page hosting this mentor's 1-on-1 slots. */
    @Column(name = "booking_page_id")
    private String bookingPageId;

    @Column(name = "sub_org_id")
    private String subOrgId;

    /** ACTIVE | INACTIVE | DELETED */
    @Column(name = "status", nullable = false)
    private String status;

    @Column(name = "created_by_user_id")
    private String createdByUserId;

    @Column(name = "created_at", insertable = false, updatable = false)
    private Timestamp createdAt;

    @Column(name = "updated_at", insertable = false, updatable = false)
    private Timestamp updatedAt;
}
