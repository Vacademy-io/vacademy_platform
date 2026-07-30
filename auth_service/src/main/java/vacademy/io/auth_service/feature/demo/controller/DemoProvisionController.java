package vacademy.io.auth_service.feature.demo.controller;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import vacademy.io.auth_service.feature.demo.dto.DemoProvisionRequest;
import vacademy.io.auth_service.feature.demo.dto.DemoProvisionResponse;
import vacademy.io.auth_service.feature.demo.entity.InstituteTrial;
import vacademy.io.auth_service.feature.demo.service.DemoProvisionService;

/**
 * Provisioning a demo workspace from a quote.
 *
 * Authenticated on purpose — these paths are deliberately NOT in
 * {@code ApplicationSecurityConfig}'s permitAll list, unlike the public signup route.
 */
@RestController
@RequestMapping("/auth-service/super-admin/v1/demo")
public class DemoProvisionController {

    @Autowired
    private DemoProvisionService provisionService;

    /** Creates the institute, the root admin and the trial expiry in one go. */
    @PostMapping("/provision")
    public ResponseEntity<DemoProvisionResponse> provision(
            @RequestBody DemoProvisionRequest request,
            @RequestHeader(value = "X-User-Id", required = false) String actingUserId) {
        return ResponseEntity.ok(provisionService.provision(request, actingUserId));
    }

    /** Moves a trial's end date — the way to give a prospect a few more days. */
    @PutMapping("/{instituteId}/expiry")
    public ResponseEntity<InstituteTrial> extend(@PathVariable String instituteId,
                                                 @RequestParam String expiresAt) {
        return ResponseEntity.ok(provisionService.extend(instituteId, expiresAt));
    }
}
