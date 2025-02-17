package vacademy.io.admin_core_service.features.module.controller;

import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import vacademy.io.admin_core_service.features.learner_study_library.dto.LearnerModuleDTOWithDetails;
import vacademy.io.admin_core_service.features.module.service.LearnerModuleDetailsService;
import vacademy.io.common.auth.model.CustomUserDetails;

import java.util.List;

@RestController
@RequestMapping("/admin-core-service/learner/module-detail/v1")
@RequiredArgsConstructor
public class LearnerModuleDetailController {

    private final LearnerModuleDetailsService learnerModuleDetailsService;

    @GetMapping("/get-modules-with-chapters")
    public ResponseEntity<List<LearnerModuleDTOWithDetails>> getModulesOfUser(@RequestParam("subjectId") String subjectId, @RequestParam("packageSessionId") String packageSessionId, @RequestParam("userId")String userId, @RequestAttribute("user") CustomUserDetails user) {
        return ResponseEntity.ok(learnerModuleDetailsService.getModulesDetailsWithChapters(subjectId, packageSessionId,userId, user));
    }
}
