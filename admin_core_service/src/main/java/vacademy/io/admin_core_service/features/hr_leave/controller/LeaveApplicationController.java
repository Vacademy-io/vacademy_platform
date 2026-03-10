package vacademy.io.admin_core_service.features.hr_leave.controller;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.data.domain.Page;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import vacademy.io.admin_core_service.core.security.InstituteAccessValidator;
import vacademy.io.admin_core_service.features.hr_leave.dto.*;
import vacademy.io.admin_core_service.features.hr_leave.service.CompOffService;
import vacademy.io.admin_core_service.features.hr_leave.service.LeaveApplicationService;
import vacademy.io.admin_core_service.features.hr_leave.service.LeaveBalanceService;
import vacademy.io.common.auth.model.CustomUserDetails;

import java.util.List;

@RestController
@RequestMapping("/admin-core-service/api/v1/hr/leaves")
public class LeaveApplicationController {

    @Autowired
    private LeaveApplicationService leaveApplicationService;

    @Autowired
    private LeaveBalanceService leaveBalanceService;

    @Autowired
    private CompOffService compOffService;

    @Autowired
    private InstituteAccessValidator instituteAccessValidator;

    // --- Leave Application endpoints ---

    @PostMapping("/apply")
    public ResponseEntity<String> applyLeave(@RequestBody LeaveApplyDTO dto,
                                              @RequestParam String instituteId,
                                              @RequestAttribute("user") CustomUserDetails user) {
        instituteAccessValidator.validateUserAccess(user, instituteId);
        String id = leaveApplicationService.applyLeave(dto, instituteId);
        return ResponseEntity.ok(id);
    }

    @GetMapping("/applications")
    public ResponseEntity<Page<LeaveApplicationDTO>> getLeaveApplications(
            @RequestParam String instituteId,
            @RequestParam(required = false) String status,
            @RequestParam(required = false) String employeeId,
            @RequestParam(defaultValue = "0") int pageNo,
            @RequestParam(defaultValue = "20") int pageSize,
            @RequestAttribute("user") CustomUserDetails user) {
        instituteAccessValidator.validateUserAccess(user, instituteId);
        Page<LeaveApplicationDTO> page = leaveApplicationService.getLeaveApplications(
                instituteId, status, employeeId, pageNo, pageSize);
        return ResponseEntity.ok(page);
    }

    @PutMapping("/applications/{id}/action")
    public ResponseEntity<String> approveRejectLeave(@PathVariable String id,
                                                      @RequestBody LeaveActionDTO actionDTO,
                                                      @RequestParam String instituteId,
                                                      @RequestAttribute("user") CustomUserDetails user) {
        instituteAccessValidator.validateUserAccess(user, instituteId);
        String resultId = leaveApplicationService.approveRejectLeave(id, actionDTO, user.getUserId());
        return ResponseEntity.ok(resultId);
    }

    @PutMapping("/applications/{id}/cancel")
    public ResponseEntity<String> cancelLeave(@PathVariable String id,
                                               @RequestParam String instituteId,
                                               @RequestAttribute("user") CustomUserDetails user) {
        instituteAccessValidator.validateUserAccess(user, instituteId);
        String resultId = leaveApplicationService.cancelLeave(id);
        return ResponseEntity.ok(resultId);
    }

    @GetMapping("/applications/pending")
    public ResponseEntity<List<LeaveApplicationDTO>> getPendingForManager(
            @RequestParam String instituteId,
            @RequestAttribute("user") CustomUserDetails user) {
        instituteAccessValidator.validateUserAccess(user, instituteId);
        List<LeaveApplicationDTO> pending = leaveApplicationService.getPendingForManager(user.getUserId());
        return ResponseEntity.ok(pending);
    }

    // --- Leave Balance endpoints ---

    @GetMapping("/balances")
    public ResponseEntity<List<LeaveBalanceDTO>> getBalances(@RequestParam String employeeId,
                                                              @RequestParam Integer year,
                                                              @RequestParam String instituteId,
                                                              @RequestAttribute("user") CustomUserDetails user) {
        instituteAccessValidator.validateUserAccess(user, instituteId);
        List<LeaveBalanceDTO> balances = leaveBalanceService.getBalances(employeeId, year);
        return ResponseEntity.ok(balances);
    }

    @PutMapping("/balances/{id}/adjust")
    public ResponseEntity<String> adjustBalance(@PathVariable String id,
                                                 @RequestBody LeaveBalanceAdjustDTO dto,
                                                 @RequestParam String instituteId,
                                                 @RequestAttribute("user") CustomUserDetails user) {
        instituteAccessValidator.validateUserAccess(user, instituteId);
        String resultId = leaveBalanceService.adjustBalance(id, dto);
        return ResponseEntity.ok(resultId);
    }

    @PostMapping("/accrue")
    public ResponseEntity<String> accrueLeaves(@RequestParam String instituteId,
                                                @RequestAttribute("user") CustomUserDetails user) {
        instituteAccessValidator.validateUserAccess(user, instituteId);
        String result = leaveBalanceService.accrueLeaves(instituteId);
        return ResponseEntity.ok(result);
    }

    @PostMapping("/year-end-process")
    public ResponseEntity<String> yearEndProcess(@RequestParam String instituteId,
                                                  @RequestParam Integer year,
                                                  @RequestAttribute("user") CustomUserDetails user) {
        instituteAccessValidator.validateUserAccess(user, instituteId);
        String result = leaveBalanceService.yearEndProcess(instituteId, year);
        return ResponseEntity.ok(result);
    }

    // --- Compensatory Off endpoints ---

    @PostMapping("/comp-off")
    public ResponseEntity<String> requestCompOff(@RequestBody CompOffDTO dto,
                                                  @RequestParam String instituteId,
                                                  @RequestAttribute("user") CustomUserDetails user) {
        instituteAccessValidator.validateUserAccess(user, instituteId);
        String id = compOffService.requestCompOff(dto, instituteId);
        return ResponseEntity.ok(id);
    }

    @PutMapping("/comp-off/{id}/action")
    public ResponseEntity<String> approveRejectCompOff(@PathVariable String id,
                                                        @RequestBody CompOffActionDTO actionDTO,
                                                        @RequestParam String instituteId,
                                                        @RequestAttribute("user") CustomUserDetails user) {
        instituteAccessValidator.validateUserAccess(user, instituteId);
        String resultId = compOffService.approveRejectCompOff(id, actionDTO, user.getUserId());
        return ResponseEntity.ok(resultId);
    }

    @GetMapping("/comp-off")
    public ResponseEntity<List<CompOffDTO>> getCompOffs(@RequestParam String employeeId,
                                                         @RequestParam String instituteId,
                                                         @RequestAttribute("user") CustomUserDetails user) {
        instituteAccessValidator.validateUserAccess(user, instituteId);
        List<CompOffDTO> compOffs = compOffService.getCompOffs(employeeId);
        return ResponseEntity.ok(compOffs);
    }
}
