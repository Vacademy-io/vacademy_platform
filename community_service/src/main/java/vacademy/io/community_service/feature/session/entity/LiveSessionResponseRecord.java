package vacademy.io.community_service.feature.session.entity;

import jakarta.persistence.*;
import lombok.*;

import java.util.Date;

@Entity
@Table(name = "live_session_response", schema = "public")
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class LiveSessionResponseRecord {

    @Id
    @Column(name = "id")
    private String id;

    @Column(name = "session_id", nullable = false)
    private String sessionId;

    @Column(name = "slide_id", nullable = false)
    private String slideId;

    @Column(name = "username", nullable = false)
    private String username;

    @Column(name = "response_type")
    private String responseType;

    /** JSON array stored as text: ["optionId1","optionId2"] */
    @Column(name = "selected_option_ids", columnDefinition = "TEXT")
    private String selectedOptionIds;

    @Column(name = "text_answer", columnDefinition = "TEXT")
    private String textAnswer;

    @Column(name = "is_correct")
    private Boolean isCorrect;

    @Column(name = "time_to_response_millis")
    private Long timeToResponseMillis;

    @Column(name = "submitted_at")
    @Temporal(TemporalType.TIMESTAMP)
    private Date submittedAt;
}
