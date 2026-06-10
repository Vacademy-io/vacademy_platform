package vacademy.io.admin_core_service.features.doubts.controller;

import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;
import vacademy.io.admin_core_service.config.cache.CacheScope;
import vacademy.io.admin_core_service.config.cache.ClientCacheable;
import vacademy.io.admin_core_service.features.doubts.dtos.DoubtsDto;
import vacademy.io.admin_core_service.features.doubts.dtos.OpenDoubtConfigResponse;
import vacademy.io.admin_core_service.features.doubts.manager.DoubtsManager;

/**
 * Unauthenticated query intake for logged-out visitors (the learner login page's "Need help?"
 * button). Lives under /open/** which ApplicationSecurityConfig permits without a JWT. The create
 * path is gated server-side by the institute's learner_query.allow_guest toggle — the setting
 * cannot be bypassed by calling this API directly.
 */
@RestController
@RequestMapping("/admin-core-service/open/institute/v1/doubts")
@RequiredArgsConstructor
public class OpenDoubtsController {

    private final DoubtsManager doubtsManager;

    /** Gate flags + guest-selectable type list. Never 5xxs — failures read as "disabled". */
    @GetMapping("/config")
    @ClientCacheable(maxAgeSeconds = 300, scope = CacheScope.PUBLIC)
    public ResponseEntity<OpenDoubtConfigResponse> getConfig(
            @RequestParam("instituteId") String instituteId) {
        return ResponseEntity.ok(doubtsManager.getOpenDoubtConfig(instituteId));
    }

    /** Guest create: requires institute_id, guest_name, guest_email, html_text (+optional type). */
    @PostMapping("/create")
    public ResponseEntity<String> createGuestDoubt(@RequestBody DoubtsDto request) {
        return ResponseEntity.ok(doubtsManager.createGuestDoubt(request));
    }
}
