package vacademy.io.assessment_service.features.assessment.entity;

import jakarta.persistence.*;
import lombok.*;
import com.fasterxml.jackson.databind.PropertyNamingStrategies;
import com.fasterxml.jackson.databind.annotation.JsonNaming;
import org.hibernate.annotations.UuidGenerator;

import java.util.Date;

@Entity
@Table(name = "assessment_notification_metadata")
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
@JsonNaming(PropertyNamingStrategies.SnakeCaseStrategy.class)
public class AssessmentNotificationMetadata {

    @Id
    @UuidGenerator
    @Column(name = "id")
    private String id;

    @ManyToOne
    @JoinColumn(name = "assessment_id")
    private Assessment assessment;

    @Column(name = "participant_when_assessment_created", nullable = false)
    private boolean participantWhenAssessmentCreated;

    @Column(name = "participant_show_leaderboard", nullable = false)
    private boolean participantShowLeaderboard;

    @Column(name = "participant_before_assessment_goes_live", nullable = false)
    private boolean participantBeforeAssessmentGoesLive;

    @Column(name = "participant_when_assessment_live", nullable = false)
    private boolean participantWhenAssessmentLive;

    @Column(name = "parent_when_assessment_created", nullable = false)
    private boolean parentWhenAssessmentCreated;

    @Column(name = "parent_show_leaderboard", nullable = false)
    private boolean parentShowLeaderboard;

    @Column(name = "parent_before_assessment_goes_live", nullable = false)
    private boolean parentBeforeAssessmentGoesLive;

    @Column(name = "parent_when_assessment_live", nullable = false)
    private boolean parentWhenAssessmentLive;

    @Column(name = "when_student_appears")
    private boolean whenStudentAppears;

    @Column(name = "when_student_finishes_test")
    private boolean whenStudentFinishesTest;

    @Column(name = "participant_when_assessment_report_generated", nullable = false)
    private boolean participantWhenAssessmentReportGenerated;

    @Column(name = "parent_when_assessment_report_generated", nullable = false)
    private boolean parentWhenAssessmentReportGenerated;

    @Column(name = "created_at", insertable = false, updatable = false)
    private Date createdAt;

    @Column(name = "updated_at", insertable = false, updatable = false)
    private Date updatedAt;
}
