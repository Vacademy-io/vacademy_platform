package vacademy.io.admin_core_service.features.hr_leave.controller;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import vacademy.io.admin_core_service.core.security.InstituteAccessValidator;
import vacademy.io.admin_core_service.features.hr_leave.dto.LeaveTypeDTO;
import vacademy.io.admin_core_service.features.hr_leave.service.LeaveTypeService;
import vacademy.io.common.auth.model.CustomUserDetails;

import java.util.List;

@RestController
@RequestMapping("/admin-core-service/api/v1/hr/leaves/types")
public class LeaveTypeController {

    @Autowired
    private LeaveTypeService leaveTypeService;

    @Autowired
    private InstituteAccessValidator instituteAccessValidator;

    @PostMapping
    public ResponseEntity<String> createLeaveType(@RequestBody LeaveTypeDTO dto,
                                                   @RequestParam String instituteId,
                                                   @RequestAttribute("user") CustomUserDetails user) {
        instituteAccessValidator.validateUserAccess(user, instituteId);
        String id = leaveTypeService.createLeaveType(dto, instituteId);
        return ResponseEntity.ok(id);
    }

    @GetMapping
    public ResponseEntity<List<LeaveTypeDTO>> getLeaveTypes(@RequestParam String instituteId,
                                                             @RequestAttribute("user") CustomUserDetails user) {
        instituteAccessValidator.validateUserAccess(user, instituteId);
        List<LeaveTypeDTO> leaveTypes = leaveTypeService.getLeaveTypes(instituteId);
        return ResponseEntity.ok(leaveTypes);
    }

    @PutMapping("/{id}")
    public ResponseEntity<String> updateLeaveType(@PathVariable String id,
                                                   @RequestBody LeaveTypeDTO dto,
                                                   @RequestParam String instituteId,
                                                   @RequestAttribute("user") CustomUserDetails user) {
        instituteAccessValidator.validateUserAccess(user, instituteId);
        String updatedId = leaveTypeService.updateLeaveType(id, dto);
        return ResponseEntity.ok(updatedId);
    }
}
