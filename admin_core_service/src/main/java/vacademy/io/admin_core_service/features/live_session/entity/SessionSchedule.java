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

    @Column(updatable = false)
    private Timestamp createdAt = new Timestamp(System.currentTimeMillis());
    private Timestamp updatedAt = new Timestamp(System.currentTimeMillis());

    // Getters, Setters, etc.
}

