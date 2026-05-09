package vacademy.io.admin_core_service.features.course.dto;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.util.List;

/**
 * Request body for POST /admin-core-service/course/v1/copy-content.
 *
 * Wizard-time deep clone of an institute batch's content (subjects, modules,
 * chapters, slides + slide source content) into one or more target batches of
 * the freshly-created course. Source and target courses MUST share the same
 * course_depth.
 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class CopyCourseContentRequest {

    /** package_session_id of the source batch. */
    private String sourcePackageSessionId;

    /**
     * package_session_ids of the target batches (every batch of the new course
     * the user wants to seed). One source -> N targets.
     */
    private List<String> targetPackageSessionIds;

    /**
     * Copy strategy.
     *  - "VALUE" (default): deep clone — every Subject/Module/Chapter/Slide row
     *    in the source subtree is duplicated with a fresh id; slide source rows
     *    (DocumentSlide / VideoSlide / Quiz / ...) are deep-cloned too. Edits
     *    in the new course do not affect the source.
     *  - "REFERENCE": share rows — only mapping rows are inserted (subject_session,
     *    chapter_package_session_mapping). The new course points at the SAME
     *    subject/module/chapter/slide ids as the source, so edits in either
     *    course are visible in both. Useful when you want the same content
     *    behind a different course title/description/banner.
     */
    private String mode;
}
