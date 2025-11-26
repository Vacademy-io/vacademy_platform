package vacademy.io.admin_core_service.features.live_session.entity;

import jakarta.persistence.*;
import lombok.*;
import org.hibernate.annotations.UuidGenerator;

import java.sql.Timestamp;
import java.util.Date;

@Entity
@Table(name = "live_session")
@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
@SqlResultSetMapping(
    name = "LiveSessionListProjectionMapping",
    classes = @ConstructorResult(
        targetClass = LiveSessionListProjectionImpl.class,
        columns = {
            @ColumnResult(name = "sessionId", type = String.class),
            @ColumnResult(name = "waitingRoomTime", type = Integer.class),
            @ColumnResult(name = "thumbnailFileId", type = String.class),
            @ColumnResult(name = "backgroundScoreFileId", type = String.class),
            @ColumnResult(name = "sessionStreamingServiceType", type = String.class),
            @ColumnResult(name = "scheduleId", type = String.class),
            @ColumnResult(name = "meetingDate", type = java.sql.Date.class),
            @ColumnResult(name = "startTime", type = java.sql.Time.class),
            @ColumnResult(name = "lastEntryTime", type = java.sql.Time.class),
            @ColumnResult(name = "recurrenceType", type = String.class),
            @ColumnResult(name = "accessLevel", type = String.class),
            @ColumnResult(name = "title", type = String.class),
            @ColumnResult(name = "subject", type = String.class),
            @ColumnResult(name = "registrationFormLinkForPublicSessions", type = String.class),
            @ColumnResult(name = "allowPlayPause", type = Boolean.class),
            @ColumnResult(name = "timezone", type = String.class),
            @ColumnResult(name = "meetingLink", type = String.class)
        }
    )
)
public class LiveSession {

    @Id
    @UuidGenerator
    @Column(name = "id", nullable = false, unique = true)
    private String id;

    private String instituteId;

    private Timestamp startTime;
    private Timestamp lastEntryTime;

    private String accessLevel;
    private String meetingType;
    private String defaultMeetLink;
    private String linkType;
    private String waitingRoomLink;
    private String registrationFormLinkForPublicSessions;
    private String createdByUserId;

    private String title;
    private String descriptionHtml;
    private String notificationEmailMessage;
    private String attendanceEmailMessage;
    private String coverFileId;
    private String subject;
    private String status;

    private Integer waitingRoomTime;               // New field
    private String thumbnailFileId;                // New field
    private String backgroundScoreFileId;          // New field
    private Boolean allowRewind;
    private String sessionStreamingServiceType;

    @Column(name = "created_at", insertable = false, updatable = false)
    private Date createdAt;

    @Column(name = "updated_at", insertable = false, updatable = false)
    private Date updatedAt;

    @Column(name="allow_play_pause")
    private boolean allowPlayPause;

    private String timezone;

    @PrePersist
    public void prePersist() {
        if (this.accessLevel == null) {
            this.accessLevel = "private";
        }
    }
}
