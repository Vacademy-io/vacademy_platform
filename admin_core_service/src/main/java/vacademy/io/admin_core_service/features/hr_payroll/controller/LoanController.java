package vacademy.io.admin_core_service.features.hr_payroll.controller;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import vacademy.io.admin_core_service.core.security.InstituteAccessValidator;
import vacademy.io.admin_core_service.features.hr_payroll.dto.CreateLoanDTO;
import vacademy.io.admin_core_service.features.hr_payroll.dto.EmployeeLoanDTO;
import vacademy.io.admin_core_service.features.hr_payroll.dto.LoanRepaymentDTO;
import vacademy.io.admin_core_service.features.hr_payroll.service.LoanService;
import vacademy.io.common.auth.model.CustomUserDetails;

import java.util.List;

@RestController
@RequestMapping("/admin-core-service/api/v1/hr/payroll/loans")
public class LoanController {

    @Autowired
    private LoanService loanService;

    @Autowired
    private InstituteAccessValidator instituteAccessValidator;

    @PostMapping
    public ResponseEntity<String> createLoan(
            @RequestBody CreateLoanDTO dto,
            @RequestParam("instituteId") String instituteId,
            @RequestAttribute("user") CustomUserDetails user) {
        instituteAccessValidator.validateUserAccess(user, instituteId);
        String id = loanService.createLoan(dto, instituteId);
        return ResponseEntity.ok(id);
    }

    @GetMapping
    public ResponseEntity<List<EmployeeLoanDTO>> getLoans(
            @RequestParam("employeeId") String employeeId,
            @RequestParam("instituteId") String instituteId,
            @RequestAttribute("user") CustomUserDetails user) {
        instituteAccessValidator.validateUserAccess(user, instituteId);
        List<EmployeeLoanDTO> loans = loanService.getLoans(employeeId);
        return ResponseEntity.ok(loans);
    }

    @PutMapping("/{id}/approve")
    public ResponseEntity<String> approveLoan(
            @PathVariable("id") String id,
            @RequestParam("instituteId") String instituteId,
            @RequestAttribute("user") CustomUserDetails user) {
        instituteAccessValidator.validateUserAccess(user, instituteId);
        String resultId = loanService.approveLoan(id, user.getUserId());
        return ResponseEntity.ok(resultId);
    }

    @GetMapping("/{id}/repayments")
    public ResponseEntity<List<LoanRepaymentDTO>> getRepayments(
            @PathVariable("id") String id,
            @RequestParam("instituteId") String instituteId,
            @RequestAttribute("user") CustomUserDetails user) {
        instituteAccessValidator.validateUserAccess(user, instituteId);
        List<LoanRepaymentDTO> repayments = loanService.getRepayments(id);
        return ResponseEntity.ok(repayments);
    }
}
