package vacademy.io.admin_core_service.features.course.dto;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.util.ArrayList;
import java.util.List;

/**
 * Aggregated result of a copy-content run. Counters are summed across all
 * targets. `warnings` typically contains drip-condition prerequisite-id
 * remap fallouts (ids referenced from the source course that fell outside
 * the copy scope and were dropped).
 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class CopyCourseContentResponse {

    private int copiedSubjects;
    private int copiedModules;
    private int copiedChapters;
    private int copiedSlides;

    @Builder.Default
    private List<String> warnings = new ArrayList<>();

    public void incrementSubjects() { this.copiedSubjects++; }
    public void incrementModules() { this.copiedModules++; }
    public void incrementChapters() { this.copiedChapters++; }
    public void incrementSlides(int by) { this.copiedSlides += by; }

    public void addWarnings(List<String> more) {
        if (more == null || more.isEmpty()) return;
        if (this.warnings == null) this.warnings = new ArrayList<>();
        this.warnings.addAll(more);
    }
}
