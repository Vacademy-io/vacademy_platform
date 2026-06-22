package vacademy.io.admin_core_service.features.learner_tracking.entity;

import jakarta.persistence.*;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

import java.sql.Timestamp;

/**
 * A learner's state for one interactive block inside a document slide —
 * a checklist/todo, a fill-in-the-blank, or an inline MCQ. One row per
 * (userId, slideId, elementKey). {@code stateJson} stores the frontend-defined
 * payload verbatim (answers + correctness + labels for admin display); the
 * backend treats it as opaque.
 */
@Entity
@Table(name = "learner_slide_interaction")
@Getter
@Setter
@NoArgsConstructor
public class LearnerSlideInteraction {

    @Id
    @Column(length = 255, nullable = false)
    private String id;

    @Column(name = "user_id", length = 255, nullable = false)
    private String userId;

    @Column(name = "slide_id", length = 255, nullable = false)
    private String slideId;

    /** Stable key for the block within the slide, e.g. "checklist", "fill-2", "mcq-0". */
    @Column(name = "element_key", length = 255, nullable = false)
    private String elementKey;

    /** Block kind: CHECKLIST | FILL_BLANKS | MCQ. */
    @Column(name = "element_type", length = 100)
    private String elementType;

    @Column(name = "state_json", columnDefinition = "TEXT")
    private String stateJson;

    @Column(name = "created_at", insertable = false, updatable = false)
    private Timestamp createdAt;

    @Column(name = "updated_at", insertable = false, updatable = false)
    private Timestamp updatedAt;
}
