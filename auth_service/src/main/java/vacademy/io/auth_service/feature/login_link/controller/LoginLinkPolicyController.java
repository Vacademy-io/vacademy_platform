package vacademy.io.auth_service.feature.login_link.controller;

import com.fasterxml.jackson.databind.JsonNode;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestAttribute;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;
import vacademy.io.auth_service.feature.institute_oauth.service.InstituteOAuthClientAccessGuard;
import vacademy.io.auth_service.feature.login_link.entity.InstituteLoginLinkPolicy;
import vacademy.io.auth_service.feature.login_link.service.LoginCodeService;
import vacademy.io.common.auth.model.CustomUserDetails;
import vacademy.io.common.exceptions.VacademyException;

import java.util.LinkedHashMap;
import java.util.Map;

/**
 * The institute's "Require login code" switch (Settings → Login links). Off (the default):
 * username-only links keep working. On: a learner of this institute can only be signed in by a
 * link carrying a valid {@code ?lc=} code. ACTIVE ADMIN of the institute only.
 */
@RestController
@RequestMapping("/auth-service/v1/institutes/{instituteId}/login-link-policy")
public class LoginLinkPolicyController {

    private final LoginCodeService loginCodeService;
    private final InstituteOAuthClientAccessGuard accessGuard;

    public LoginLinkPolicyController(LoginCodeService loginCodeService, InstituteOAuthClientAccessGuard accessGuard) {
        this.loginCodeService = loginCodeService;
        this.accessGuard = accessGuard;
    }

    @GetMapping
    public ResponseEntity<Map<String, Object>> get(@RequestAttribute("user") CustomUserDetails user,
                                                   @PathVariable String instituteId) {
        accessGuard.requireInstituteAdmin(user, instituteId);
        return ResponseEntity.ok(view(instituteId, loginCodeService.findPolicy(instituteId).orElse(null)));
    }

    /** Body: {"require_login_code": true|false}. */
    @PutMapping
    public ResponseEntity<Map<String, Object>> save(@RequestAttribute("user") CustomUserDetails user,
                                                    @PathVariable String instituteId,
                                                    @RequestBody JsonNode body) {
        accessGuard.requireInstituteAdmin(user, instituteId);
        JsonNode flag = body == null ? null : body.get("require_login_code");
        if (flag == null || !flag.isBoolean()) {
            throw new VacademyException(HttpStatus.BAD_REQUEST, "require_login_code (true/false) is required");
        }
        InstituteLoginLinkPolicy saved = loginCodeService.setRequiresCode(instituteId, flag.asBoolean(), user.getUserId());
        return ResponseEntity.ok(view(instituteId, saved));
    }

    private static Map<String, Object> view(String instituteId, InstituteLoginLinkPolicy policy) {
        Map<String, Object> out = new LinkedHashMap<>();
        out.put("institute_id", instituteId);
        out.put("require_login_code", policy != null && policy.isRequireLoginCode());
        out.put("updated_by", policy == null ? null : policy.getUpdatedBy());
        out.put("updated_at", policy == null || policy.getUpdatedAt() == null ? null : policy.getUpdatedAt().toString());
        out.put("max_expires_in_days", LoginCodeService.MAX_TTL_DAYS);
        return out;
    }
}
