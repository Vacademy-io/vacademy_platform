package vacademy.io.admin_core_service.features.course.controller;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import vacademy.io.admin_core_service.features.course.dto.TeacherCourseDetailDTO;
import vacademy.io.admin_core_service.features.course.service.CourseApprovalService;
import vacademy.io.common.auth.model.CustomUserDetails;
import vacademy.io.common.institute.entity.PackageEntity;

import java.util.ArrayList;
import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/admin-core-service/teacher/course-approval/v1")
@RequiredArgsConstructor
@Slf4j
public class TeacherCourseApprovalController {

    private final CourseApprovalService courseApprovalService;

    /**
     * Get teacher's own courses (draft, in review, published)
     */
    @GetMapping("/my-courses")
    public ResponseEntity<List<PackageEntity>> getTeacherCourses(@RequestAttribute("user") CustomUserDetails teacher) {
        List<PackageEntity> courses = courseApprovalService.getTeacherCoursesWithValidation(teacher.getUserId());
        return ResponseEntity.ok(courses);
    }

    /**
     * Enhanced endpoint that provides detailed information about teacher's relationship to each course
     * Returns structured data with relationship metadata like whether teacher is creator or faculty-assigned, 
     * number of assignments, and assigned subjects
     */
    @GetMapping("/my-courses/detailed")
    public ResponseEntity<List<TeacherCourseDetailDTO>> getTeacherCoursesWithDetails(@RequestAttribute("user") CustomUserDetails teacher) {
        try {
            List<TeacherCourseDetailDTO> coursesWithDetails = courseApprovalService.getTeacherCoursesAsDTO(teacher.getUserId());
            return ResponseEntity.ok(coursesWithDetails);
        } catch (Exception e) {
            log.error("Error getting teacher courses with details for {}: {}", teacher.getUserId(), e.getMessage());
            return ResponseEntity.ok(new ArrayList<>()); // Return empty list on error
        }
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
        boolean canEdit = courseApprovalService.canTeacherEditCourse(courseId, teacher.getUserId());
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
            courseApprovalService.validateTeacherCoursePermissions(courseId, teacher.getUserId(), "view");
            Object history = courseApprovalService.getCourseApprovalHistory(courseId);
            return ResponseEntity.ok(history);
        } catch (Exception e) {
            return ResponseEntity.badRequest().body("Error: " + e.getMessage());
        }
    }
} 