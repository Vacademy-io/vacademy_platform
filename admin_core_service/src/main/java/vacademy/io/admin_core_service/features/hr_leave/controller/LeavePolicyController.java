package vacademy.io.admin_core_service.features.hr_leave.controller;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import vacademy.io.admin_core_service.core.security.InstituteAccessValidator;
import vacademy.io.admin_core_service.features.hr_leave.dto.LeavePolicyDTO;
import vacademy.io.admin_core_service.features.hr_leave.service.LeavePolicyService;
import vacademy.io.common.auth.model.CustomUserDetails;

import java.util.List;

@RestController
@RequestMapping("/admin-core-service/api/v1/hr/leaves/policies")
public class LeavePolicyController {

    @Autowired
    private LeavePolicyService leavePolicyService;

    @Autowired
    private InstituteAccessValidator instituteAccessValidator;

    @PostMapping
    public ResponseEntity<String> createLeavePolicy(@RequestBody LeavePolicyDTO dto,
                                                     @RequestParam String instituteId,
                                                     @RequestAttribute("user") CustomUserDetails user) {
        instituteAccessValidator.validateUserAccess(user, instituteId);
        String id = leavePolicyService.createLeavePolicy(dto, instituteId);
        return ResponseEntity.ok(id);
    }

    @GetMapping
    public ResponseEntity<List<LeavePolicyDTO>> getLeavePolicies(@RequestParam String instituteId,
                                                                  @RequestAttribute("user") CustomUserDetails user) {
        instituteAccessValidator.validateUserAccess(user, instituteId);
        List<LeavePolicyDTO> policies = leavePolicyService.getLeavePolicies(instituteId);
        return ResponseEntity.ok(policies);
    }

    @PutMapping("/{id}")
    public ResponseEntity<String> updateLeavePolicy(@PathVariable String id,
                                                     @RequestBody LeavePolicyDTO dto,
                                                     @RequestParam String instituteId,
                                                     @RequestAttribute("user") CustomUserDetails user) {
        instituteAccessValidator.validateUserAccess(user, instituteId);
        String updatedId = leavePolicyService.updateLeavePolicy(id, dto);
        return ResponseEntity.ok(updatedId);
    }
}
