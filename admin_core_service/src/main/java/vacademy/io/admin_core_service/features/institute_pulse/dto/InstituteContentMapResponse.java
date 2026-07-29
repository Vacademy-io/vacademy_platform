package vacademy.io.admin_core_service.features.institute_pulse.dto;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.util.List;

/**
 * Course → subject → module → chapter → slide tree of only the active branches, head counts
 * rolled up. Each learner is resolved to exactly one leaf in SQL, so a node's head count is the
 * exact sum of its descendants.
 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class InstituteContentMapResponse {

    private List<CourseNode> courses;

    private int totalHeads;

    @Data
    @Builder
    @NoArgsConstructor
    @AllArgsConstructor
    public static class CourseNode {
        private String id;
        private String name;
        private int headsNow;
        private List<SubjectNode> subjects;
    }

    @Data
    @Builder
    @NoArgsConstructor
    @AllArgsConstructor
    public static class SubjectNode {
        private String id;
        private String name;
        private int headsNow;
        private List<ModuleNode> modules;
    }

    @Data
    @Builder
    @NoArgsConstructor
    @AllArgsConstructor
    public static class ModuleNode {
        private String id;
        private String name;
        private int headsNow;
        private List<ChapterNode> chapters;
    }

    @Data
    @Builder
    @NoArgsConstructor
    @AllArgsConstructor
    public static class ChapterNode {
        private String id;
        private String name;
        private int headsNow;
        private List<SlideNode> slides;
    }

    @Data
    @Builder
    @NoArgsConstructor
    @AllArgsConstructor
    public static class SlideNode {
        private String id;
        private String title;
        private String slideType;
        private int headsNow;
        private long avgOnSlideSeconds;
    }
}
