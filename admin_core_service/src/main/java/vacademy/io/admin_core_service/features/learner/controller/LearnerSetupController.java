package vacademy.io.admin_core_service.features.learner.controller;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import vacademy.io.admin_core_service.features.learner.dto.StudentInstituteInfoDTO;
import vacademy.io.admin_core_service.features.learner.manager.LearnerInstituteManager;
import vacademy.io.common.institute.dto.InstituteInfoDTO;

import java.util.List;

@RestController
@RequestMapping("/admin-core-service/learner/v1")
public class LearnerSetupController {

    @Autowired
    LearnerInstituteManager learnerInstituteManager;

    @GetMapping("/details/{instituteId}")
    public ResponseEntity<StudentInstituteInfoDTO> getInstituteDetails(@PathVariable String instituteId, @RequestParam String userId) {
        StudentInstituteInfoDTO instituteInfoDTO = learnerInstituteManager.getInstituteDetails(instituteId, userId);
        return ResponseEntity.ok(instituteInfoDTO);
    }

    @GetMapping("/details/by-ids")
    public ResponseEntity<List<StudentInstituteInfoDTO>> getInstituteDetailsByIds(@RequestParam String instituteIds, @RequestParam String userId) {

        List<StudentInstituteInfoDTO> instituteInfoDTO = learnerInstituteManager.getInstituteDetailsByIds(instituteIds, userId);
        return ResponseEntity.ok(instituteInfoDTO);
    }
}
