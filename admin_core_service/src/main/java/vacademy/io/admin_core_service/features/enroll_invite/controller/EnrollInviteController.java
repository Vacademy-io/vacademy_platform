package vacademy.io.admin_core_service.features.enroll_invite.controller;

import org.checkerframework.checker.units.qual.A;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.data.domain.Page;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import vacademy.io.admin_core_service.features.enroll_invite.dto.EnrollInviteDTO;
import vacademy.io.admin_core_service.features.enroll_invite.dto.EnrollInviteFilterDTO;
import vacademy.io.admin_core_service.features.enroll_invite.service.EnrollInviteService;
import vacademy.io.common.auth.config.PageConstants;
import vacademy.io.common.auth.model.CustomUserDetails;

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
    public ResponseEntity<Page<EnrollInviteDTO>>getEnrollInvite(@RequestParam("instituteId") String instituteId,
                                                                @RequestParam(name = "pageNo", defaultValue = PageConstants.DEFAULT_PAGE_NUMBER) int pageNo,
                                                                @RequestParam(name = "pageSize",defaultValue = PageConstants.DEFAULT_PAGE_SIZE) int pageSize,
                                                                @RequestBody EnrollInviteFilterDTO enrollInviteFilterDTO,
                                                                @RequestAttribute("user") CustomUserDetails user) {
        return ResponseEntity.ok(enrollInviteService.getEnrollInvitesByInstituteIdAndFilters(instituteId,enrollInviteFilterDTO,pageNo,pageSize));
    }
}
