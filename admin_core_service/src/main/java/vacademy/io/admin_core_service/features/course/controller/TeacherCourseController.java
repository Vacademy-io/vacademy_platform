package vacademy.io.admin_core_service.features.course.controller;

import lombok.RequiredArgsConstructor;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.web.bind.annotation.*;
import vacademy.io.admin_core_service.features.course.dto.AddCourseDTO;
import vacademy.io.admin_core_service.features.course.service.TeacherCourseService;
import vacademy.io.common.auth.model.CustomUserDetails;

@RestController
@RequestMapping("/admin-core-service/course/teacher/v1")
@RequiredArgsConstructor
public class TeacherCourseController {

    @Autowired
    private TeacherCourseService courseService;

    @PostMapping("/add-course/{instituteId}")
    public String addCourse(@RequestBody AddCourseDTO addCourseDTO, @PathVariable("instituteId") String instituteId, @RequestAttribute("user") CustomUserDetails userDetails) {
        return courseService.addCourse(addCourseDTO, userDetails, instituteId);
    }

}
