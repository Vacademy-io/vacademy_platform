package vacademy.io.admin_core_service.features.course_pulse.dto;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.util.List;

/**
 * Content Map = "where is my class right now", as a collapsible tree of only the
 * active branches (subject → module → chapter → slide). Head counts roll up: because
 * each learner is on exactly one slide, a node's headsNow is the exact sum of its
 * descendants' slide head counts.
 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class ContentMapResponse {

    private List<SubjectNode> subjects;

    /** total distinct live learners across the whole map. */
    private int totalHeads;

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
        /** live avg is well above the historical median for this slide (Phase 2b baseline). */
        private boolean friction;
        /** historical median seconds for this slide, when a baseline exists (else null). */
        private Long baselineMedianSeconds;
    }
}
