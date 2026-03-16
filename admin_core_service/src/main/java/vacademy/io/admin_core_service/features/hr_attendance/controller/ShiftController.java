package vacademy.io.admin_core_service.features.hr_attendance.controller;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import vacademy.io.admin_core_service.core.security.InstituteAccessValidator;
import vacademy.io.admin_core_service.features.hr_attendance.dto.ShiftAssignDTO;
import vacademy.io.admin_core_service.features.hr_attendance.dto.ShiftDTO;
import vacademy.io.admin_core_service.features.hr_attendance.service.ShiftService;
import vacademy.io.common.auth.model.CustomUserDetails;

import java.util.List;

@RestController
@RequestMapping("/admin-core-service/api/v1/hr/shifts")
public class ShiftController {

    @Autowired
    private ShiftService shiftService;

    @Autowired
    private InstituteAccessValidator instituteAccessValidator;

    @PostMapping
    public ResponseEntity<String> createShift(
            @RequestBody ShiftDTO shiftDTO,
            @RequestParam("instituteId") String instituteId,
            @RequestAttribute("user") CustomUserDetails user) {
        instituteAccessValidator.validateUserAccess(user, instituteId);
        return ResponseEntity.ok(shiftService.createShift(shiftDTO));
    }

    @GetMapping
    public ResponseEntity<List<ShiftDTO>> getShifts(
            @RequestParam("instituteId") String instituteId,
            @RequestAttribute("user") CustomUserDetails user) {
        instituteAccessValidator.validateUserAccess(user, instituteId);
        return ResponseEntity.ok(shiftService.getShifts(instituteId));
    }

    @PutMapping("/{id}")
    public ResponseEntity<String> updateShift(
            @PathVariable("id") String id,
            @RequestBody ShiftDTO shiftDTO,
            @RequestParam("instituteId") String instituteId,
            @RequestAttribute("user") CustomUserDetails user) {
        instituteAccessValidator.validateUserAccess(user, instituteId);
        return ResponseEntity.ok(shiftService.updateShift(id, shiftDTO));
    }

    @PostMapping("/assign")
    public ResponseEntity<String> assignShiftToEmployees(
            @RequestBody ShiftAssignDTO assignDTO,
            @RequestParam("instituteId") String instituteId,
            @RequestAttribute("user") CustomUserDetails user) {
        instituteAccessValidator.validateUserAccess(user, instituteId);
        return ResponseEntity.ok(shiftService.assignShiftToEmployees(assignDTO));
    }
}
