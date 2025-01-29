package vacademy.io.admin_core_service.features.course.controller;

import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.*;
import vacademy.io.admin_core_service.features.course.dto.AddCourseDTO;
import vacademy.io.admin_core_service.features.course.service.CourseService;
import vacademy.io.common.auth.model.CustomUserDetails;

@RestController
@RequestMapping("/admin-core-service/course/v1")
@RequiredArgsConstructor
public class CourseController {
    private final CourseService courseService;

    @PostMapping("/add-course/{instituteId}")
    public String addCourse(@RequestBody AddCourseDTO addCourseDTO, @PathVariable("instituteId") String instituteId,@RequestAttribute("user") CustomUserDetails userDetails) {
        return courseService.addCourse(addCourseDTO, userDetails, instituteId);
    }
}
