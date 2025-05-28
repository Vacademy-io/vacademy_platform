package vacademy.io.admin_core_service.features.live_session.entity;


import jakarta.persistence.*;
import lombok.*;
import org.hibernate.annotations.UuidGenerator;

import java.sql.Timestamp;
import java.util.Date;
import java.util.UUID;

@Entity
@Table(name = "live_session")
@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class LiveSession {

    @Id
    @UuidGenerator
    @Column(name = "id", nullable = false, unique = true)
    private String Id;

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

    @Column(name = "created_at", insertable = false, updatable = false)
    private Date createdAt;

    @Column(name = "updated_at", insertable = false, updatable = false)
    private Date updatedAt;

}
