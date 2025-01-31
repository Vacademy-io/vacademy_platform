package vacademy.io.admin_core_service.features.course.controller;

import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import vacademy.io.admin_core_service.features.course.dto.AddCourseDTO;
import vacademy.io.admin_core_service.features.course.service.CourseService;
import vacademy.io.common.auth.model.CustomUserDetails;
import vacademy.io.common.institute.dto.PackageDTO;

import java.util.List;

@RestController
@RequestMapping("/admin-core-service/course/v1")
@RequiredArgsConstructor
public class CourseController {
    private final CourseService courseService;

    @PostMapping("/add-course/{instituteId}")
    public ResponseEntity<String> addCourse(@RequestBody AddCourseDTO addCourseDTO, @PathVariable("instituteId") String instituteId, @RequestAttribute("user") CustomUserDetails userDetails) {
        return ResponseEntity.ok(courseService.addCourse(addCourseDTO, userDetails, instituteId));
    }
    @PutMapping("/update-course/{courseId}")
    public ResponseEntity<String> updateCourse(@RequestBody PackageDTO packageDTO, @PathVariable("courseId") String packageId, @RequestAttribute("user") CustomUserDetails userDetails) {
        return ResponseEntity.ok(courseService.updateCourse(packageDTO, userDetails, packageId));
    }
    @DeleteMapping("/delete-courses")
    public ResponseEntity<String> deleteCourse(@RequestBody List<String> courseIds, @RequestAttribute("user") CustomUserDetails userDetails) {
        return ResponseEntity.ok(courseService.deleteCourse(courseIds, userDetails));
    }
}
