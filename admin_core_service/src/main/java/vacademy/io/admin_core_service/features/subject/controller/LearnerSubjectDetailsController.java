package vacademy.io.admin_core_service.features.subject.controller;

import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestAttribute;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;
import vacademy.io.admin_core_service.features.subject.dto.SubjectDTOWithDetails;
import vacademy.io.admin_core_service.features.subject.service.LearnerSubjectService;
import vacademy.io.common.auth.model.CustomUserDetails;
import vacademy.io.admin_core_service.config.cache.ClientCacheable;
import vacademy.io.admin_core_service.config.cache.CacheScope;

import java.util.List;

@RestController
@RequestMapping("/admin-core-service/subject/learner/v1")
@RequiredArgsConstructor
public class LearnerSubjectDetailsController {
    private final LearnerSubjectService learnerSubjectService;

    @GetMapping("/subjects")
    @ClientCacheable(maxAgeSeconds = 60, scope = CacheScope.PRIVATE, varyHeaders = {"X-User-Id", "X-Package-Session-Id"})
    public List<SubjectDTOWithDetails> getSubjectsWithDetails(
            String packageSessionId,
            String userId,
            @RequestAttribute("user") CustomUserDetails user) {

        return learnerSubjectService.subjectDTOWithDetails(packageSessionId, userId, user);
    }
}
