package vacademy.io.admin_core_service.features.course.controller;

import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import vacademy.io.admin_core_service.features.course.dto.AddCourseDTO;
import vacademy.io.admin_core_service.features.course.dto.CopyContentLineageResponse;
import vacademy.io.admin_core_service.features.course.dto.CopyCourseContentRequest;
import vacademy.io.admin_core_service.features.course.dto.CopyCourseContentResponse;
import vacademy.io.admin_core_service.features.course.dto.CourseBatchDTO;
import vacademy.io.admin_core_service.features.course.dto.bulk.BulkAddCourseRequestDTO;
import vacademy.io.admin_core_service.features.course.dto.bulk.BulkAddCourseResponseDTO;
import vacademy.io.admin_core_service.features.course.service.BulkCourseService;
import vacademy.io.admin_core_service.features.course.service.CourseContentCopyService;
import vacademy.io.admin_core_service.features.course.service.CourseService;
import vacademy.io.common.auth.model.CustomUserDetails;
import vacademy.io.common.institute.dto.PackageDTO;

import java.util.List;

@RestController
@RequestMapping("/admin-core-service/course/v1")
@RequiredArgsConstructor
public class CourseController {
    private final CourseService courseService;
    private final BulkCourseService bulkCourseService;
    private final CourseContentCopyService courseContentCopyService;

    @PostMapping("/add-course/{instituteId}")
    public String addCourse(@RequestBody AddCourseDTO addCourseDTO, @PathVariable("instituteId") String instituteId,
            @RequestAttribute("user") CustomUserDetails userDetails) {
        return courseService.addCourse(addCourseDTO, userDetails, instituteId);
    }

    /**
     * Bulk add courses with flexible configuration options.
     * 
     * Supports:
     * - Global defaults that apply to all courses
     * - Per-course overrides for batches, payment, inventory, and metadata
     * - Multiple batches (level-session pairs) per course
     * - Custom payment options or use of institute defaults
     * - Inventory management (max slots, available slots)
     * - Dry run mode for validation without persistence
     * 
     * Configuration resolution order: Course-level > Global defaults > System
     * defaults
     */
    @PostMapping("/bulk-add-courses/{instituteId}")
    public BulkAddCourseResponseDTO bulkAddCourses(
            @RequestBody BulkAddCourseRequestDTO request,
            @PathVariable("instituteId") String instituteId,
            @RequestAttribute("user") CustomUserDetails userDetails) {
        return bulkCourseService.bulkAddCourses(request, instituteId, userDetails);
    }

    @PutMapping("/update-course/{courseId}")
    public String updateCourse(@RequestBody PackageDTO packageDTO, @PathVariable("courseId") String packageId,
            @RequestAttribute("user") CustomUserDetails userDetails) {
        return courseService.updateCourse(packageDTO, userDetails, packageId);
    }

    @DeleteMapping("/delete-courses")
    public String deleteCourse(@RequestBody List<String> courseIds,
            @RequestAttribute("user") CustomUserDetails userDetails) {
        return courseService.deleteCourses(courseIds, userDetails);
    }

    @PostMapping("/update-course-details/{instituteId}")
    public String updateCourse(@RequestBody AddCourseDTO addCourseDTO, @PathVariable("instituteId") String instituteId,
            @RequestAttribute("user") CustomUserDetails userDetails) {
        return courseService.addOrUpdateCourse(addCourseDTO, instituteId, userDetails);
    }

    @GetMapping("/{courseId}/batches")
    public List<CourseBatchDTO> getBatchesForCourse(@PathVariable("courseId") String courseId) {
        return courseService.getBatchesForCourse(courseId);
    }

    /**
     * Deep-clone the content tree (Subject -> Module -> Chapter -> Slide + slide
     * source content) of one institute batch into one or more target batches of
     * the calling user's freshly-created course.
     *
     * Source and target courses must share the same course_depth (enforced).
     * Drip-condition prerequisite ids inside the cloned subtree are remapped
     * to the new ids; ids that fall outside the copy scope are dropped and
     * surfaced as warnings on the response.
     */
    @PostMapping("/copy-content")
    public ResponseEntity<CopyCourseContentResponse> copyCourseContent(
            @RequestBody CopyCourseContentRequest request,
            @RequestAttribute("user") CustomUserDetails userDetails) {
        CopyCourseContentResponse result = courseContentCopyService.copy(
                request.getSourcePackageSessionId(),
                request.getTargetPackageSessionIds(),
                request.getMode(),
                userDetails == null ? null : userDetails.getUserId());
        return ResponseEntity.ok(result);
    }

    /**
     * Content-copy lineage for a batch. Powers the (i) tooltip in the course
     * structure view:
     *  - upstream: "this batch's content came from X (separate / linked copy)"
     *  - downstream: "these batches were seeded from this one"
     */
    @GetMapping("/copy-lineage/{packageSessionId}")
    public ResponseEntity<CopyContentLineageResponse> getCopyLineage(
            @PathVariable("packageSessionId") String packageSessionId) {
        return ResponseEntity.ok(courseContentCopyService.getLineage(packageSessionId));
    }
}
