package vacademy.io.admin_core_service.features.hr_payroll.controller;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import vacademy.io.admin_core_service.core.security.InstituteAccessValidator;
import vacademy.io.admin_core_service.features.hr_payroll.dto.*;
import vacademy.io.admin_core_service.features.hr_payroll.service.PayrollCalculationService;
import vacademy.io.admin_core_service.features.hr_payroll.service.PayrollEntryService;
import vacademy.io.admin_core_service.features.hr_payroll.service.PayrollRunService;
import vacademy.io.common.auth.model.CustomUserDetails;

import java.util.List;

@RestController
@RequestMapping("/admin-core-service/api/v1/hr/payroll")
public class PayrollController {

    @Autowired
    private PayrollRunService payrollRunService;

    @Autowired
    private PayrollCalculationService payrollCalculationService;

    @Autowired
    private PayrollEntryService payrollEntryService;

    @Autowired
    private InstituteAccessValidator instituteAccessValidator;

    // ======================== Payroll Runs ========================

    @PostMapping("/runs")
    public ResponseEntity<String> createPayrollRun(
            @RequestBody CreatePayrollRunDTO dto,
            @RequestParam("instituteId") String instituteId,
            @RequestAttribute("user") CustomUserDetails user) {
        instituteAccessValidator.validateUserAccess(user, instituteId);
        String id = payrollRunService.createPayrollRun(dto);
        return ResponseEntity.ok(id);
    }

    @GetMapping("/runs")
    public ResponseEntity<List<PayrollRunDTO>> getPayrollRuns(
            @RequestParam("instituteId") String instituteId,
            @RequestParam(value = "year", required = false) Integer year,
            @RequestAttribute("user") CustomUserDetails user) {
        instituteAccessValidator.validateUserAccess(user, instituteId);
        List<PayrollRunDTO> runs = payrollRunService.getPayrollRuns(instituteId, year);
        return ResponseEntity.ok(runs);
    }

    @GetMapping("/runs/{id}")
    public ResponseEntity<PayrollRunDTO> getPayrollRunById(
            @PathVariable("id") String id,
            @RequestParam("instituteId") String instituteId,
            @RequestAttribute("user") CustomUserDetails user) {
        instituteAccessValidator.validateUserAccess(user, instituteId);
        PayrollRunDTO run = payrollRunService.getPayrollRunById(id);
        return ResponseEntity.ok(run);
    }

    @PostMapping("/runs/{id}/process")
    public ResponseEntity<String> processPayroll(
            @PathVariable("id") String id,
            @RequestParam("instituteId") String instituteId,
            @RequestAttribute("user") CustomUserDetails user) {
        instituteAccessValidator.validateUserAccess(user, instituteId);
        String resultId = payrollCalculationService.processPayroll(id, user.getUserId());
        return ResponseEntity.ok(resultId);
    }

    @PutMapping("/runs/{id}/approve")
    public ResponseEntity<String> approvePayroll(
            @PathVariable("id") String id,
            @RequestParam("instituteId") String instituteId,
            @RequestAttribute("user") CustomUserDetails user) {
        instituteAccessValidator.validateUserAccess(user, instituteId);
        String resultId = payrollRunService.approvePayroll(id, user.getUserId());
        return ResponseEntity.ok(resultId);
    }

    @PutMapping("/runs/{id}/mark-paid")
    public ResponseEntity<String> markPaid(
            @PathVariable("id") String id,
            @RequestParam("instituteId") String instituteId,
            @RequestAttribute("user") CustomUserDetails user) {
        instituteAccessValidator.validateUserAccess(user, instituteId);
        String resultId = payrollRunService.markPaid(id);
        return ResponseEntity.ok(resultId);
    }

    @DeleteMapping("/runs/{id}")
    public ResponseEntity<String> cancelPayroll(
            @PathVariable("id") String id,
            @RequestParam("instituteId") String instituteId,
            @RequestAttribute("user") CustomUserDetails user) {
        instituteAccessValidator.validateUserAccess(user, instituteId);
        String resultId = payrollRunService.cancelPayroll(id);
        return ResponseEntity.ok(resultId);
    }

    // ======================== Payroll Entries ========================

    @GetMapping("/runs/{id}/entries")
    public ResponseEntity<List<PayrollEntryDTO>> getEntriesByRun(
            @PathVariable("id") String id,
            @RequestParam("instituteId") String instituteId,
            @RequestAttribute("user") CustomUserDetails user) {
        instituteAccessValidator.validateUserAccess(user, instituteId);
        List<PayrollEntryDTO> entries = payrollEntryService.getEntriesByRun(id);
        return ResponseEntity.ok(entries);
    }

    @GetMapping("/entries/{id}")
    public ResponseEntity<PayrollEntryDTO> getEntryById(
            @PathVariable("id") String id,
            @RequestParam("instituteId") String instituteId,
            @RequestAttribute("user") CustomUserDetails user) {
        instituteAccessValidator.validateUserAccess(user, instituteId);
        PayrollEntryDTO entry = payrollEntryService.getEntryById(id);
        return ResponseEntity.ok(entry);
    }

    @PutMapping("/entries/{id}/hold")
    public ResponseEntity<String> holdEntry(
            @PathVariable("id") String id,
            @RequestBody HoldReleaseDTO holdDTO,
            @RequestParam("instituteId") String instituteId,
            @RequestAttribute("user") CustomUserDetails user) {
        instituteAccessValidator.validateUserAccess(user, instituteId);
        String resultId = payrollEntryService.holdEntry(id, holdDTO);
        return ResponseEntity.ok(resultId);
    }

    @PutMapping("/entries/{id}/release")
    public ResponseEntity<String> releaseEntry(
            @PathVariable("id") String id,
            @RequestParam("instituteId") String instituteId,
            @RequestAttribute("user") CustomUserDetails user) {
        instituteAccessValidator.validateUserAccess(user, instituteId);
        String resultId = payrollEntryService.releaseEntry(id);
        return ResponseEntity.ok(resultId);
    }
}
