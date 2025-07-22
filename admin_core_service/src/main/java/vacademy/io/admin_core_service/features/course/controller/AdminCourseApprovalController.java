package vacademy.io.admin_core_service.features.course.controller;

import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import vacademy.io.admin_core_service.features.course.service.CourseApprovalService;
import vacademy.io.common.auth.model.CustomUserDetails;
import vacademy.io.common.institute.entity.PackageEntity;

import java.util.List;
import java.util.Map;
import java.util.HashMap;

@RestController
@RequestMapping("/admin-core-service/admin/course-approval/v1")
@RequiredArgsConstructor
public class AdminCourseApprovalController {

    private final CourseApprovalService courseApprovalService;

    /**
     * Approve a course submitted by teacher
     */
    @PostMapping("/approve")
    public ResponseEntity<String> approveCourse(
            @RequestParam String courseId,
            @RequestAttribute("user") CustomUserDetails admin) {
        try {
            String result = courseApprovalService.approveCourseWithValidation(courseId, admin);
            return ResponseEntity.ok(result);
        } catch (Exception e) {
            return ResponseEntity.badRequest().body("Error: " + e.getMessage());
        }
    }

    /**
     * Reject a course with reason
     */
    @PostMapping("/reject")
    public ResponseEntity<String> rejectCourse(
            @RequestParam String courseId,
            @RequestParam String reason,
            @RequestAttribute("user") CustomUserDetails admin) {
        try {
            String result = courseApprovalService.rejectCourseWithValidation(courseId, reason, admin);
            return ResponseEntity.ok(result);
        } catch (Exception e) {
            return ResponseEntity.badRequest().body("Error: " + e.getMessage());
        }
    }

    /**
     * Get courses pending review
     */
    @GetMapping("/pending-review")
    public ResponseEntity<?> getCoursesForReview(@RequestAttribute("user") CustomUserDetails admin) {
        try {
            List<PackageEntity> courses = courseApprovalService.getCoursesForReview();
            return ResponseEntity.ok(courses);
        } catch (Exception e) {
            return ResponseEntity.badRequest().body("Error retrieving courses: " + e.getMessage());
        }
    }

    /**
     * Get course approval history and details for admin review
     */
    @GetMapping("/course-history/{courseId}")
    public ResponseEntity<Object> getCourseHistory(
            @PathVariable String courseId,
            @RequestAttribute("user") CustomUserDetails admin) {
        try {
            Object history = courseApprovalService.getCourseApprovalHistory(courseId);
            return ResponseEntity.ok(history);
        } catch (Exception e) {
            return ResponseEntity.badRequest().body("Error retrieving course history: " + e.getMessage());
        }
    }

    /**
     * Get summary of pending approvals for admin dashboard
     */
    @GetMapping("/approval-summary")
    public ResponseEntity<Object> getApprovalSummary(@RequestAttribute("user") CustomUserDetails admin) {
        try {
            Map<String, Object> summary = new HashMap<>();
            List<PackageEntity> pendingCourses = courseApprovalService.getCoursesForReview();
            summary.put("pending_count", pendingCourses.size());
            summary.put("pending_courses", pendingCourses);
            return ResponseEntity.ok(summary);
        } catch (Exception e) {
            return ResponseEntity.badRequest().body("Error retrieving approval summary: " + e.getMessage());
        }
    }

    /**
     * Get course details for review (with all content hierarchy)
     */
    @GetMapping("/review-details/{courseId}")
    public ResponseEntity<CourseReviewDetailsDTO> getCourseReviewDetails(@PathVariable String courseId) {
        // This would return comprehensive course details for admin review
        // Implementation would go in the service
        return ResponseEntity.ok(new CourseReviewDetailsDTO()); // Placeholder
    }

    // Inner classes for request/response DTOs
    public static class RejectCourseRequest {
        private String reason;

        public String getReason() {
            return reason;
        }

        public void setReason(String reason) {
            this.reason = reason;
        }
    }

    public static class CourseReviewDetailsDTO {
        private String courseId;
        private String courseName;
        private String status;
        private String createdByUserId;
        private String originalCourseId;
        // Add more fields as needed

        // Getters and setters would go here
    }
} 