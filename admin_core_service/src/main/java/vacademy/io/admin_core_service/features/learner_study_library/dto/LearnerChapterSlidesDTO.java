package vacademy.io.admin_core_service.features.learner_study_library.dto;

import com.fasterxml.jackson.databind.PropertyNamingStrategy;
import com.fasterxml.jackson.databind.annotation.JsonNaming;
import lombok.Data;

import java.util.List;

/**
 * One chapter's learner slides, as returned by the bulk
 * slides-by-package-session endpoint. Each entry in {@code slides} has the
 * exact same shape as the per-chapter {@code /slides} endpoint's elements.
 */
@Data
@JsonNaming(PropertyNamingStrategy.SnakeCaseStrategy.class)
public class LearnerChapterSlidesDTO {
    private String chapterId;
    private List<LearnerSlidesDetailDTO> slides;
}
