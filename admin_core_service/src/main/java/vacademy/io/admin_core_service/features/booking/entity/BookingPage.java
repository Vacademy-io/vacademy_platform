package vacademy.io.admin_core_service.features.booking.entity;

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
 * A shareable Calendly-style booking configuration ("event type").
 * Single fixed host per page; optionally attached to an audience list
 * (CRM campaign) via {@code audienceId}. Availability rules live in
 * {@code availabilityJson} (see {@code BookingAvailabilityDTO}).
 */
@Entity
@Table(name = "booking_page")
@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class BookingPage {

    @Id
    @UuidGenerator
    @Column(name = "id", nullable = false, unique = true)
    private String id;

    @Column(name = "institute_id", nullable = false)
    private String instituteId;

    @Column(name = "audience_id")
    private String audienceId;

    @Column(name = "host_user_id", nullable = false)
    private String hostUserId;

    @Column(name = "booking_type_id")
    private String bookingTypeId;

    @Column(name = "slug", nullable = false)
    private String slug;

    @Column(name = "title", nullable = false)
    private String title;

    @Column(name = "description")
    private String description;

    @Column(name = "duration_minutes", nullable = false)
    private Integer durationMinutes;

    @Column(name = "slot_granularity_minutes", nullable = false)
    private Integer slotGranularityMinutes;

    @Column(name = "buffer_before_minutes", nullable = false)
    private Integer bufferBeforeMinutes;

    @Column(name = "buffer_after_minutes", nullable = false)
    private Integer bufferAfterMinutes;

    /** Earliest bookable offset from "now" ("allow booking after some time"). */
    @Column(name = "min_notice_minutes", nullable = false)
    private Integer minNoticeMinutes;

    @Column(name = "booking_horizon_days", nullable = false)
    private Integer bookingHorizonDays;

    /** Host/page IANA zone; availability windows are interpreted in this zone. */
    @Column(name = "timezone", nullable = false)
    private String timezone;

    /** GOOGLE_MEET | CUSTOM_LINK | IN_PERSON | PHONE */
    @Column(name = "location_type", nullable = false)
    private String locationType;

    @Column(name = "custom_meeting_link")
    private String customMeetingLink;

    /** When true, mint a fresh Google Meet link per booking via the provider layer. */
    @Column(name = "allocate_google_meet", nullable = false)
    private Boolean allocateGoogleMeet;

    @Column(name = "require_approval", nullable = false)
    private Boolean requireApproval;

    /** Weekly windows + date overrides, serialized BookingAvailabilityDTO. */
    @Column(name = "availability_json")
    private String availabilityJson;

    /** Reminder channels + before-meeting offsets, serialized BookingReminderConfigDTO. */
    @Column(name = "reminder_config_json")
    private String reminderConfigJson;

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
