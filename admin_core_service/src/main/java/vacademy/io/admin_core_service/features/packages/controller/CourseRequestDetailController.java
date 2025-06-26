package vacademy.io.admin_core_service.features.packages.controller;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import vacademy.io.admin_core_service.features.course.dto.CourseDTOWithDetails;
import vacademy.io.admin_core_service.features.packages.service.CourseStructureQueryService;
import vacademy.io.admin_core_service.features.study_library.dto.ModuleDTOWithDetails;
import vacademy.io.common.auth.model.CustomUserDetails;

import java.util.List;

@RestController
@RequestMapping("/admin-core-service/v1/package/package-request/detail")
public class CourseRequestDetailController {

    @Autowired
    private CourseStructureQueryService courseStructureQueryService;

    @GetMapping("/init")
    public ResponseEntity<List<CourseDTOWithDetails>> initStudyLibrary(String instituteId) {
        return ResponseEntity.ok(courseStructureQueryService.getUpdatedCourseStructure(instituteId));
    }


    @GetMapping("/modules-with-chapters")
    public ResponseEntity<List<ModuleDTOWithDetails>> modulesWithChapters(@RequestParam("subjectId") String subjectId, @RequestParam("packageSessionId") String packageSessionId, @RequestAttribute("user") CustomUserDetails user) {
        return ResponseEntity.ok(courseStructureQueryService.getModulesAndChaptersFromLogsOnly(subjectId));
    }

}
