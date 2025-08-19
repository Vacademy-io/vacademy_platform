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

    @Column(name="thumbnail_file_id")
    private String thumbnailFileId;
    @Column(name="daily_attendance")
    private boolean dailyAttendance;

    // Getters, Setters, etc.
}

