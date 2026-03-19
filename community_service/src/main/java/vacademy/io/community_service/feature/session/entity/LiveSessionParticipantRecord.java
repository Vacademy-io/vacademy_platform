package vacademy.io.community_service.feature.session.entity;

import jakarta.persistence.*;
import lombok.*;

import java.util.Date;

@Entity
@Table(name = "live_session_participant", schema = "public")
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class LiveSessionParticipantRecord {

    @Id
    @Column(name = "id")
    private String id;

    @Column(name = "session_id", nullable = false)
    private String sessionId;

    @Column(name = "username", nullable = false)
    private String username;

    @Column(name = "user_id")
    private String userId;

    @Column(name = "name")
    private String name;

    @Column(name = "email")
    private String email;

    @Column(name = "joined_at")
    @Temporal(TemporalType.TIMESTAMP)
    private Date joinedAt;
}
