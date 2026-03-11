package vacademy.io.admin_core_service.features.hr_attendance.controller;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import vacademy.io.admin_core_service.core.security.InstituteAccessValidator;
import vacademy.io.admin_core_service.features.hr_attendance.dto.HolidayDTO;
import vacademy.io.admin_core_service.features.hr_attendance.service.HolidayService;
import vacademy.io.common.auth.model.CustomUserDetails;

import java.util.List;

@RestController
@RequestMapping("/admin-core-service/api/v1/hr/holidays")
public class HolidayController {

    @Autowired
    private HolidayService holidayService;

    @Autowired
    private InstituteAccessValidator instituteAccessValidator;

    @PostMapping
    public ResponseEntity<String> createHoliday(
            @RequestBody HolidayDTO holidayDTO,
            @RequestParam("instituteId") String instituteId,
            @RequestAttribute("user") CustomUserDetails user) {
        instituteAccessValidator.validateUserAccess(user, instituteId);
        return ResponseEntity.ok(holidayService.createHoliday(holidayDTO));
    }

    @GetMapping
    public ResponseEntity<List<HolidayDTO>> getHolidays(
            @RequestParam("instituteId") String instituteId,
            @RequestParam("year") Integer year,
            @RequestAttribute("user") CustomUserDetails user) {
        instituteAccessValidator.validateUserAccess(user, instituteId);
        return ResponseEntity.ok(holidayService.getHolidays(instituteId, year));
    }

    @PutMapping("/{id}")
    public ResponseEntity<String> updateHoliday(
            @PathVariable("id") String id,
            @RequestBody HolidayDTO holidayDTO,
            @RequestParam("instituteId") String instituteId,
            @RequestAttribute("user") CustomUserDetails user) {
        instituteAccessValidator.validateUserAccess(user, instituteId);
        return ResponseEntity.ok(holidayService.updateHoliday(id, holidayDTO));
    }

    @DeleteMapping("/{id}")
    public ResponseEntity<Void> deleteHoliday(
            @PathVariable("id") String id,
            @RequestParam("instituteId") String instituteId,
            @RequestAttribute("user") CustomUserDetails user) {
        instituteAccessValidator.validateUserAccess(user, instituteId);
        holidayService.deleteHoliday(id);
        return ResponseEntity.noContent().build();
    }

    @PostMapping("/bulk")
    public ResponseEntity<String> bulkCreateHolidays(
            @RequestBody List<HolidayDTO> holidays,
            @RequestParam("instituteId") String instituteId,
            @RequestAttribute("user") CustomUserDetails user) {
        instituteAccessValidator.validateUserAccess(user, instituteId);
        return ResponseEntity.ok(holidayService.bulkCreateHolidays(holidays));
    }
}
