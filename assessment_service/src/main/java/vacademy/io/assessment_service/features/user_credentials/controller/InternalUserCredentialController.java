package vacademy.io.assessment_service.features.user_credentials.controller;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;
import vacademy.io.assessment_service.features.user_credentials.dto.UsernameRenameRequest;
import vacademy.io.assessment_service.features.user_credentials.dto.UsernameRenameResponse;
import vacademy.io.assessment_service.features.user_credentials.service.UsernameRenameService;

/**
 * Tail of the username-rename fan-out: auth_service (owns users.username) ->
 * admin_core_service (owns student.username) -> here (owns the four
 * assessment-database copies).
 *
 * <p>Chained through admin_core rather than called from auth_service directly
 * because admin_core already has {@code assessment.server.baseurl} wired in
 * every profile; auth_service does not, and adding it would mean a devops
 * change in every environment before this could ship.
 *
 * <p><b>Security:</b> mapped under {@code /assessment-service/internal/**},
 * guarded by {@code InternalAuthFilter} — callers must present clientName +
 * Signature HMAC headers validated against client_secret_key. No JWT. Same
 * scheme admin_core already uses for
 * {@code /internal/assessment-registration/register-batches}.
 */
@Slf4j
@RestController
@RequiredArgsConstructor
@RequestMapping("/assessment-service/internal/user-credentials/v1")
public class InternalUserCredentialController {

    private final UsernameRenameService usernameRenameService;

    @PostMapping("/rename")
    public ResponseEntity<UsernameRenameResponse> rename(@RequestBody UsernameRenameRequest request) {
        return ResponseEntity.ok(usernameRenameService.rename(request));
    }
}
