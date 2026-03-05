package vacademy.io.admin_core_service.features.live_session.entity;

import jakarta.persistence.*;
import lombok.*;
import org.hibernate.annotations.UuidGenerator;

import java.sql.Time;
import java.sql.Timestamp;
import java.util.Date;
import java.util.UUID;

@Entity
@Table(name = "session_schedules")
@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class SessionSchedule {

    @Id
    @UuidGenerator
    @Column(name = "id", nullable = false, unique = true)
    private String id;

    private String sessionId;
    private String recurrenceType;
    private String recurrenceKey;

    private Date meetingDate; // Optional at step 1
    private Time startTime;
    private Time lastEntryTime;

    private String linkType;

    private String customMeetingLink;
    private String customWaitingRoomMediaId;

    @Column(name = "created_at", insertable = false, updatable = false)
    private Date createdAt;

    @Column(name = "updated_at", insertable = false, updatable = false)
    private Date updatedAt;

    private String status;

    @Column(name = "thumbnail_file_id")
    private String thumbnailFileId;
    @Column(name = "daily_attendance")
    private boolean dailyAttendance;

    @Column(name = "default_class_link")
    private String defaultClassLink;
    @Column(name = "default_class_name")
    private String defaultClassName;

    @Column(name = "default_class_link_type")
    private String defaultClassLinkType;

    /**
     * Provider meeting key (e.g. Zoho meetingKey). Used by the hourly sync
     * scheduler.
     */
    @Column(name = "provider_meeting_id")
    private String providerMeetingId;

    /**
     * Presenter-only URL from the provider (keep separate from join URL in
     * customMeetingLink).
     */
    @Column(name = "provider_host_url", columnDefinition = "TEXT")
    private String providerHostUrl;

    /** Cached JSON array of MeetingRecordingDTO — updated hourly by scheduler. */
    @Column(name = "provider_recordings_json", columnDefinition = "TEXT")
    private String providerRecordingsJson;

    /** Last time Zoho (or other provider) attendance was pulled. */
    @Column(name = "last_attendance_sync_at")
    private Date lastAttendanceSyncAt;

    /** Last time Zoho (or other provider) recordings were pulled. */
    @Column(name = "last_recording_sync_at")
    private Date lastRecordingSyncAt;

    // Getters, Setters, etc.
}
