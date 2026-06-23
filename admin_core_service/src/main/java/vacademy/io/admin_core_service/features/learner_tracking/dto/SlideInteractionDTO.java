package vacademy.io.admin_core_service.features.learner_tracking.dto;

import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@NoArgsConstructor
@AllArgsConstructor
public class SlideInteractionDTO {
    /** Stable block key within the slide, e.g. "checklist", "fill-2", "mcq-0". */
    private String elementKey;
    /** Block kind: CHECKLIST | FILL_BLANKS | MCQ. */
    private String elementType;
    /** Opaque, frontend-defined JSON payload (answers + correctness + labels). */
    private String stateJson;
}
