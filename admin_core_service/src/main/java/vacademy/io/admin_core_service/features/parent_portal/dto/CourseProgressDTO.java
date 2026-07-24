package vacademy.io.admin_core_service.features.parent_portal.dto;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;
import vacademy.io.admin_core_service.features.learner_reports.dto.LearnerSubjectWiseProgressReportDTO;

import java.util.List;

/**
 * Subject-wise progress for ONE of the child's enrolled courses. The parent
 * progress screen shows one of these per course the child is enrolled in, so a
 * child in multiple courses sees every course's progress, grouped and labelled —
 * not just the primary course.
 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class CourseProgressDTO {
    private String packageSessionId;
    /** Human batch label ("Level Package (Session)"), or "" if unresolved. */
    private String courseName;
    private List<LearnerSubjectWiseProgressReportDTO> subjects;
}
