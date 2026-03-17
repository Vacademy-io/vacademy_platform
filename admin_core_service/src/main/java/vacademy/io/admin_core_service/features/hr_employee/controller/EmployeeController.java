package vacademy.io.admin_core_service.features.hr_employee.controller;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.data.domain.Page;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import vacademy.io.admin_core_service.core.security.InstituteAccessValidator;
import vacademy.io.admin_core_service.features.hr_employee.dto.*;
import vacademy.io.admin_core_service.features.hr_employee.service.EmployeeBankService;
import vacademy.io.admin_core_service.features.hr_employee.service.EmployeeDocumentService;
import vacademy.io.admin_core_service.features.hr_employee.service.EmployeeService;
import vacademy.io.common.auth.model.CustomUserDetails;

import java.util.List;

@RestController
@RequestMapping("/admin-core-service/api/v1/hr/employees")
public class EmployeeController {

    @Autowired
    private EmployeeService employeeService;

    @Autowired
    private EmployeeBankService employeeBankService;

    @Autowired
    private EmployeeDocumentService employeeDocumentService;

    @Autowired
    private InstituteAccessValidator instituteAccessValidator;

    // ======================== Employee Profile ========================

    @PostMapping
    public ResponseEntity<String> createEmployee(
            @RequestBody EmployeeProfileDTO dto,
            @RequestParam("instituteId") String instituteId,
            @RequestAttribute("user") CustomUserDetails user) {
        instituteAccessValidator.validateUserAccess(user, instituteId);
        String id = employeeService.createEmployee(dto, instituteId);
        return ResponseEntity.ok(id);
    }

    @GetMapping
    public ResponseEntity<Page<EmployeeProfileDTO>> getEmployees(
            @RequestParam("instituteId") String instituteId,
            @RequestParam(defaultValue = "0") int pageNo,
            @RequestParam(defaultValue = "10") int pageSize,
            @RequestAttribute("user") CustomUserDetails user) {
        instituteAccessValidator.validateUserAccess(user, instituteId);
        Page<EmployeeProfileDTO> employees = employeeService.getEmployees(instituteId, null, pageNo, pageSize);
        return ResponseEntity.ok(employees);
    }

    @PostMapping("/filter")
    public ResponseEntity<Page<EmployeeProfileDTO>> getEmployeesWithFilter(
            @RequestBody EmployeeFilterDTO filterDTO,
            @RequestParam("instituteId") String instituteId,
            @RequestParam(defaultValue = "0") int pageNo,
            @RequestParam(defaultValue = "10") int pageSize,
            @RequestAttribute("user") CustomUserDetails user) {
        instituteAccessValidator.validateUserAccess(user, instituteId);
        Page<EmployeeProfileDTO> employees = employeeService.getEmployees(instituteId, filterDTO, pageNo, pageSize);
        return ResponseEntity.ok(employees);
    }

    @GetMapping("/{id}")
    public ResponseEntity<EmployeeProfileDTO> getEmployeeById(
            @PathVariable("id") String id,
            @RequestParam("instituteId") String instituteId,
            @RequestAttribute("user") CustomUserDetails user) {
        instituteAccessValidator.validateUserAccess(user, instituteId);
        EmployeeProfileDTO employee = employeeService.getEmployeeById(id);
        return ResponseEntity.ok(employee);
    }

    @PutMapping("/{id}")
    public ResponseEntity<String> updateEmployee(
            @PathVariable("id") String id,
            @RequestBody EmployeeProfileDTO dto,
            @RequestParam("instituteId") String instituteId,
            @RequestAttribute("user") CustomUserDetails user) {
        instituteAccessValidator.validateUserAccess(user, instituteId);
        String updatedId = employeeService.updateEmployee(id, dto);
        return ResponseEntity.ok(updatedId);
    }

