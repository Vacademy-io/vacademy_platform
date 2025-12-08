package vacademy.io.admin_core_service.features.institute_learner.controller;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import vacademy.io.admin_core_service.features.institute_learner.dto.student_stats_dto.AllStudentStatsResponse;
import vacademy.io.admin_core_service.features.institute_learner.dto.student_stats_dto.StudentStatsFilter;
import vacademy.io.admin_core_service.features.institute_learner.manager.StudentStatsManager;
import vacademy.io.common.auth.config.PageConstants;
import vacademy.io.common.auth.model.CustomUserDetails;

import static vacademy.io.common.auth.config.PageConstants.DEFAULT_PAGE_NUMBER;

@RestController
@RequestMapping("/admin-core-service/institute/institute_learner/stats")
public class StudentStatsController {

    @Autowired
    private StudentStatsManager studentStatsManager;

    @PostMapping("/users")
    public ResponseEntity<AllStudentStatsResponse> getStudentStats(
            @RequestAttribute(name = "user") CustomUserDetails user,
            @RequestBody StudentStatsFilter studentStatsFilter,
            @RequestParam(value = "pageNo", defaultValue = DEFAULT_PAGE_NUMBER, required = false) int pageNo,
            @RequestParam(value = "pageSize", defaultValue = PageConstants.DEFAULT_PAGE_SIZE, required = false) int pageSize) {
        return ResponseEntity.ok(studentStatsManager.getStudentStats(user, studentStatsFilter, pageNo, pageSize));
    }
}
