package vacademy.io.admin_core_service.features.packages.controller;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import vacademy.io.admin_core_service.features.packages.dto.CourseStructureChangesLogDTO;
import vacademy.io.admin_core_service.features.packages.service.CourseStructureChangesLogService;
import vacademy.io.common.auth.model.CustomUserDetails;

@RestController
@RequestMapping("/admin-core-service/course-structure-changes-log")
public class CourseStructureChangesLogController {
    @Autowired
    private  CourseStructureChangesLogService courseStructureChangesLogService;

    @PostMapping
    public ResponseEntity<String> addCourseStructureChangesLog(@RequestBody CourseStructureChangesLogDTO courseStructureChangesLogDTO,String packagesessionId, @RequestAttribute("user") CustomUserDetails userDetails) {
        return ResponseEntity.ok(courseStructureChangesLogService.addCourseStructureChangesLog(courseStructureChangesLogDTO,packagesessionId,userDetails));
    }

}
