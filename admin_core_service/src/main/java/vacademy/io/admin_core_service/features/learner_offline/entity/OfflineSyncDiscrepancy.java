package vacademy.io.admin_core_service.features.learner_offline.entity;

import jakarta.persistence.*;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;
import org.hibernate.annotations.UuidGenerator;

import java.sql.Timestamp;

/**
 * A single field-level mismatch between an offline client's claimed
 * QUESTION/QUIZ answer state and what OfflineQuizRescoringService recomputed
 * server-side from auto_evaluation_json (offline plan, Part A4 step 5). The
 * server value always wins on dispatch; this row exists purely for admin
 * visibility/audit via AdminOfflineTelemetryController.
 */
@Entity
@Table(name = "offline_sync_discrepancy")
@Getter
@Setter
@NoArgsConstructor
public class OfflineSyncDiscrepancy {

    @Id
    @UuidGenerator
    @Column(name = "id", nullable = false, updatable = false)
    private String id;

    @Column(name = "client_event_id")
    private String clientEventId;

    @Column(name = "activity_id")
    private String activityId;

    @Column(name = "user_id", nullable = false)
    private String userId;

    @Column(name = "slide_id")
    private String slideId;

    @Column(name = "package_session_id")
    private String packageSessionId;

    @Column(name = "question_id")
    private String questionId;

    @Column(name = "field", nullable = false, length = 64)
    private String field;

    @Column(name = "client_value", length = 500)
    private String clientValue;

    @Column(name = "server_value", length = 500)
    private String serverValue;

    @Column(name = "status", nullable = false, length = 16)
    private String status = "OPEN";

    @Column(name = "created_at", insertable = false, updatable = false)
    private Timestamp createdAt;
}
