package vacademy.io.admin_core_service.features.course.controller;

import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import vacademy.io.admin_core_service.features.course.service.CourseApprovalService;
import vacademy.io.common.auth.model.CustomUserDetails;
import vacademy.io.common.institute.entity.PackageEntity;

import java.util.List;

@RestController
@RequestMapping("/admin-core-service/teacher/course-approval/v1")
@RequiredArgsConstructor
public class TeacherCourseApprovalController {

    private final CourseApprovalService courseApprovalService;

    /**
     * Get teacher's own courses (draft, in review, published)
     */
    @GetMapping("/my-courses")
    public ResponseEntity<List<PackageEntity>> getTeacherCourses(@RequestAttribute("user") CustomUserDetails teacher) {
        List<PackageEntity> courses = courseApprovalService.getTeacherCoursesWithValidation(teacher.getId());
        return ResponseEntity.ok(courses);
    }

    /**
     * Create an editable copy of a published course
     */
    @PostMapping("/create-editable-copy")
    public ResponseEntity<String> createEditableCopy(
            @RequestParam String originalCourseId,
            @RequestAttribute("user") CustomUserDetails teacher) {
        String tempCourseId = courseApprovalService.createEditableCopyWithValidation(originalCourseId, teacher);
        return ResponseEntity.ok("Editable copy created with ID: " + tempCourseId);
    }

    /**
     * Submit course for admin review
     */
    @PostMapping("/submit-for-review")
    public ResponseEntity<String> submitForReview(
            @RequestParam String courseId,
            @RequestAttribute("user") CustomUserDetails teacher) {
        String result = courseApprovalService.submitForReviewWithValidation(courseId, teacher);
        return ResponseEntity.ok(result);
    }

    /**
     * Withdraw course from review (return to draft)
     */
    @PostMapping("/withdraw-from-review")
    public ResponseEntity<String> withdrawFromReview(
            @RequestParam String courseId,
            @RequestAttribute("user") CustomUserDetails teacher) {
        try {
            String result = courseApprovalService.withdrawFromReview(courseId, teacher);
            return ResponseEntity.ok(result);
        } catch (Exception e) {
            return ResponseEntity.badRequest().body("Error: " + e.getMessage());
        }
    }

    /**
     * Check if teacher can edit a specific course
     */
    @GetMapping("/can-edit/{courseId}")
    public ResponseEntity<Boolean> canEditCourse(
            @PathVariable String courseId,
            @RequestAttribute("user") CustomUserDetails teacher) {
        boolean canEdit = courseApprovalService.canTeacherEditCourse(courseId, teacher.getId());
        return ResponseEntity.ok(canEdit);
    }

    /**
     * Get course approval history for teacher's own course
     */
    @GetMapping("/my-course-history/{courseId}")
    public ResponseEntity<Object> getMyCourseHistory(
            @PathVariable String courseId,
            @RequestAttribute("user") CustomUserDetails teacher) {
        try {
            // Validate teacher owns this course first
            courseApprovalService.validateTeacherCoursePermissions(courseId, teacher.getId(), "view");
            Object history = courseApprovalService.getCourseApprovalHistory(courseId);
            return ResponseEntity.ok(history);
        } catch (Exception e) {
            return ResponseEntity.badRequest().body("Error: " + e.getMessage());
        }
    }
} 