    @PutMapping("/{id}/status")
    public ResponseEntity<String> updateEmployeeStatus(
            @PathVariable("id") String id,
            @RequestBody EmployeeStatusUpdateDTO statusUpdateDTO,
            @RequestParam("instituteId") String instituteId,
            @RequestAttribute("user") CustomUserDetails user) {
        instituteAccessValidator.validateUserAccess(user, instituteId);
        String updatedId = employeeService.updateEmployeeStatus(id, statusUpdateDTO);
        return ResponseEntity.ok(updatedId);
    }

    @GetMapping("/{id}/org-chart")
    public ResponseEntity<List<EmployeeProfileDTO>> getOrgChart(
            @PathVariable("id") String id,
            @RequestParam("instituteId") String instituteId,
            @RequestAttribute("user") CustomUserDetails user) {
        instituteAccessValidator.validateUserAccess(user, instituteId);
        List<EmployeeProfileDTO> directReports = employeeService.getOrgChart(id);
        return ResponseEntity.ok(directReports);
    }

    // ======================== Bank Details ========================

    @PostMapping("/{id}/bank-details")
    public ResponseEntity<String> addBankDetail(
            @PathVariable("id") String id,
            @RequestBody EmployeeBankDetailDTO dto,
            @RequestParam("instituteId") String instituteId,
            @RequestAttribute("user") CustomUserDetails user) {
        instituteAccessValidator.validateUserAccess(user, instituteId);
        String bankId = employeeBankService.addBankDetail(id, dto);
        return ResponseEntity.ok(bankId);
    }

    @GetMapping("/{id}/bank-details")
    public ResponseEntity<List<EmployeeBankDetailDTO>> getBankDetails(
            @PathVariable("id") String id,
            @RequestParam("instituteId") String instituteId,
            @RequestAttribute("user") CustomUserDetails user) {
        instituteAccessValidator.validateUserAccess(user, instituteId);
        List<EmployeeBankDetailDTO> bankDetails = employeeBankService.getBankDetails(id);
        return ResponseEntity.ok(bankDetails);
    }

    @PutMapping("/{id}/bank-details/{bid}")
    public ResponseEntity<String> updateBankDetail(
            @PathVariable("id") String id,
            @PathVariable("bid") String bid,
            @RequestBody EmployeeBankDetailDTO dto,
            @RequestParam("instituteId") String instituteId,
            @RequestAttribute("user") CustomUserDetails user) {
        instituteAccessValidator.validateUserAccess(user, instituteId);
        String updatedId = employeeBankService.updateBankDetail(id, bid, dto);
        return ResponseEntity.ok(updatedId);
    }

    // ======================== Documents ========================

    @PostMapping("/{id}/documents")
    public ResponseEntity<String> addDocument(
            @PathVariable("id") String id,
            @RequestBody EmployeeDocumentDTO dto,
            @RequestParam("instituteId") String instituteId,
            @RequestAttribute("user") CustomUserDetails user) {
        instituteAccessValidator.validateUserAccess(user, instituteId);
        String docId = employeeDocumentService.addDocument(id, dto);
        return ResponseEntity.ok(docId);
    }

    @GetMapping("/{id}/documents")
    public ResponseEntity<List<EmployeeDocumentDTO>> getDocuments(
            @PathVariable("id") String id,
            @RequestParam("instituteId") String instituteId,
            @RequestAttribute("user") CustomUserDetails user) {
        instituteAccessValidator.validateUserAccess(user, instituteId);
        List<EmployeeDocumentDTO> documents = employeeDocumentService.getDocuments(id);
        return ResponseEntity.ok(documents);
    }

    @DeleteMapping("/{id}/documents/{did}")
    public ResponseEntity<Void> deleteDocument(
            @PathVariable("id") String id,
            @PathVariable("did") String did,
            @RequestParam("instituteId") String instituteId,
            @RequestAttribute("user") CustomUserDetails user) {
        instituteAccessValidator.validateUserAccess(user, instituteId);
        employeeDocumentService.deleteDocument(id, did);
        return ResponseEntity.ok().build();
    }
}
