package vacademy.io.community_service.feature.session.entity;

import jakarta.persistence.*;
import lombok.*;

import java.util.Date;

@Entity
@Table(name = "live_session", schema = "public")
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class LiveSessionRecord {

    @Id
    @Column(name = "id")
    private String id;

    @Column(name = "presentation_id")
    private String presentationId;

    @Column(name = "presentation_title")
    private String presentationTitle;

    @Column(name = "invite_code")
    private String inviteCode;

    @Column(name = "status", nullable = false)
    private String status;

    @Column(name = "can_join_in_between")
    private Boolean canJoinInBetween;

    @Column(name = "show_results_at_last_slide")
    private Boolean showResultsAtLastSlide;

    @Column(name = "default_seconds_for_question")
    private Integer defaultSecondsForQuestion;

    @Column(name = "student_attempts")
    private Integer studentAttempts;

    @Column(name = "points_per_correct_answer")
    private Integer pointsPerCorrectAnswer;

    @Column(name = "negative_marking_enabled")
    private Boolean negativeMarkingEnabled;

    @Column(name = "negative_marks_per_wrong_answer")
    private Double negativeMarksPerWrongAnswer;

    @Column(name = "total_mcq_slides")
    private Integer totalMcqSlides;

    @Column(name = "created_at")
    @Temporal(TemporalType.TIMESTAMP)
    private Date createdAt;

    @Column(name = "started_at")
    @Temporal(TemporalType.TIMESTAMP)
    private Date startedAt;

    @Column(name = "ended_at")
    @Temporal(TemporalType.TIMESTAMP)
    private Date endedAt;
}
