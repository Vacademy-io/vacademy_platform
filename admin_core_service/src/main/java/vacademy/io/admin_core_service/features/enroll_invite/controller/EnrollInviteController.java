package vacademy.io.admin_core_service.features.enroll_invite.controller;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.data.domain.Page;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import vacademy.io.admin_core_service.features.enroll_invite.dto.EnrollInviteDTO;
import vacademy.io.admin_core_service.features.enroll_invite.dto.EnrollInviteFilterDTO;
import vacademy.io.admin_core_service.features.enroll_invite.dto.EnrollInviteWithSessionsProjection;
import vacademy.io.admin_core_service.features.enroll_invite.service.EnrollInviteService;
import vacademy.io.common.auth.config.PageConstants;
import vacademy.io.common.auth.model.CustomUserDetails;

import java.util.List;

@RestController
@RequestMapping("/admin-core-service/v1/enroll-invite")
public class EnrollInviteController {
    @Autowired
    private EnrollInviteService enrollInviteService;

    @PostMapping
    public ResponseEntity<String>createEnrollInvite(@RequestBody EnrollInviteDTO enrollInviteDTO) {
        return ResponseEntity.ok(enrollInviteService.createEnrollInvite(enrollInviteDTO));
    }

    @PostMapping("/get-enroll-invite")
    public ResponseEntity<Page<EnrollInviteWithSessionsProjection>>getEnrollInvite(@RequestParam("instituteId") String instituteId,
                                                                                   @RequestParam(name = "pageNo", defaultValue = PageConstants.DEFAULT_PAGE_NUMBER) int pageNo,
                                                                                   @RequestParam(name = "pageSize",defaultValue = PageConstants.DEFAULT_PAGE_SIZE) int pageSize,
                                                                                   @RequestBody EnrollInviteFilterDTO enrollInviteFilterDTO,
                                                                                   @RequestAttribute("user") CustomUserDetails user) {
        return ResponseEntity.ok(enrollInviteService.getEnrollInvitesByInstituteIdAndFilters(instituteId,enrollInviteFilterDTO,pageNo,pageSize));
    }

    @GetMapping("/{instituteId}/{enrollInviteId}")
    public ResponseEntity<EnrollInviteDTO>getEnrollInvite(@PathVariable("instituteId") String instituteId,@PathVariable("enrollInviteId") String enrollInviteId) {
        return ResponseEntity.ok(enrollInviteService.findByEnrollInviteId(enrollInviteId,instituteId));
    }

    @GetMapping("/default/{instituteId}/{packageSessionId}")
    public ResponseEntity<EnrollInviteDTO>getDefaultEnrollInvite(@PathVariable("instituteId") String instituteId,@PathVariable("packageSessionId") String packageSessionId) {
        return ResponseEntity.ok(enrollInviteService.findDefaultEnrollInviteByPackageSessionId(packageSessionId,instituteId));
    }

    @PutMapping("/update-default-enroll-invite-config")
    public ResponseEntity<String>updateDefaultEnrollInviteConfig(@RequestParam("enrollInviteId") String enrollInviteId,@RequestParam("packageSessionId") String packageSessionId) {
        return ResponseEntity.ok(enrollInviteService.updateDefaultEnrollInviteConfig(enrollInviteId,packageSessionId));
    }

    @PostMapping("get-by-payment-option-ids")
    public List<EnrollInviteDTO>getByPaymentOptionIds(@RequestBody List<String> paymentOptionIds) {
        return enrollInviteService.findByPaymentOptionIds(paymentOptionIds);
    }

    @DeleteMapping("/enroll-invites")
    private ResponseEntity<String>deleteEnrollInvites(@RequestBody List<String>enrollInviteIds) {
        return ResponseEntity.ok(enrollInviteService.deleteEnrollInvites(enrollInviteIds));
    }

}
